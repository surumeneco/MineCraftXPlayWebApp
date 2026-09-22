<template>
  <!-- Only a registered Bootstrap Icons class creates a ::before glyph. An unknown name has no visible fallback. -->
  <span v-if="validName" class="bi" :class="`bi-${name}`" aria-hidden="true" />
</template>

<script setup lang="ts">
import type { BootstrapIconName } from '../../types/bootstrap-icon'

const props = defineProps<{ name: BootstrapIconName }>()
// Keep a user-provided name from injecting additional classes or selectors.
const validName = computed(() => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(props.name))
</script>

<style scoped>
/* The pseudo-element is a flex item; absent glyphs leave no empty flex item or gap. */
.bi { display: contents; }
:global(.account-menu__button .bi::before) { font-size: 23px; }
</style>
