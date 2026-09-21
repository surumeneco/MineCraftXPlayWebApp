import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@test-utils': fileURLToPath(new URL('../../test-utils/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.{test,spec}.ts'],
    setupFiles: ['test/setup-notice-notification.ts'],
  },
})
