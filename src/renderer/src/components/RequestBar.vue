<script setup lang="ts">
import { computed } from 'vue'
import { Play, Save, Square } from 'lucide-vue-next'
import { METHODS, type Method } from '../../../shared/types'
import { useTabsStore } from '../stores/tabs'
import { useHistoryStore } from '../stores/history'
import PopSelect from './PopSelect.vue'
import { METHOD_COLORS, titleFromUrl } from '../lib/format'
import { queryEquals, syncParamsFromUrl } from '../lib/http'

const tabs = useTabsStore()
const history = useHistoryStore()

const methodOptions = METHODS.map((m) => ({ value: m as string, label: m, color: METHOD_COLORS[m] }))

/** 最近发送过的 URL，用于输入建议 */
const urlHints = computed(() => [...new Set(history.entries.map((e) => e.url))].slice(0, 15))

const saveDirty = computed(() => (tabs.activeTab ? tabs.isDirty(tabs.activeTab) : false))

function onUrlInput(e: Event): void {
  const tab = tabs.activeTab
  if (!tab) return
  const v = (e.target as HTMLInputElement).value
  tab.request.url = v
  if (!queryEquals(tab.request.params, v)) {
    tab.request.params = syncParamsFromUrl(tab.request.params, v)
  }
  // 未保存的标签页标题跟随 URL 自动命名（手动重命名过则不覆盖）
  if (!tab.savedRef && (tab.title === '未命名请求' || tab.autoNamed)) {
    tab.title = titleFromUrl(v)
    tab.autoNamed = true
  }
}

function send(): void {
  const tab = tabs.activeTab
  if (!tab) return
  if (tab.sending) tabs.cancel(tab.id)
  else void tabs.send(tab.id)
}

function save(): void {
  tabs.saveActive(false)
}
</script>

<template>
  <div v-if="tabs.activeTab" class="reqbar">
    <PopSelect :model-value="tabs.activeTab.request.method" :options="methodOptions">
      <template #trigger="{ option }">
        <div class="method-select-trigger" :style="{ color: METHOD_COLORS[(option?.value ?? 'GET') as Method] }">
          {{ option?.label ?? 'GET' }}
          <ChevronDown :size="13" style="opacity: 0.55" />
        </div>
      </template>
    </PopSelect>

    <input
      class="url-input mono"
      :value="tabs.activeTab.request.url"
      spellcheck="false"
      placeholder="输入请求 URL，如 https://api.example.com/users"
      list="easyapi-url-history"
      @input="onUrlInput"
      @keydown.enter="send"
    />
    <datalist id="easyapi-url-history">
      <option v-for="u in urlHints" :key="u" :value="u" />
    </datalist>

    <button v-if="tabs.activeTab.sending" class="btn btn-outline send-btn" style="color: var(--danger)" @click="send">
      <Square :size="13" />
      取消
    </button>
    <button v-else class="btn btn-primary send-btn" title="Ctrl+Enter" @click="send">
      <Play :size="14" />
      发送
    </button>

    <button class="btn btn-ghost save-btn" :title="saveDirty ? '有未保存的修改' : '保存（另存为：菜单「文件」或右键标签页）'" @click="save">
      <Save :size="14" />
      保存
      <i v-if="saveDirty" class="save-dirty" />
    </button>
  </div>
</template>

<style scoped>
.save-btn {
  position: relative;
}
.save-dirty {
  position: absolute;
  top: 4px;
  right: 5px;
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
}
</style>
