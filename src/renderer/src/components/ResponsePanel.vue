<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Clock,
  Database,
  Copy,
  AlertTriangle,
  Loader2,
  Send,
  FileDown,
  Info,
  Trash2,
  ChevronRight,
  Terminal
} from 'lucide-vue-next'
import { useTabsStore } from '../stores/tabs'
import { useAppStore } from '../stores/app'
import { useEnvsStore } from '../stores/envs'
import CodeEditor from './CodeEditor.vue'
import { expandedConsole } from '../stores/uiState'
import { buildPayload } from '../lib/http'
import { stringifyCurl } from '../lib/curl'
import {
  formatBytes,
  formatDuration,
  formatTime,
  methodClass,
  shortUrl,
  statusClass
} from '../lib/format'
import type { CodeLang } from './CodeEditor.vue'
import type { RespSubTab } from '../../../shared/types'

const tabs = useTabsStore()
const app = useAppStore()
const envs = useEnvsStore()
const api = window.api

/** 控制台 URL 过滤关键词 */
const consoleKw = ref('')
const filteredLogs = computed(() => {
  const k = consoleKw.value.trim().toLowerCase()
  if (!k) return app.consoleLogs
  return app.consoleLogs.filter((e) => e.url.toLowerCase().includes(k) || e.method.toLowerCase().includes(k))
})

/** 把当前请求（变量解析后）复制为 cURL 命令 */
async function copyAsCurl(): Promise<void> {
  const t = tabs.activeTab
  if (!t) return
  const payload = buildPayload(t.request, {
    env: envs.activeEnv?.variables ?? [],
    globals: envs.globals
  })
  const text = stringifyCurl(t.request, payload.url, payload.headers, t.request.body)
  await navigator.clipboard.writeText(text)
  app.toast('已复制为 cURL 命令', 'success')
}

const TABS: Array<{ value: RespSubTab; label: string }> = [
  { value: 'pretty', label: '美化' },
  { value: 'raw', label: '原始' },
  { value: 'preview', label: '预览' },
  { value: 'request', label: '请求' },
  { value: 'headers', label: '响应头' },
  { value: 'cookies', label: 'Cookie' }
]

const respTab = computed({
  get: () => tabs.activeTab?.respTab ?? 'pretty',
  set: (v: RespSubTab) => {
    if (tabs.activeTab) tabs.activeTab.respTab = v
  }
})

const bodyText = computed(() => tabs.activeTab?.response?.bodyText ?? null)

/** 只要能解析成 JSON 就按 JSON 处理（不依赖 Content-Type） */
const parsedJson = computed<unknown>(() => {
  const t = bodyText.value
  if (!t) return undefined
  try {
    return JSON.parse(t)
  } catch {
    return undefined
  }
})

const isJson = computed(() => {
  const r = tabs.activeTab?.response
  if (!r) return false
  return r.contentType.includes('json') || parsedJson.value !== undefined
})

const prettyText = computed(() => {
  const t = bodyText.value
  if (!t) return ''
  if (parsedJson.value !== undefined) {
    try {
      return JSON.stringify(parsedJson.value, null, 2)
    } catch {
      return t
    }
  }
  return t
})

const bodyLang = computed<CodeLang>(() => {
  const r = tabs.activeTab?.response
  if (!r) return 'text'
  const ct = r.contentType
  if (ct.includes('json') || parsedJson.value !== undefined) return 'json'
  if (ct.includes('html')) return 'html'
  if (ct.includes('xml')) return 'xml'
  if (ct.includes('javascript')) return 'javascript'
  return 'text'
})

const isHtml = computed(() => !!tabs.activeTab?.response?.contentType.includes('html'))
const isImage = computed(() => !!tabs.activeTab?.response?.contentType.startsWith('image/'))
const imgSrc = computed(() => {
  const r = tabs.activeTab?.response
  if (!r?.bodyBase64) return ''
  return `data:${r.contentType};base64,${r.bodyBase64}`
})

const cookies = computed(() => {
  const r = tabs.activeTab?.response
  if (!r) return []
  const out: Array<{ name: string; value: string; attrs: string }> = []
  for (const h of r.headers) {
    if (h.key.toLowerCase() !== 'set-cookie') continue
    for (const line of h.value.split('\n')) {
      const [pair, ...attrs] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq < 0) continue
      out.push({ name: pair.slice(0, eq).trim(), value: pair.slice(eq + 1).trim(), attrs: attrs.join(';').trim() })
    }
  }
  return out
})

const headerCount = computed(() => tabs.activeTab?.response?.headers.length ?? 0)

async function copyBody(): Promise<void> {
  const r = tabs.activeTab?.response
  if (!r?.bodyText) {
    app.toast('二进制内容暂不支持复制', 'info')
    return
  }
  await navigator.clipboard.writeText(r.bodyText)
  app.toast('已复制响应内容', 'success')
}

async function copySentUrl(url: string): Promise<void> {
  await navigator.clipboard.writeText(url)
  app.toast('已复制 URL', 'success')
}

async function saveBody(): Promise<void> {
  const r = tabs.activeTab?.response
  if (!r) return
  const ext = isJson.value ? 'json' : isHtml.value ? 'html' : isImage.value ? 'png' : 'txt'
  const path = await api.pickSavePath({
    title: '保存响应内容',
    defaultName: `response.${ext}`,
    filters: [{ name: '所有文件', extensions: ['*'] }]
  })
  if (!path) return
  await api.writeFile({
    path,
    content: r.bodyBase64 ?? btoa(unescape(encodeURIComponent(r.bodyText ?? ''))),
    encoding: 'base64'
  })
  app.toast('已保存响应内容', 'success')
}

/* ---- 控制台视图 ---- */
function consoleDetail(e: (typeof app.consoleLogs)[number]): string {
  return JSON.stringify(
    {
      时间: e.at,
      请求头: e.requestHeaders,
      响应头: e.responseHeaders,
      响应大小: formatBytes(e.size),
      ...(e.scriptError ? { 脚本错误: e.scriptError } : {}),
      ...(e.scriptLogs?.length ? { 脚本输出: e.scriptLogs.map((l) => `[${l.level}] ${l.text}`) } : {}),
      ...(e.error ? { 错误: e.error } : {})
    },
    null,
    2
  )
}
</script>

<template>
  <div class="resp-area">
    <!-- 视图切换：响应结果 / 控制台 -->
    <div class="resp-viewbar">
      <div class="view-seg">
        <button :class="{ active: !app.consoleOpen }" @click="app.consoleOpen = false">响应结果</button>
        <button :class="{ active: app.consoleOpen }" @click="app.consoleOpen = true">
          控制台
          <span v-if="app.consoleLogs.length" class="seg-count">{{ app.consoleLogs.length }}</span>
        </button>
      </div>
      <input
        v-if="app.consoleOpen"
        v-model="consoleKw"
        class="input console-filter"
        spellcheck="false"
        placeholder="按 URL / 方法过滤…"
      />
      <span style="flex: 1" />
      <template v-if="!app.consoleOpen">
        <button
          v-if="tabs.activeTab"
          class="icon-btn"
          title="复制为 cURL 命令（变量已解析）"
          @click="copyAsCurl"
        >
          <Terminal :size="14" />
        </button>
        <button v-if="tabs.activeTab?.response" class="icon-btn" title="复制响应内容" @click="copyBody">
          <Copy :size="14" />
        </button>
        <button v-if="tabs.activeTab?.response" class="icon-btn" title="保存响应到文件" @click="saveBody">
          <FileDown :size="15" />
        </button>
      </template>
      <button v-else class="icon-btn" title="清空控制台" @click="app.consoleLogs = []">
        <Trash2 :size="14" />
      </button>
    </div>

    <!-- 控制台视图 -->
    <div v-if="app.consoleOpen" class="console-view selectable">
      <template v-if="filteredLogs.length">
        <template v-for="e in filteredLogs" :key="e.id">
          <div
            class="console-row"
            @click="expandedConsole.has(e.id) ? expandedConsole.delete(e.id) : expandedConsole.add(e.id)"
          >
            <ChevronRight
              :size="12"
              style="transition: transform 0.12s; flex: none"
              :style="{ transform: expandedConsole.has(e.id) ? 'rotate(90deg)' : '' }"
            />
            <span style="font-size: 11px; flex: none">{{ formatTime(e.at) }}</span>
            <span class="chip method-chip" style="width: 50px; font-size: 10px" :class="methodClass(e.method)">
              {{ e.method }}
            </span>
            <span class="curl">{{ shortUrl(e.url) }}</span>
            <span :class="statusClass(e.status)" style="flex: none; font-weight: 600">
              {{ e.status ?? '失败' }}
            </span>
            <span style="flex: none; font-size: 11px">{{ formatDuration(e.durationMs) }}</span>
          </div>
          <div v-if="expandedConsole.has(e.id)" class="console-detail">
            <pre>{{ consoleDetail(e) }}</pre>
          </div>
        </template>
      </template>
      <div v-else class="empty-center">
        {{ app.consoleLogs.length ? '没有匹配的日志' : '暂无网络日志，发送一个请求试试' }}
      </div>
    </div>

    <!-- 响应视图 -->
    <template v-else>
      <!-- 前置脚本错误横幅 -->
      <div v-if="tabs.activeTab?.scriptError" class="script-warn">
        <AlertTriangle :size="14" />
        <span class="selectable">
          前置脚本执行失败，请求未发送：<b>{{ tabs.activeTab.scriptError }}</b>
        </span>
      </div>

      <!-- 请求中 -->
      <div v-if="tabs.activeTab?.sending" class="empty-center">
        <Loader2 :size="22" class="spin" style="color: var(--accent)" />
        <span class="big">请求发送中…</span>
      </div>

      <!-- 空状态 -->
      <div v-else-if="!tabs.activeTab?.response" class="empty-center">
        <Send :size="24" style="opacity: 0.4" />
        <span class="big">点击「发送」或按 Ctrl+Enter 查看响应</span>
        <span>响应内容将显示在这里</span>
      </div>

      <template v-else-if="tabs.activeTab">
        <!-- 错误卡片 -->
        <div v-if="tabs.activeTab.response.error && tabs.activeTab.response.errorCode !== 'ERR_CANCELED'" class="error-card">
          <h4><AlertTriangle :size="15" /> 请求失败</h4>
          <p>{{ tabs.activeTab.response.error }}</p>
          <p v-if="tabs.activeTab.response.errorCode">
            错误代码 <span class="code-tag">{{ tabs.activeTab.response.errorCode }}</span>
            <span class="code-tag" style="margin-left: 6px">耗时 {{ formatDuration(tabs.activeTab.response.timeMs) }}</span>
          </p>
        </div>

        <template v-else>
          <div class="resp-head">
            <span class="status-chip" :class="statusClass(tabs.activeTab.response.status)">
              <span class="dot" :class="tabs.activeTab.response.ok ? 'ok' : 'warn'" />
              {{ tabs.activeTab.response.status }}
              <span style="font-family: inherit; font-weight: 500; color: var(--text-2)">
                {{ tabs.activeTab.response.statusText }}
              </span>
            </span>
            <span class="meta-chip"><Clock :size="12" /> {{ formatDuration(tabs.activeTab.response.timeMs) }}</span>
            <span class="meta-chip"><Database :size="12" /> {{ formatBytes(tabs.activeTab.response.size) }}</span>
            <span v-if="tabs.activeTab.response.truncated" class="meta-chip" style="color: var(--amber)">
              <Info :size="12" /> 内容过大已截断显示
            </span>
            <span class="spacer" />
          </div>

          <div class="resp-tabs">
            <button
              v-for="t in TABS"
              :key="t.value"
              class="req-tab"
              :class="{ active: respTab === t.value }"
              @click="respTab = t.value"
            >
              {{ t.label }}
              <span v-if="t.value === 'headers' && headerCount" class="count">{{ headerCount }}</span>
              <span v-if="t.value === 'cookies' && cookies.length" class="count">{{ cookies.length }}</span>
            </button>
          </div>

          <div class="resp-body">
            <!-- 响应体 -->
            <template v-if="respTab === 'pretty' || respTab === 'raw'">
              <div v-if="tabs.activeTab.response.bodyText === null" class="empty-center">
                <Send :size="20" style="opacity: 0.4" />
                <span class="big">二进制内容无法以文本显示</span>
                <button class="btn btn-outline btn-sm" @click="saveBody">
                  <FileDown :size="13" />
                  保存到文件
                </button>
              </div>
              <CodeEditor v-else-if="respTab === 'pretty'" :model-value="prettyText" :language="bodyLang" readonly />
              <CodeEditor v-else :model-value="tabs.activeTab.response.bodyText" :language="bodyLang" readonly />
            </template>

            <!-- 预览 -->
            <iframe
              v-else-if="respTab === 'preview' && isHtml"
              class="preview-frame"
              sandbox=""
              :srcdoc="tabs.activeTab.response.bodyText ?? ''"
            />
            <div v-else-if="respTab === 'preview' && isImage" class="img-preview">
              <img :src="imgSrc" alt="响应图片预览" />
            </div>
            <div v-else-if="respTab === 'preview'" class="empty-center">
              <Info :size="20" style="opacity: 0.4" />
              <span class="big">该内容类型暂不支持预览</span>
              <span class="mono" style="font-size: 11px">{{ tabs.activeTab.response.contentType || '未知类型' }}</span>
            </div>

            <!-- 实际发送的请求 -->
            <template v-else-if="respTab === 'request'">
              <div v-if="!tabs.activeTab.sentReq" class="empty-center">暂无发送记录</div>
              <div v-else class="sent-wrap selectable">
                <div class="sent-url-row">
                  <span class="chip method-chip" :class="methodClass(tabs.activeTab.sentReq.method)">
                    {{ tabs.activeTab.sentReq.method }}
                  </span>
                  <span class="sent-url mono">{{ tabs.activeTab.sentReq.url }}</span>
                  <button class="icon-btn" title="复制 URL" @click="copySentUrl(tabs.activeTab.sentReq.url)">
                    <Copy :size="14" />
                  </button>
                </div>
                <div class="sent-note">以下为变量解析、鉴权与前置脚本处理后的最终请求</div>
                <div class="hdr-table">
                  <div v-for="h in tabs.activeTab.sentReq.headers" :key="h.key" class="hdr-row">
                    <span class="hdr-key">{{ h.key }}</span>
                    <span class="hdr-val">{{ h.value }}</span>
                  </div>
                  <div v-if="!tabs.activeTab.sentReq.headers.length" class="empty-center" style="padding: 14px">
                    无请求头
                  </div>
                </div>
              </div>
            </template>

            <!-- 响应头 -->
            <template v-else-if="respTab === 'headers'">
              <div v-if="!tabs.activeTab.response.headers.length" class="empty-center">无响应头</div>
              <div v-else class="hdr-table selectable">
                <div v-for="h in tabs.activeTab.response.headers" :key="h.key" class="hdr-row">
                  <span class="hdr-key">{{ h.key }}</span>
                  <span class="hdr-val">{{ h.value }}</span>
                </div>
              </div>
            </template>

            <!-- Cookie -->
            <template v-else-if="respTab === 'cookies'">
              <div v-if="!cookies.length" class="empty-center">响应中没有 Cookie</div>
              <div v-else class="cookie-list">
                <div v-for="(c, i) in cookies" :key="i" class="cookie-row">
                  <span class="cookie-name">{{ c.name }}={{ c.value }}</span>
                  <span class="cookie-attrs">{{ c.attrs }}</span>
                </div>
              </div>
            </template>
          </div>
        </template>
      </template>
    </template>
  </div>
</template>
