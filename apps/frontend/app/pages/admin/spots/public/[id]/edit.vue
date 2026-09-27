<template><SpotAdminEditor kind="public" :spot-id="String(route.params.id ?? '')" /></template>
<script setup lang="ts">
const route = useRoute()
</script>
