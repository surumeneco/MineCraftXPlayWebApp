<template>
  <main class="page">
    <section class="card">
      <p class="eyebrow">XPlayServer</p>
      <h1>MineCraftXPlayWebApp</h1>
      <p>Nuxt.js フロントエンドの初期構成が起動しています。</p>
    </section>
  </main>
</template>

<style>
:root {
  color-scheme: light dark;
  font-family: system-ui, sans-serif;
}

body {
  margin: 0;
}

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 2rem;
  box-sizing: border-box;
}

.card {
  max-width: 48rem;
}

.eyebrow {
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 1rem;
}
</style>
