export default defineNuxtConfig({
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { 'data-bs-theme': 'dark' },
    },
  },
  css: [
    'bootstrap/dist/css/bootstrap.min.css',
    'quill/dist/quill.snow.css',
    'quill/dist/quill.bubble.css',
    '~/assets/styles/theme.scss',
    '~/assets/styles/mobile-drawer.scss',
    '~/assets/styles/quill-dark-ui.scss',
    '~/assets/styles/control-states.scss',
    '~/assets/styles/theme-adapters.scss',
  ],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001/api',
    },
  },
})
