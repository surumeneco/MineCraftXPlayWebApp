import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@test-utils': fileURLToPath(new URL('../../test-utils/index.ts', import.meta.url)),
    },
  },
  test: {
    projects: [
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['test/**/*.{test,spec}.ts'],
          exclude: ['test/**/*.e2e.spec.ts'],
          environment: 'nuxt',
        },
      }),
    ],
  },
})
