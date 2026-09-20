<template>
  <div class="nav-item dropdown" @focusout="handleFocusOut" @keydown.esc.stop.prevent="closeMenu">
    <button
      :id="triggerId"
      ref="trigger"
      type="button"
      class="nav-link dropdown-toggle"
      :aria-expanded="open"
      :aria-controls="menuId"
      @click="open = !open"
    >
      {{ label }}
    </button>
    <ul v-if="open" :id="menuId" class="dropdown-menu show" :aria-labelledby="triggerId">
      <li v-for="link in links" :key="link.to">
        <NuxtLink :to="link.to" class="dropdown-item" @click="selectLink">
          {{ link.label }}
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import type { HeaderNavigationLink } from '../../types/header-navigation'

defineProps<{
  label: string
  links: HeaderNavigationLink[]
}>()
const emit = defineEmits<{ 'link-selected': [] }>()
const id = useId()
const triggerId = `navigation-dropdown-trigger-${id}`
const menuId = `navigation-dropdown-menu-${id}`
const trigger = ref<HTMLButtonElement | null>(null)
const open = ref(false)

function closeMenu() {
  open.value = false
  trigger.value?.focus()
}

function selectLink() {
  open.value = false
  emit('link-selected')
}

function handleFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (!(next instanceof Node) || !(event.currentTarget as HTMLElement).contains(next)) {
    open.value = false
  }
}
</script>
