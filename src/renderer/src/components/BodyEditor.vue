<script setup lang="ts">
import { Braces, FileText } from 'lucide-vue-next'
import { computed } from 'vue'
import type { BodyMode, RawLanguage } from '../../../shared/types'
import { useTabsStore } from '../stores/tabs'
import { useAppStore } from '../stores/app'
import { resolveAutoHeaders } from '../lib/http'
import KvTable from './KvTable.vue'
import FormTable from './FormTable.vue'
import CodeEditor from './CodeEditor.vue'
import PopSelect from './PopSelect.vue'

const tabs = useTabsStore()
const app = useAppStore()

/** 当前 Body 类型对应的自动 Content-Type（用户手动设置过则不显示） */
const autoCt = computed(() => {
  const tab = tabs.activeTab
  if (!tab) return ''
  return resolveAutoHeaders(tab.request).find((h) => h.key.toLowerCase() === 'content-type')?.value ?? ''
})

const MODES: Array<{ value: BodyMode; label: string }> = [
  { value: 'none', label: 'none' },
  { value: 'form-data', label: 'form-data' },
  { value: 'urlencoded', label: 'x-www-form-urlencoded' },
  { value: 'raw', label: 'raw' },
  { value: 'binary', label: 'binary' }
]

const LANGS = [
  { value: 'json', label: 'JSON' },
  { value: 'text', label: 'Text' },
  { value: 'xml', label: 'XML' },
  { value: 'html', label: 'HTML' },
  { value: 'javascript', label: 'JavaScript' }
]

const api = window.api

function formatJson(): void {
  const tab = tabs.activeTab
  if (!tab) return
  try {
    tab.request.body.rawContent = JSON.stringify(JSON.parse(tab.request.body.rawContent), null, 2)
  } catch (e) {
    app.toast('JSON 格式错误：' + (e instanceof Error ? e.message : String(e)), 'error')
  }
}

async function pickBinary(): Promise<void> {
  const tab = tabs.activeTab
  if (!tab) return
  const p = await api.pickFile({ title: '选择二进制文件' })
  if (p) tab.request.body.binaryPath = p
}
</script>

<template>
  <div v-if="tabs.activeTab" class="body-pane">
    <div class="body-toolbar">
      <div class="body-mode-seg">
        <button
          v-for="m in MODES"
          :key="m.value"
          :class="{ active: tabs.activeTab.request.body.mode === m.value }"
          @click="tabs.activeTab.request.body.mode = m.value"
        >
          {{ m.label }}
        </button>
      </div>
      <template v-if="tabs.activeTab.request.body.mode === 'raw'">
        <PopSelect v-model="tabs.activeTab.request.body.rawLanguage" :options="LANGS" />
        <button v-if="tabs.activeTab.request.body.rawLanguage === 'json'" class="btn btn-ghost btn-sm" @click="formatJson">
          <Braces :size="13" />
          格式化 JSON
        </button>
      </template>
      <span v-if="autoCt" class="auto-ct mono">
        {{ autoCt }}
        <i>自动</i>
      </span>
    </div>

    <FormTable
      v-if="tabs.activeTab.request.body.mode === 'form-data'"
      :rows="tabs.activeTab.request.body.form"
    />
    <KvTable
      v-else-if="tabs.activeTab.request.body.mode === 'urlencoded'"
      :rows="tabs.activeTab.request.body.urlencoded"
      key-ph="键"
      val-ph="值"
    />
    <div v-else-if="tabs.activeTab.request.body.mode === 'binary'">
      <div class="binary-card">
        <FileText :size="16" />
        <template v-if="tabs.activeTab.request.body.binaryPath">
          <span class="mono" style="flex: 1; overflow: hidden; text-overflow: ellipsis">
            {{ tabs.activeTab.request.body.binaryPath }}
          </span>
          <button class="btn btn-ghost btn-sm" @click="tabs.activeTab.request.body.binaryPath = ''">清除</button>
        </template>
        <template v-else>
          <span style="flex: 1">选择一个文件，以二进制内容发送</span>
          <button class="btn btn-outline btn-sm" @click="pickBinary">选择文件</button>
        </template>
      </div>
    </div>
    <div v-else-if="tabs.activeTab.request.body.mode === 'raw'" class="code-host raw-host">
      <CodeEditor
        v-model="tabs.activeTab.request.body.rawContent"
        :language="tabs.activeTab.request.body.rawLanguage as RawLanguage"
      />
    </div>
    <div v-else class="empty-center" style="height: 140px">
      <span>此请求没有请求体</span>
    </div>
  </div>
</template>

<style scoped>
/* 面板根节点：撑满编辑区可用高度（父级 .editor-scroll 为确定高度的滚动容器） */
.body-pane {
  display: flex;
  flex-direction: column;
  min-height: 100%;
}
/* raw 编辑器：填满剩余高度，替代原先写死的 220px */
.raw-host {
  flex: 1;
  min-height: 200px;
  margin: 8px 14px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
</style>
