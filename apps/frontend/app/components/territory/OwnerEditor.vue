<template>
  <section class="border rounded p-3 my-4" aria-labelledby="territory-owner-editor-heading">
    <h2 id="territory-owner-editor-heading" class="h5">所有者の変更（管理者）</h2>
    <p class="small text-body-secondary">申請者履歴は変更しません。承認済み領地に限り、所有者を直接変更します。</p>
    <form @submit.prevent="save">
      <label class="form-label" :for="kindId">所有者種別</label>
      <select :id="kindId" v-model="kind" class="form-select mb-3">
        <option value="account">参加者アカウント</option>
        <option value="shared_area">共同建築エリア</option>
        <option value="administration">運営</option>
        <option value="protected_area">保護区</option>
      </select>
      <div v-if="kind === 'account'" class="mb-3">
        <label class="form-label" :for="searchId">参加者名で検索</label>
        <input :id="searchId" v-model="search" class="form-control" type="search" maxlength="100" autocomplete="off"
          placeholder="参加者名を入力" />
        <div v-if="accounts.length" class="list-group mt-2" role="group" aria-label="所有者候補">
          <label v-for="candidate in accounts" :key="candidate.id" class="list-group-item d-flex align-items-center gap-2">
            <input v-model="accountId" type="radio" :value="candidate.id" name="territory-owner-candidate" />
            <span>{{ candidate.name }}</span>
            <span v-if="candidate.id === territory.owner.account_id" class="small text-body-secondary">現在の所有者</span>
          </label>
        </div>
        <p v-else-if="!searchLoading" class="small text-body-secondary mt-2">該当する参加者はありません。</p>
        <p v-if="searchLoading" role="status" class="small mt-2">参加者を検索しています…</p>
      </div>
      <p v-if="error" class="alert alert-danger">{{ error }}</p>
      <button type="submit" class="btn btn-primary" :disabled="busy || searchLoading || !changed || (kind === 'account' && !accountId)">
        {{ busy ? '保存しています…' : '所有者を変更' }}
      </button>
    </form>
  </section>
</template>
<script setup lang="ts">
import type { TerritoryOwnerType, TerritoryRecord } from '../../utils/territory'
import { userFacingError } from '../../utils/user-error'
const props = defineProps<{ territory: TerritoryRecord }>()
const emit = defineEmits<{ updated: [] }>()
const { get, mutate } = useAccountApi()
const kind = ref<TerritoryOwnerType>(props.territory.owner.type)
const accountId = ref<string | null>(props.territory.owner.account_id)
const search = ref(props.territory.owner.type === 'account' ? props.territory.owner.name : '')
const accounts = ref<Array<{ id: string; name: string }>>([])
const searchLoading = ref(false), busy = ref(false), error = ref('')
const kindId = useId(), searchId = useId()
const changed = computed(() => kind.value !== props.territory.owner.type ||
  (kind.value === 'account' && accountId.value !== props.territory.owner.account_id))
let searchVersion = 0
async function loadAccounts() {
  const version = ++searchVersion
  searchLoading.value = true
  try {
    const result = await get<Array<{ id: string; name: string }>>(
      `/admin/territories/owners?name=${encodeURIComponent(search.value)}`)
    if (version === searchVersion) accounts.value = result
  } catch (cause) {
    if (version === searchVersion) error.value = userFacingError(cause)
  } finally {
    if (version === searchVersion) searchLoading.value = false
  }
}
watch(search, () => {
  accountId.value = null
  void loadAccounts()
})
watch(() => props.territory.owner, owner => {
  kind.value = owner.type
  accountId.value = owner.account_id
  search.value = owner.type === 'account' ? owner.name : ''
}, { deep: true })
onMounted(() => { void loadAccounts() })
async function save() {
  if (!changed.value || (kind.value === 'account' && !accountId.value)) return
  busy.value = true
  error.value = ''
  try {
    await mutate(`/admin/territories/${props.territory.id}/owner`, 'POST', {
      operation_id: crypto.randomUUID(),
      owner_type: kind.value,
      owner_account_id: kind.value === 'account' ? accountId.value : null,
    })
    emit('updated')
  } catch (cause) {
    error.value = userFacingError(cause)
  } finally {
    busy.value = false
  }
}
</script>
