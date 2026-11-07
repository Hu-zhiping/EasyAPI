<script setup lang="ts">
import { computed, watch } from 'vue'
import { useTabsStore } from '../stores/tabs'
import { useAppStore } from '../stores/app'
import KvTable from './KvTable.vue'
import BodyEditor from './BodyEditor.vue'
import AuthEditor from './AuthEditor.vue'
import ScriptEditor from './ScriptEditor.vue'
import TestsEditor from './TestsEditor.vue'
import { queryEquals, setUrlQuery, resolveAutoHeaders } from '../lib/http'
import type { ReqSubTab } from '../../../shared/types'

const tabs = useTabsStore()
const app = useAppStore()

const autoHeaders = computed(() =>
  tabs.activeTab ? resolveAutoHeaders(tabs.activeTab.request) : []
)

const SUB_TABS: Array<{ value: ReqSubTab; label: string }> = [
  { value: 'params', label: 'Params' },
  { value: 'headers', label: 'Headers' },
  { value: 'body', label: 'Body' },
  { value: 'auth', label: 'Authorization' },
  { value: 'pre', label: 'Pre-request Script' },
  { value: 'tests', label: 'Tests' }
]

const testBadge = computed(() => {
  const r = tabs.activeTab?.testResults
  if (!r || !r.length) return ''
  return `${r.filter((x) => x.passed).length}/${r.length}`
})

const editorHeight = computed(() => `${Math.round(app.settings.splitRatio * 100)}%`)

function count(name: 'params' | 'headers'): number {
  const t = tabs.activeTab
  if (!t) return 0
  return t.request[name].filter((r) => r.enabled && r.key).length
}

function bodyLabel(): string {
  const t = tabs.activeTab
  if (!t || t.request.body.mode === 'none') return ''
  return t.request.body.mode
}

function authLabel(): string {
  const t = tabs.activeTab
  if (!t || t.request.auth.type === 'none') return ''
  return { bearer: 'Bearer', basic: 'Basic', apikey: 'API Key' }[t.request.auth.type] ?? ''
}

// 参数表 → URL 双向同步（参数表编辑时写回 URL）
watch(
  () => tabs.activeTab?.request.params,
  () => {
    const t = tabs.activeTab
    if (!t) return
    if (!queryEquals(t.request.params, t.request.url)) {
      t.request.url = setUrlQuery(t.request.url, t.request.params)
    }
  },
  { deep: true }
)
</script>

<template>
  <!-- 多根组件：.editor-area 必须是 .editor-response-area 的直接子元素，百分比高度才能正确解析 -->
  <div v-if="tabs.activeTab" class="req-tabs">
    <button
      v-for="s in SUB_TABS"
      :key="s.value"
      class="req-tab"
      :class="{ active: tabs.activeTab.subTab === s.value }"
      @click="tabs.activeTab.subTab = s.value"
    >
      {{ s.label }}
      <span v-if="s.value === 'params' && count('params')" class="count">{{ count('params') }}</span>
      <span v-if="s.value === 'headers' && count('headers')" class="count">{{ count('headers') }}</span>
        <span v-if="s.value === 'body' && bodyLabel()" class="mode-label">{{ bodyLabel() }}</span>
        <span v-if="s.value === 'auth' && authLabel()" class="mode-label">{{ authLabel() }}</span>
        <span v-if="s.value === 'pre' && tabs.activeTab.request.preScript" class="mode-label">JS</span>
        <span
          v-if="s.value === 'tests' && testBadge"
          class="mode-label test-badge"
          :class="tabs.activeTab.testResults?.every((x) => x.passed) ? 'ok' : 'fail'"
        >
          {{ testBadge }}
        </span>
      </button>
    <span class="req-tabs-spacer" />
  </div>

  <div v-if="tabs.activeTab" class="editor-area" :style="{ height: editorHeight }">
    <div class="editor-scroll">
        <KvTable
          v-if="tabs.activeTab.subTab === 'params'"
          :rows="tabs.activeTab.request.params"
          key-ph="参数名"
          val-ph="参数值"
        />
        <div v-else-if="tabs.activeTab.subTab === 'headers'" class="headers-pane">
          <div v-if="autoHeaders.length" class="auto-headers">
            <div class="auto-headers-title">以下请求头由 Body / 授权配置自动生成，发送时生效</div>
            <div v-for="h in autoHeaders" :key="h.key + h.value" class="auto-header-row">
              <span class="auto-badge">自动</span>
              <span class="mono auto-key">{{ h.key }}</span>
              <span class="mono auto-val">{{ h.value }}</span>
            </div>
          </div>
          <KvTable
            :rows="tabs.activeTab.request.headers"
            key-ph="请求头名称"
            val-ph="请求头值"
          />
        </div>
        <BodyEditor v-else-if="tabs.activeTab.subTab === 'body'" />
      <AuthEditor v-else-if="tabs.activeTab.subTab === 'auth'" />
      <ScriptEditor v-else-if="tabs.activeTab.subTab === 'pre'" />
      <TestsEditor v-else-if="tabs.activeTab.subTab === 'tests'" />
    </div>
  </div>
</template>
