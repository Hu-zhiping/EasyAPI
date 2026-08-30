<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppTitleBar from './components/AppTitleBar.vue'
import ActivityBar from './components/ActivityBar.vue'
import AppSidebar from './components/AppSidebar.vue'
import TabBar from './components/TabBar.vue'
import RequestBar from './components/RequestBar.vue'
import RequestTabs from './components/RequestTabs.vue'
import ResponsePanel from './components/ResponsePanel.vue'
import StatusBar from './components/StatusBar.vue'
import WelcomeState from './components/WelcomeState.vue'
import ToastHost from './components/ToastHost.vue'
import ContextMenu from './components/ContextMenu.vue'
import ModalHost from './components/modals/ModalHost.vue'
import { useAppStore } from './stores/app'
import { useTabsStore } from './stores/tabs'
import { useCollectionsStore } from './stores/collections'
import { useEnvsStore } from './stores/envs'
import { useHistoryStore } from './stores/history'

const app = useAppStore()
const tabs = useTabsStore()
const cols = useCollectionsStore()
const envs = useEnvsStore()
const history = useHistoryStore()

const hydrated = ref(false)
/** 浏览器中直接打开渲染页面时（无 preload 注入）给出友好提示 */
const apiMissing = ref(false)

onMounted(async () => {
  if (!(window as { api?: unknown }).api) {
    apiMissing.value = true
    return
  }
  const data = await window.api.loadStore()
  app.hydrate(data)
  envs.hydrate(data)
  cols.hydrate(data)
  history.hydrate(data)
  tabs.hydrateSession(data.sessionTabs ?? [])
  const info = await window.api.appInfo()
  app.version = info.version
  hydrated.value = true
})

// 窗口标题跟随激活标签页
watch(
  () => tabs.activeTab?.title,
  (t) => {
    if (!(window as { api?: unknown }).api) return
    window.api.setWindowTitle(t ? `EasyAPI - ${t}` : 'EasyAPI')
  },
  { immediate: true }
)

/* ---------- 响应区分隔条拖拽 ---------- */
let splitTop = 0
let splitBottom = 0

function onSplitMove(e: MouseEvent): void {
  const span = splitBottom - splitTop
  if (span <= 0) return
  const ratio = (e.clientY - splitTop) / span
  app.updateSettings({ splitRatio: Math.min(0.85, Math.max(0.12, ratio)) })
}

function onSplitUp(): void {
  document.removeEventListener('mousemove', onSplitMove)
  document.removeEventListener('mouseup', onSplitUp)
  document.body.style.cursor = ''
}

function startSplit(): void {
  const area = document.querySelector('.editor-response-area')
  const editor = document.querySelector('.editor-area')
  if (!area || !editor) return
  // 以编辑区顶部（参数/请求头标签栏之下）为基准，避免把标签栏高度算进比例
  splitTop = editor.getBoundingClientRect().top
  splitBottom = area.getBoundingClientRect().bottom
  document.body.style.cursor = 'row-resize'
  document.addEventListener('mousemove', onSplitMove)
  document.addEventListener('mouseup', onSplitUp)
}

/* ---------- 全局快捷键 ---------- */
function onKeydown(e: KeyboardEvent): void {
  const ctrl = e.ctrlKey || e.metaKey
  if (!ctrl) return
  const key = e.key.toLowerCase()
  if (key === 'enter') {
    e.preventDefault()
    tabs.sendActive()
  } else if (key === 's') {
    e.preventDefault()
    tabs.saveActive(false)
  } else if (key === 't') {
    e.preventDefault()
    tabs.newTab()
  } else if (key === 'n') {
    e.preventDefault()
    tabs.newTab()
  } else if (key === 'w') {
    e.preventDefault()
    if (tabs.activeId) tabs.closeTab(tabs.activeId)
  } else if (e.key === 'Tab') {
    e.preventDefault()
    if (tabs.tabs.length > 1) {
      const idx = tabs.tabs.findIndex((t) => t.id === tabs.activeId)
      tabs.activeId = tabs.tabs[(idx + 1) % tabs.tabs.length].id
    }
  } else if (key === ',') {
    e.preventDefault()
    app.modal = { type: 'settings' }
  } else if (e.shiftKey && key === 'c') {
    e.preventDefault()
    app.consoleOpen = !app.consoleOpen
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div v-if="apiMissing" class="browser-fallback">
    <div class="bf-card">
      <h2>请在 EasyAPI 桌面应用中打开</h2>
      <p>当前页面是 EasyAPI 的界面资源，需要 Electron 环境才能运行。</p>
      <p>请启动桌面应用（<code>npm run dev</code> 或安装后的 EasyAPI）。</p>
    </div>
  </div>
  <div v-else class="app-root">
    <AppTitleBar />
    <div class="app-body">
      <ActivityBar />
      <AppSidebar />
      <main class="main-area">
        <template v-if="tabs.tabs.length">
          <TabBar />
          <RequestBar />
          <div class="editor-response-area">
            <RequestTabs />
            <div class="splitter" @mousedown="startSplit" />
            <ResponsePanel />
          </div>
        </template>
        <WelcomeState v-else />
      </main>
    </div>
    <StatusBar />
    <ModalHost />
    <ContextMenu />
    <ToastHost />
  </div>
</template>

<style>
.editor-response-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.browser-fallback {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
.bf-card {
  max-width: 420px;
  padding: 28px 32px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--bg-panel);
  text-align: center;
}
.bf-card h2 {
  margin: 0 0 10px;
  font-size: 16px;
}
.bf-card p {
  margin: 6px 0;
  font-size: 12.5px;
  color: var(--text-2);
  line-height: 1.7;
}
.bf-card code {
  font-family: Consolas, monospace;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 3px;
  padding: 0 4px;
}
</style>
