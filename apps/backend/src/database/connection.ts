import mongoose from 'mongoose';

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  const maxPoolSize = parseInt(process.env.MONGODB_MAX_POOL_SIZE || '50', 10);
  const serverSelectionTimeoutMS = parseInt(process.env.MONGODB_TIMEOUT_MS || '5000', 10);

  mongoose.connection.on('connected', () => {
    console.log('[Database] MongoDB connected successfully');
  });

  mongoose.connection.on('error', (err) => {
    console.error('[Database] MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[Database] MongoDB disconnected');
  });

  return mongoose.connect(uri, {
    maxPoolSize,
    serverSelectionTimeoutMS,
    autoIndex: true,
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
