<template>
  <footer class="border-top bg-body">
    <div class="container py-4 text-center">
      <a class="btn btn-link mb-3" href="#page-top">ページの先頭に戻る</a>

      <div class="row justify-content-center g-4 mb-3">
        <nav class="col-6" aria-label="外部リンク">
          <h2 class="h6">外部リンク</h2>
          <ul class="list-unstyled mb-0">
            <li v-for="link in externalLinks" :key="link.href">
              <a
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                class="link-body-emphasis d-inline-flex align-items-center justify-content-center gap-1 flex-wrap"
              >
                <UiBootstrapIcon v-if="link.icon" :name="link.icon" />
                <span>{{ link.label }}</span>
                <UiBootstrapIcon name="box-arrow-up-right" />
              </a>
            </li>
          </ul>
        </nav>

        <nav class="col-6" aria-label="内部リンク">
          <h2 class="h6">内部リンク</h2>
          <ul class="list-unstyled mb-0">
            <li v-for="link in internalLinks" :key="link.to">
              <NuxtLink :to="link.to" class="link-body-emphasis d-inline-flex align-items-center justify-content-center gap-1 flex-wrap">
                <UiBootstrapIcon v-if="link.icon" :name="link.icon" />
                <span>{{ link.label }}</span>
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </div>

      <small class="text-body-secondary"
        >© {{ currentYear }} {{ copyrightHolder }}</small
      >
    </div>
  </footer>
</template>

<script setup lang="ts">
import type {
  FooterExternalLink,
  FooterInternalLink,
} from '../../types/footer-links'

withDefaults(
  defineProps<{
    externalLinks?: FooterExternalLink[]
    internalLinks?: FooterInternalLink[]
    copyrightHolder?: string
  }>(),
  {
    externalLinks: () => [],
    internalLinks: () => [],
    copyrightHolder: 'surumeneco',
  },
)

const currentYear = new Date().getFullYear()
</script>
