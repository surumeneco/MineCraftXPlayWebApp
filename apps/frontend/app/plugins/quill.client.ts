export default defineNuxtPlugin(() => ({
  provide: {
    loadQuill: async () => (await import('quill')).default,
  },
}))
