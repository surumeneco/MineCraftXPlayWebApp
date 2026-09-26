<template>
  <section aria-labelledby="applications-heading">
    <UiPageTitle id="applications-heading" title="申請" />
    <p v-if="!layout && (status === 'pending' || status === 'idle')" role="status">カードを読み込んでいます…</p>
    <p v-else-if="error && !layout" role="alert">カードを取得できませんでした。</p>
    <nav v-else-if="layout" aria-label="申請ページ一覧" class="row g-3">
      <div v-for="hub in hubs" :key="hub.key" class="col-md-6 col-xl-4">
        <HomeCard :card="{ id: hub.key, type: 'hub', hub_key: hub.key }"
          :hubs="layout.data.hubs" :links="layout.links" />
      </div>
    </nav>
  </section>
</template>

<script setup lang="ts">
const { data: layout, status, error } = useHomeLayout()
const hubs = computed(() => layout.value?.data.hubs.filter(hub =>
  layout.value!.links.some(link => link.key === hub.key && link.group === 'applications')) ?? [])
</script>
