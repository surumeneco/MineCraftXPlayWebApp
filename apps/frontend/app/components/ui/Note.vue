<template>
  <small class="xplay-note"><slot>{{ text }}</slot></small>
</template>

<script setup lang="ts">
defineProps<{ text?: string }>()
</script>
