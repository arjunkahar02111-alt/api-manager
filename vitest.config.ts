import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@arjun/types': path.resolve(__dirname, 'packages/types/src/index.ts'),
      '@arjun/shared': path.resolve(__dirname, 'packages/shared/src/index.ts'),
      '@arjun/schemas': path.resolve(__dirname, 'packages/schemas/src/index.ts'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 60000,
    hookTimeout: 240000,
    include: ['tests/**/*.test.ts'],
  },
});
