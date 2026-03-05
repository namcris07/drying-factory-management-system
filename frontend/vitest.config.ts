import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: [
        'features/**/api/**/*.{ts,tsx}',
        'features/**/config/**/*.{ts,tsx}',
        'features/**/model/**/*.{ts,tsx}',
        'shared/auth/**/*.{ts,tsx}',
      ],
      exclude: ['**/*.{test,spec}.{ts,tsx}', '**/*.d.ts'],
      thresholds: {
        lines: 50,
        functions: 50,
        statements: 50,
        branches: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
