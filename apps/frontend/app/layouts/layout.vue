<template>
  <div class="d-flex min-vh-100 flex-column">
    <LayoutHeaderMenu />

    <LayoutBodyContent class="flex-grow-1">
      <slot />
    </LayoutBodyContent>

    <LayoutFooter />
  </div>
</template>
