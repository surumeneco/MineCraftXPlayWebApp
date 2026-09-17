<script setup lang="ts">
import { ref } from 'vue'
import type { HeaderNavigationItem } from '../../types/header-navigation'

withDefaults(defineProps<{
  items?: HeaderNavigationItem[]
}>(), {
  items: () => [],
})

const openCategory = ref<number | null>(null)

function toggleCategory(index: number) {
  openCategory.value = openCategory.value === index ? null : index
}
</script>

<template>
  <header class="sticky-top border-bottom bg-body">
    <div class="container d-flex flex-wrap align-items-center gap-3 py-3">
      <slot name="logo">
        <span class="fs-3 fw-bold">ここにロゴ</span>
      </slot>

      <nav class="navbar p-0" aria-label="メインナビゲーション">
        <ul class="navbar-nav flex-row flex-wrap gap-2">
          <li v-for="(item, index) in items" :key="item.label" class="nav-item">
            <div v-if="item.children?.length" class="dropdown position-relative">
              <button
                type="button"
                class="btn btn-outline-secondary dropdown-toggle"
                :aria-expanded="openCategory === index"
                @click="toggleCategory(index)"
              >
                {{ item.label }}
              </button>
              <ul v-if="openCategory === index" class="dropdown-menu show position-absolute start-0 mt-1">
                <li v-for="child in item.children" :key="child.to">
                  <NuxtLink :to="child.to" class="dropdown-item" @click="openCategory = null">
                    {{ child.label }}
                  </NuxtLink>
                </li>
              </ul>
            </div>
            <NuxtLink v-else-if="item.to" :to="item.to" class="btn btn-outline-secondary">
              {{ item.label }}
            </NuxtLink>
          </li>
        </ul>
      </nav>
    </div>
  </header>
</template>
