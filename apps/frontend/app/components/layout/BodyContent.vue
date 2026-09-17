<template>
  <div class="container py-4">
    <div class="row g-4">
      <div class="col-12 col-lg-3">
        <LayoutSideMenu />
      </div>

      <main class="col-12 col-lg-9">
        <slot />
      </main>
    </div>
  </div>
</template>
