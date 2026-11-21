import type { Response } from 'express';
import { getRedisClient } from './redis.service.js';

interface SSEClient {
  id: string;
  res: Response;
}

class RealtimeBroadcaster {
  private clients: Map<string, SSEClient> = new Map();
  private redisSubscriberInitialized = false;

  constructor() {
    this.initSubscriber();
  }

  private async initSubscriber() {
    try {
      const redis = getRedisClient();
      // Only attach if pubsub supported
      if (typeof redis.duplicate === 'function' && process.env.REDIS_MOCK !== 'true') {
        const sub = redis.duplicate();
        await sub.subscribe('pubsub:realtime');
        sub.on('message', (_channel, message) => {
          try {
            const parsed = JSON.parse(message);
            this.sendToLocalClients(parsed.event, parsed.payload);
          } catch {}
        });
        this.redisSubscriberInitialized = true;
      }
    } catch {}
  }

  addClient(id: string, res: Response) {
    this.clients.set(id, { id, res });
    // Send immediate initial ping
    res.write(`event: connected\ndata: ${JSON.stringify({ message: 'Live telemetry connected', time: Date.now() })}\n\n`);
  }

  removeClient(id: string) {
    this.clients.delete(id);
  }

  getClientCount(): number {
    return this.clients.size;
  }

  private sendToLocalClients(event: string, payload: any) {
    const formatted = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const [id, client] of this.clients.entries()) {
      try {
        client.res.write(formatted);
      } catch {
        this.clients.delete(id);
      }
    }

    // Trigger Discord webhook & notification persistence if security alert
    if (event === 'security_alert' && payload) {
      import('./notification.service.js')
        .then(({ NotificationService }) => {
          NotificationService.notify({
            type: payload.incidentType || 'SECURITY_ALERT',
            title: `Security Alert: ${payload.incidentType || 'Incident'}`,
            message:
              payload.reason ||
              `Automated defense action taken: ${payload.actionTaken || 'BLOCKED'} (User: ${payload.customerUsername || 'N/A'}, IP: ${payload.sourceIp})`,
            severity: payload.severity || 'CRITICAL',
            metadata: payload,
          }).catch(() => {});
        })
        .catch(() => {});
    }
  }

  broadcast(event: string, payload: any) {
    // 1. Send to local SSE clients
    this.sendToLocalClients(event, payload);

    // 2. Publish to Redis for other cluster instances if in multi-node
    try {
      const redis = getRedisClient();
      redis.publish('pubsub:realtime', JSON.stringify({ event, payload })).catch(() => {});
    } catch {}
  }
}

export const RealtimeService = new RealtimeBroadcaster();
