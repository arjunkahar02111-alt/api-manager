module.exports = {
  apps: [
    {
      name: 'arjun-backend',
      script: 'dist/index.js',
      cwd: './apps/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'arjun-gateway',
      script: 'dist/index.js',
      cwd: './apps/gateway',
      instances: 'max', // Cluster mode for maximum throughput
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3001,
      },
      max_memory_restart: '1G',
      exp_backoff_restart_delay: 100,
    },
    {
      name: 'arjun-worker',
      script: 'dist/index.js',
      cwd: './apps/worker',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
      },
      max_memory_restart: '512M',
      exp_backoff_restart_delay: 100,
    },
  ],
};
