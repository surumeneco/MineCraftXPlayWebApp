<template>
  <section>
    <UiPageTitle title="申請管理" />
    <div class="row g-3">
      <div class="col-md-6 col-xl-4">
        <NuxtLink to="/admin/territories" class="card h-100 text-decoration-none text-body">
          <div class="card-body">
            <h2 class="h5 card-title">領地承認</h2>
            <p class="card-text text-body-secondary mb-0">未承認の領地申請を確認・審査します。</p>
          </div>
        </NuxtLink>
      </div>
      <div class="col-md-6 col-xl-4"><NuxtLink to="/admin/companies" class="card h-100 text-decoration-none text-body"><div class="card-body"><h2 class="h5 card-title">企業承認</h2><p class="card-text text-body-secondary mb-0">未承認の企業申請を確認・審査します。</p></div></NuxtLink></div>
    </div>
  </section>
</template>
<script setup lang="ts">
const auth = useAccountSession()
onMounted(async () => {
  await auth.refresh()
  if (!auth.isAdmin.value) await navigateTo('/')
})
</script>
