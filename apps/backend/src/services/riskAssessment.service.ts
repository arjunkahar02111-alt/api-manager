import { Redis } from 'ioredis';
import { getRedisClient } from './redis.service.js';
import { Customer, ApiKey, SecurityIncident } from '../database/models/index.js';
import { NotificationService } from './notification.service.js';
import type { RiskAssessmentResult, SecuritySeverity } from '@arjun/types';

export class RiskAssessmentService {
  /**
   * Evaluates key-sharing, anomaly, and access risk for an incoming request.
   * Returns a risk score (0-100), risk level, action, and triggering factors.
   */
  static async assessRequestRisk(params: {
    customerId: string;
    keyHash: string;
    keyPrefix: string;
    clientIp: string;
    userAgent?: string;
    endpoint: string;
    boundIp?: string;
  }): Promise<RiskAssessmentResult> {
    const redis = getRedisClient();
    const factors: string[] = [];
    let score = 0;

    const { customerId, keyHash, keyPrefix, clientIp, userAgent, endpoint, boundIp } = params;

    // 1. IP History & Concurrent Multi-IP Check (Sliding 5-minute window)
    const ipSetKey = `risk:ips:${keyHash}`;
    await redis.sadd(ipSetKey, clientIp);
    await redis.expire(ipSetKey, 300); // 5 minutes TTL
    const activeIpCount = await redis.scard(ipSetKey);

    if (activeIpCount > 1) {
      score += 40;
      factors.push(`Multi-IP access: ${activeIpCount} distinct IPs using this key in last 5m`);
    }

    // 2. Bound IP Mismatch vs Subnet Shift Analysis
    if (boundIp && boundIp !== clientIp) {
      const boundSubnet = boundIp.split('.').slice(0, 2).join('.');
      const clientSubnet = clientIp.split('.').slice(0, 2).join('.');

      if (boundSubnet === clientSubnet) {
        // Likely legitimate dynamic IP or local ISP re-assignment
        score += 15;
        factors.push(`Subnet shift within same carrier range (${boundIp} -> ${clientIp})`);
      } else {
        // Completely different remote network/ISP or foreign city
        score += 50;
        factors.push(`Distant network/carrier mismatch (Locked: ${boundIp}, Incoming: ${clientIp})`);
      }
    }

    // 3. User-Agent Anomaly Tracking
    const lastUaKey = `risk:ua:${keyHash}`;
    const previousUa = await redis.get(lastUaKey);
    if (userAgent) {
      await redis.set(lastUaKey, userAgent, 'EX', 86400);
      if (previousUa && previousUa !== userAgent) {
        // Detect suspicious shift from browser to script or vice versa
        const wasBrowser = previousUa.includes('Mozilla') || previousUa.includes('Chrome');
        const isScript = userAgent.includes('python') || userAgent.includes('curl') || userAgent.includes('Postman');
        if (wasBrowser && isScript) {
          score += 25;
          factors.push(`User-Agent anomaly: shifted from browser (${previousUa.slice(0, 20)}...) to automated tool (${userAgent})`);
        } else {
          score += 10;
          factors.push('User-Agent header changed');
        }
      }
    }

    // 4. Request Frequency & Burst Rate Tracking
    const burstKey = `risk:burst:${keyHash}`;
    const burstCount = await redis.incr(burstKey);
    if (burstCount === 1) await redis.expire(burstKey, 10); // 10-second window
    if (burstCount > 50) {
      score += 20;
      factors.push(`High burst frequency: ${burstCount} requests in 10s`);
    }

    // Cap score at 100
    const finalScore = Math.min(100, Math.max(0, score));

    // Determine Risk Level & Action
    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    let action: 'MONITOR' | 'VERIFY' | 'THROTTLE' | 'SUSPEND_KEY' = 'MONITOR';

    if (finalScore >= 85) {
      riskLevel = 'CRITICAL';
      action = 'SUSPEND_KEY';
    } else if (finalScore >= 60) {
      riskLevel = 'HIGH';
      action = 'THROTTLE';
    } else if (finalScore >= 30) {
      riskLevel = 'MEDIUM';
      action = 'VERIFY';
    } else {
      riskLevel = 'LOW';
      action = 'MONITOR';
    }

    // If High or Critical, dispatch real-time security alert
    if (riskLevel === 'CRITICAL' || riskLevel === 'HIGH') {
      const severity: SecuritySeverity = riskLevel === 'CRITICAL' ? 'CRITICAL' : 'HIGH';
      NotificationService.notify({
        userId: customerId,
        type: 'KEY_SHARING_RISK_ALERT',
        title: `Suspicious Key Usage Detected (${riskLevel} Risk)`,
        message: `API Key '${keyPrefix}' generated a risk score of ${finalScore}/100. Factors: ${factors.join('; ')}`,
        severity,
        metadata: {
          keyPrefix,
          sourceIp: clientIp,
          riskScore: finalScore,
          factors,
          actionTaken: action,
        },
      }).catch(() => {});
    }

    return {
      riskScore: finalScore,
      riskLevel,
      action,
      factors,
    };
  }
}
