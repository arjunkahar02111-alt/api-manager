import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.GATEWAY_PORT || '3001', 10),
  backendPort: parseInt(process.env.BACKEND_PORT || '3000', 10),

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arjun_api_manager',
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10),
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'arjun:',
  },

  proxy: {
    defaultTimeoutMs: parseInt(process.env.PROXY_REQUEST_TIMEOUT_MS || '15000', 10),
    maxRequestBytes: parseInt(process.env.PROXY_MAX_BODY_BYTES || '10485760', 10), // 10MB
    maxResponseBytes: parseInt(process.env.PROXY_MAX_RESPONSE_BYTES || '10485760', 10),
    allowPrivateIps: process.env.PROXY_ALLOW_PRIVATE_IPS === 'true',
  },
};
