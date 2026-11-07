<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ChevronDown, Loader2, Save, Send } from 'lucide-vue-next'
import { METHODS, type Method } from '../../../shared/types'
import { useTabsStore } from '../stores/tabs'
import { useEnvsStore } from '../stores/envs'
import { useHistoryStore } from '../stores/history'
import PopSelect from './PopSelect.vue'
import { METHOD_COLORS, methodClass, shortUrl, titleFromUrl } from '../lib/format'
import { queryEquals, syncParamsFromUrl } from '../lib/http'
import { DYNAMIC_VAR_NAMES } from '../lib/interpolate'

const tabs = useTabsStore()
const envs = useEnvsStore()
const history = useHistoryStore()

const methodOptions = METHODS.map((m) => ({ value: m as string, label: m, color: METHOD_COLORS[m] }))

/** 最近发送过的 URL，用于输入建议 */
const urlHints = computed(() => [...new Set(history.entries.map((e) => e.url))].slice(0, 15))

/** URL 为空时的快捷入口：最近发送的方法 + URL（去重取前 5） */
const recentChips = computed(() => {
  const seen = new Set<string>()
  const out: Array<{ method: string; url: string }> = []
  for (const e of history.entries) {
    if (!e.url || seen.has(e.url)) continue
    seen.add(e.url)
    out.push({ method: e.method, url: e.url })
    if (out.length >= 5) break
  }
  return out
})
const showRecentChips = computed(
  () => !!tabs.activeTab && !tabs.activeTab.request.url.trim() && recentChips.value.length > 0
)

const saveDirty = computed(() => (tabs.activeTab ? tabs.isDirty(tabs.activeTab) : false))

/* ---- URL 变量高亮：{{var}} 按可解析性着色（叠加层方案） ---- */
interface UrlSeg {
  text: string
  kind: 'plain' | 'var-ok' | 'var-miss'
}
const urlSegments = computed<UrlSeg[]>(() => {
  const url = tabs.activeTab?.request.url ?? ''
  const segs: UrlSeg[] = []
  const re = /\{\{\s*([\w$.]+)\s*\}\}/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(url))) {
    if (m.index > last) segs.push({ text: url.slice(last, m.index), kind: 'plain' })
    const name = m[1]
    const ok = name.startsWith('$') ? DYNAMIC_VAR_NAMES.has(name) : envs.resolve(name) !== null
    segs.push({ text: m[0], kind: ok ? 'var-ok' : 'var-miss' })
    last = m.index + m[0].length
  }
  if (last < url.length) segs.push({ text: url.slice(last), kind: 'plain' })
  return segs
})

const overlayEl = ref<HTMLDivElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)

/** 输入框横向滚动时同步叠加层，保证着色文字与光标对齐 */
function syncOverlay(): void {
  if (overlayEl.value && inputEl.value) overlayEl.value.scrollLeft = inputEl.value.scrollLeft
}

function onUrlInput(e: Event): void {
  const tab = tabs.activeTab
  if (!tab) return
  const v = (e.target as HTMLInputElement).value
  applyUrlValue(tab, v)
  void nextTick(syncOverlay)
}

function applyUrlValue(tab: NonNullable<ReturnType<typeof useTabsStore>['activeTab']>, v: string): void {
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

/** 点击最近请求芯片：填入 URL 与方法 */
function useChip(method: string, url: string): void {
  const tab = tabs.activeTab
  if (!tab) return
  tab.request.method = (METHODS.includes(method as Method) ? method : 'GET') as Method
  applyUrlValue(tab, url)
  void nextTick(() => {
    syncOverlay()
    inputEl.value?.focus()
  })
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
    <div class="reqbar-row">
      <div class="reqbar-group">
        <PopSelect v-model="tabs.activeTab.request.method" :options="methodOptions">
          <template #trigger="{ option }">
            <div class="method-select-trigger" :style="{ color: METHOD_COLORS[(option?.value ?? 'GET') as Method] }">
              <span class="mst-text">{{ option?.label ?? 'GET' }}</span>
              <ChevronDown :size="13" class="mst-caret" />
            </div>
          </template>
        </PopSelect>

        <div class="url-wrap">
          <!-- 变量高亮叠加层：与输入框同字体同内边距，文字透明由叠加层着色 -->
          <div ref="overlayEl" class="url-overlay" aria-hidden="true">
            <span
              v-for="(s, i) in urlSegments"
              :key="i"
              class="url-seg"
              :class="s.kind"
            >{{ s.text }}</span>
          </div>
          <input
            ref="inputEl"
            class="url-input"
            :value="tabs.activeTab.request.url"
            spellcheck="false"
            placeholder="输入请求 URL，如 https://api.example.com/users"
            list="easyapi-url-history"
            @input="onUrlInput"
            @scroll="syncOverlay"
            @keydown.enter="send"
          />
          <datalist id="easyapi-url-history">
            <option v-for="u in urlHints" :key="u" :value="u" />
          </datalist>
        </div>
      </div>

      <button
        v-if="tabs.activeTab.sending"
        class="btn btn-outline send-btn sending"
        title="请求进行中，点击取消"
        @click="send"
      >
        <Loader2 :size="14" class="spin" />
        取消
      </button>
      <button v-else class="btn btn-primary send-btn" title="发送请求（Ctrl+Enter）" @click="send">
        <Send :size="14" />
        发送
      </button>

      <button
        class="icon-btn save-btn"
        :class="{ dirty: saveDirty }"
        :title="saveDirty ? '有未保存的修改，点击保存（另存为：菜单「文件」或右键标签页）' : '保存请求（Ctrl+S）'"
        @click="save"
      >
        <Save :size="15" />
      </button>
    </div>

    <!-- 最近请求快捷芯片：URL 为空时出现 -->
    <div v-if="showRecentChips" class="url-chips">
      <span class="url-chips-label">最近</span>
      <button v-for="h in recentChips" :key="h.url" class="url-chip" @click="useChip(h.method, h.url)">
        <span class="chip method-chip" :class="methodClass(h.method)">{{ h.method }}</span>
        <span class="mono">{{ shortUrl(h.url) }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.mst-text {
  letter-spacing: 0.5px;
}
.mst-caret {
  opacity: 0.65;
}
/* 保存按钮：常态低调图标钮，有未保存修改时点亮 */
.save-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
}
.save-btn.dirty {
  color: var(--accent);
  background: var(--accent-soft);
}
.save-btn.dirty:hover {
  background: var(--accent-soft);
}
/* URL 高亮叠加层：与 .url-input 严格同字体/内边距，随输入框横向滚动 */
.url-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  padding: 0 12px;
  font-size: 13px;
  font-family: inherit;
  white-space: pre;
  overflow: hidden;
  pointer-events: none;
  color: var(--text);
}
.url-seg.var-ok {
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 3px;
}
.url-seg.var-miss {
  color: var(--danger);
  background: var(--danger-soft);
  border-radius: 3px;
  box-shadow: 0 1px 0 var(--danger);
}
/* 半透明选区：让叠加层的着色文字透出来 */
.url-input::selection {
  background: color-mix(in srgb, var(--accent) 30%, transparent);
}
/* 最近请求芯片 */
.url-chips {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  width: 100%;
}
.url-chips-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text-3);
  margin-right: 2px;
}
.url-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 9px 0 4px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--bg-elev);
  color: var(--text-2);
  font-size: 11.5px;
  cursor: pointer;
  max-width: 240px;
  overflow: hidden;
  transition: border-color 0.12s, color 0.12s;
}
.url-chip:hover {
  border-color: var(--accent);
  color: var(--text);
}
.url-chip span:last-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.url-chip .method-chip {
  width: 44px;
  font-size: 9.5px;
  height: 15px;
  flex: none;
}
</style>
