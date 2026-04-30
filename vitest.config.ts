import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.{ts,tsx}'],
    globals: true,
    // Run before any test module is imported so `lib/env.ts`'s
    // import-time validation has the stub `DATABASE_URL` it needs.
    setupFiles: ['./__tests__/setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});
