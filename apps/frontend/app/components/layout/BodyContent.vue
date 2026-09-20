<template>
  <div class="container py-4">
    <div class="row g-4">
      <div class="col-12 col-lg-3 d-none d-lg-block">
        <LayoutSideMenu />
      </div>

      <main class="col-12 col-lg-9">
        <UiPanel>
          <slot />
        </UiPanel>
      </main>
    </div>
  </div>
</template>
