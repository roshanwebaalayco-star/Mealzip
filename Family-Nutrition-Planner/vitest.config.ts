import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    testTimeout: 120000,
    hookTimeout: 30000,
    reporters: ['verbose'],
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@workspace/db': path.resolve(__dirname, 'lib/db/src'),
    },
  },
});
