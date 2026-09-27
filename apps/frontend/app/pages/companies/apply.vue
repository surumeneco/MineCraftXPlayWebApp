<template><CompanyEditor :source-id="sourceId" /></template>
<script setup lang="ts">
const route=useRoute()
const sourceId=computed(()=>typeof route.query.source==='string'?route.query.source:undefined)
</script>
