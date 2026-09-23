<template>
  <NoticeAdminEditor :notice-id="noticeId" />
</template>

<script setup lang="ts">
const route = useRoute()
const noticeId = computed(() => String(route.params.id ?? ''))

useHead({ title: 'お知らせ編集' })
</script>
