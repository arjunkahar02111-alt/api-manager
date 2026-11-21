import dotenv from 'dotenv';
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  port: parseInt(process.env.BACKEND_PORT || '3000', 10),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || 'https://api.karviontechnologies.in',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'https://api.karviontechnologies.in',

  database: {
    uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arjun_api_manager',
    maxPoolSize: parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10),
    timeoutMs: parseInt(process.env.MONGODB_TIMEOUT_MS || '5000', 10),
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || '0', 10),
    keyPrefix: process.env.REDIS_KEY_PREFIX || 'arjun:',
  },

  jwt: {
    adminSecret: process.env.JWT_ADMIN_SECRET || 'arjun_admin_jwt_super_secret_key_minimum_32_characters_long_2026',
    customerSecret: process.env.JWT_CUSTOMER_SECRET || 'arjun_customer_jwt_super_secret_key_minimum_32_characters_long_2026',
    adminAccessExpiry: process.env.JWT_ADMIN_ACCESS_EXPIRY || '15m',
    adminRefreshExpiry: process.env.JWT_ADMIN_REFRESH_EXPIRY || '7d',
    customerAccessExpiry: process.env.JWT_CUSTOMER_ACCESS_EXPIRY || '2h',
  },

  security: {
    dataEncryptionKey: process.env.DATA_ENCRYPTION_KEY || 'default-fallback-encryption-key-for-arjun-api-manager-32-chars!',
    cookieSecret: process.env.COOKIE_SECRET || 'arjun_cookie_secret_salt_2026',
  },

  superAdminSeed: {
    username: process.env.SUPER_ADMIN_USERNAME || 'admin',
    password: process.env.SUPER_ADMIN_PASSWORD || 'AdminStrongSecurePassword2026!',
    email: process.env.SUPER_ADMIN_EMAIL || 'admin@karviontechnologies.in',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CHAT_ID || '',
  },
};
