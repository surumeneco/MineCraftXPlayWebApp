<script setup lang="ts">
import type { HeaderNavigationItem } from '../../types/header-navigation'

withDefaults(defineProps<{
  items?: HeaderNavigationItem[]
}>(), {
  items: () => [],
})
</script>

<template>
  <header class="border-bottom">
    <div class="container d-flex flex-wrap align-items-center gap-3 py-3">
      <slot name="logo">
        <span class="fs-3 fw-bold">ここにロゴ</span>
      </slot>

      <nav aria-label="メインナビゲーション">
        <ul class="list-unstyled d-flex flex-wrap gap-2 mb-0">
          <li v-for="item in items" :key="item.label">
            <details v-if="item.children?.length" class="position-relative">
              <summary class="btn btn-outline-secondary">{{ item.label }}</summary>
              <ul class="list-unstyled position-absolute start-0 z-3 mt-1 mb-0 p-2 border rounded bg-body shadow-sm">
                <li v-for="child in item.children" :key="child.to">
                  <NuxtLink :to="child.to" class="d-block px-2 py-1 text-nowrap">
                    {{ child.label }}
                  </NuxtLink>
                </li>
              </ul>
            </details>
            <NuxtLink v-else-if="item.to" :to="item.to" class="btn btn-outline-secondary">
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>
</template>
