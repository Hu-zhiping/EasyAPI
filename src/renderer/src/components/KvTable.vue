<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { X, Plus } from 'lucide-vue-next'
import type { KV } from '../../../shared/types'

const props = withDefaults(
  defineProps<{
    rows: KV[]
    showDesc?: boolean
    keyPh?: string
    valPh?: string
    descPh?: string
  }>(),
  { showDesc: true, keyPh: '键', valPh: '值', descPh: '描述' }
)

const bulkOpen = ref(false)
const bulkText = ref('')

// 始终保证至少有一个可编辑的空行（首次打开、切换标签页时同样生效）
watch(
  () => props.rows,
  (rows) => {
    if (rows && rows.length === 0) pushEmpty()
  },
  { immediate: true }
)

const gridCols = computed(() =>
  props.showDesc
    ? '34px minmax(0, 1fr) minmax(0, 1.35fr) minmax(0, 1fr) 30px'
    : '34px minmax(0, 1fr) minmax(0, 1.35fr) 30px'
)

function applyBulk(): void {
  const parsed: KV[] = bulkText.value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const idx = l.indexOf(':')
      const key = idx >= 0 ? l.slice(0, idx).trim() : l
      const value = idx >= 0 ? l.slice(idx + 1).trim() : ''
      return { id: crypto.randomUUID(), key, value, enabled: true, desc: '' }
    })
  // 按 key 保留原有行的启用状态与描述，避免批量编辑丢失信息
  const merged = parsed.map((p) => {
    if (!p.key) return p
    const prev = props.rows.find((r) => r.key === p.key)
    return prev ? { ...p, enabled: prev.enabled, desc: prev.desc ?? '' } : p
  })
  props.rows.splice(0, props.rows.length, ...merged)
  if (!props.rows.length) pushEmpty()
  bulkOpen.value = false
}

function pushEmpty(): void {
  props.rows.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true, desc: '' })
}

function del(i: number): void {
  props.rows.splice(i, 1)
  if (!props.rows.length) pushEmpty()
}
</script>

<template>
  <div class="kv-area">
    <!-- 批量编辑入口置于表格右上角 -->
    <div class="kv-head-bar">
      <button class="link-btn" @click="bulkOpen = !bulkOpen">
        {{ bulkOpen ? '返回表格编辑' : '批量编辑' }}
      </button>
      <span v-if="rows.length > 1" class="kv-count">{{ rows.length }} 行</span>
    </div>

    <div v-if="!bulkOpen" class="kv-grid" :style="{ '--kv-cols': gridCols }">
      <div class="kv-thead">
        <span class="c-check" />
        <span class="c-col">{{ keyPh }}</span>
        <span class="c-col">{{ valPh }}</span>
        <span v-if="showDesc" class="c-col">{{ descPh }}</span>
        <span class="c-act" />
      </div>

      <div v-for="(r, i) in rows" :key="r.id" class="kv-tr" :class="{ off: !r.enabled }">
        <span class="c-check">
          <input v-model="r.enabled" type="checkbox" :title="r.enabled ? '停用该行' : '启用该行'" />
        </span>
        <span class="kv-cell">
          <input v-model="r.key" class="bare mono" spellcheck="false" :placeholder="keyPh" />
        </span>
        <span class="kv-cell">
          <input v-model="r.value" class="bare mono" spellcheck="false" :placeholder="valPh" />
        </span>
        <span v-if="showDesc" class="kv-cell">
          <input v-model="r.desc" class="bare" spellcheck="false" :placeholder="descPh" />
        </span>
        <span class="c-act">
          <button class="icon-btn" title="删除该行" @click="del(i)">
            <X :size="13" />
          </button>
        </span>
      </div>

      <button class="kv-add" @click="pushEmpty">
        <Plus :size="13" />
        添加
      </button>
    </div>

    <template v-else>
      <textarea
        v-model="bulkText"
        class="kv-bulk"
        placeholder="每行一条，格式：key:value&#10;示例：Accept: application/json"
      />
      <div class="kv-toolbar">
        <button class="btn btn-primary btn-sm" @click="applyBulk">应用</button>
        <button class="btn btn-ghost btn-sm" @click="bulkOpen = false">取消</button>
      </div>
    </template>
  </div>
</template>
