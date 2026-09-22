export default defineNuxtConfig({
  devtools: { enabled: true },
  app: {
    head: {
      htmlAttrs: { "data-bs-theme": "dark" },
      // Bootstrap Icons icon font: supports icon names without a hand-maintained SVG list.
      link: [
        {
          rel: "stylesheet",
          href: "https://cdn.jsdelivr.net/npm/bootstrap-icons@1.13.1/font/bootstrap-icons.min.css",
        },
      ],
    },
  },
  css: [
    "bootstrap/dist/css/bootstrap.min.css",
    "quill/dist/quill.snow.css",
    "quill/dist/quill.bubble.css",
    "~/assets/styles/theme.scss",
    "~/assets/styles/mobile-drawer.scss",
    "~/assets/styles/quill-dark-ui.scss",
    "~/assets/styles/control-states.scss",
    "~/assets/styles/theme-adapters.scss",
  ],
  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE ?? "http://localhost:3001/api",
    },
  },
});
