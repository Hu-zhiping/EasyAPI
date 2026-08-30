<script setup lang="ts">
import { computed, watch } from 'vue'
import { X, FileText, Plus } from 'lucide-vue-next'
import type { FormField } from '../../../shared/types'
import { fileName } from '../lib/format'

const props = defineProps<{ rows: FormField[] }>()
const api = window.api

// 始终保证至少有一个可编辑的空行
watch(
  () => props.rows,
  (rows) => {
    if (rows && rows.length === 0) pushEmpty()
  },
  { immediate: true }
)

const gridCols = '34px minmax(0, 1fr) 104px minmax(0, 1.3fr) minmax(0, 1fr) 30px'

function pushEmpty(): void {
  props.rows.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true, desc: '', type: 'text' })
}

function del(i: number): void {
  props.rows.splice(i, 1)
  if (!props.rows.length) pushEmpty()
}

async function pickFile(row: FormField): Promise<void> {
  const p = await api.pickFile({ title: '选择文件' })
  if (!p) return
  row.type = 'file'
  row.value = p
  if (!row.key) row.key = fileName(p)
}
</script>

<template>
  <div class="kv-area">
    <div class="kv-grid" :style="{ '--kv-cols': gridCols }">
      <div class="kv-thead">
        <span class="c-check" />
        <span class="c-col">键</span>
        <span class="c-col">类型</span>
        <span class="c-col">值</span>
        <span class="c-col">描述</span>
        <span class="c-act" />
      </div>

      <div v-for="(r, i) in rows" :key="r.id" class="kv-tr" :class="{ off: !r.enabled }">
        <span class="c-check">
          <input v-model="r.enabled" type="checkbox" :title="r.enabled ? '停用该行' : '启用该行'" />
        </span>
        <span class="kv-cell">
          <input v-model="r.key" class="bare mono" spellcheck="false" placeholder="键" />
        </span>
        <span class="kv-cell">
          <select v-model="r.type" class="bare-select">
            <option value="text">文本</option>
            <option value="file">文件</option>
          </select>
        </span>
        <span v-if="r.type === 'text'" class="kv-cell">
          <input v-model="r.value" class="bare mono" spellcheck="false" placeholder="值" />
        </span>
        <span v-else class="kv-cell">
          <button class="file-link" title="选择文件" @click="pickFile(r)">
            <FileText :size="13" />
            <span class="fname">{{ r.value ? fileName(r.value) : '点击选择文件…' }}</span>
          </button>
        </span>
        <span class="kv-cell">
          <input v-model="r.desc" class="bare" spellcheck="false" placeholder="描述" />
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

    <div class="kv-foot">
      <span style="font-size: 11px; color: var(--text-3)">文件类型字段将随请求以 multipart/form-data 发送</span>
    </div>
  </div>
</template>
