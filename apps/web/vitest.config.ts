import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    // Cổng coverage (.claude/rules/test-gate.md): `pnpm test:cov` ghi coverage/coverage-summary.json,
    // scripts/ci/coverage-gate.sh so với ngưỡng trong scripts/ci/coverage-thresholds.txt.
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.{ts,tsx}', 'hooks/**/*.{ts,tsx}'],
      exclude: ['**/*.d.ts', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}', 'test/**'],
      reporter: ['text-summary', 'json-summary'],
    },
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
})
