export default defineNuxtConfig({
  devtools: { enabled: true },
  css: [
    'bootstrap/dist/css/bootstrap.min.css',
    'quill/dist/quill.snow.css',
    'quill/dist/quill.bubble.css',
    '~/assets/styles/theme.css',
    '~/assets/styles/mobile-drawer.css',
  ],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:3001/api',
    },
  },
})
