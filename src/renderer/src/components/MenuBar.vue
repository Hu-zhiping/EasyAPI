<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import type { Component } from 'vue'
import {
  Code2,
  Cookie,
  Copy,
  Download,
  FilePlus,
  Globe,
  Info,
  Maximize,
  Minimize,
  Save,
  Settings,
  Sun,
  Terminal,
  Upload,
  X
} from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { useTabsStore } from '../stores/tabs'
import { useCollectionsStore } from '../stores/collections'
import { useEnvsStore } from '../stores/envs'

interface MenuItem {
  label?: string
  hint?: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  sep?: boolean
  action?: () => void
}

const app = useAppStore()
const tabs = useTabsStore()
const cols = useCollectionsStore()
const envs = useEnvsStore()
const api = window.api

const ICONS: Record<string, Component> = {
  'file-plus': FilePlus,
  save: Save,
  copy: Copy,
  upload: Upload,
  download: Download,
  close: X,
  sun: Sun,
  terminal: Terminal,
  settings: Settings,
  globe: Globe,
  code: Code2,
  cookie: Cookie,
  min: Minimize,
  max: Maximize,
  info: Info
}

async function exportAll(): Promise<void> {
  const path = await api.pickSavePath({
    title: '导出全部数据',
    defaultName: 'easyapi-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!path) return
  const data = {
    exportedAt: new Date().toISOString(),
    collections: JSON.parse(JSON.stringify(cols.collections)),
    environments: JSON.parse(JSON.stringify(envs.environments)),
    globals: JSON.parse(JSON.stringify(envs.globals)),
    activeEnvId: envs.activeEnvId,
    settings: app.settings
  }
  await api.writeFile({ path, content: JSON.stringify(data, null, 2) })
  app.toast('数据已导出', 'success')
}

function genCode(): void {
  const t = tabs.activeTab
  if (!t) {
    app.toast('没有打开的请求标签页', 'info')
    return
  }
  app.modal = { type: 'codegen', tabId: t.id }
}

function about(): void {
  app.modal = {
    type: 'confirm',
    title: '关于 EasyAPI',
    message: `EasyAPI v${app.version} — 轻量、精致的桌面 API 调试工具。\n无需登录，所有数据均保存在本机。\n\n常用快捷键：\nCtrl+Enter 发送请求    Ctrl+S 保存    Ctrl+T 新建标签页\nCtrl+W 关闭标签页    Ctrl+Shift+C 控制台    Ctrl+, 设置`,
    confirmText: '好的',
    onOk: () => {}
  }
}

const MENUS: Array<{ label: string; items: MenuItem[] }> = [
  {
    label: '文件',
    items: [
      { label: '新建请求', icon: 'file-plus', hint: 'Ctrl+T', action: () => tabs.newTab() },
      { sep: true },
      { label: '保存', icon: 'save', hint: 'Ctrl+S', action: () => tabs.saveActive(false) },
      { label: '另存为…', icon: 'copy', action: () => tabs.saveActive(true) },
      { sep: true },
      { label: '导入…', icon: 'upload', action: () => (app.modal = { type: 'import' }) },
      { label: '导出全部数据…', icon: 'download', action: () => void exportAll() },
      { sep: true },
      { label: '退出', icon: 'close', action: () => api.winClose() }
    ]
  },
  {
    label: '视图',
    items: [
      {
        label: '切换深浅主题',
        icon: 'sun',
        action: () => app.updateSettings({ theme: app.settings.theme === 'dark' ? 'light' : 'dark' })
      },
      {
        label: '网络控制台',
        icon: 'terminal',
        hint: 'Ctrl+Shift+C',
        action: () => (app.consoleOpen = !app.consoleOpen)
      }
    ]
  },
  {
    label: '工具',
    items: [
      { label: '设置', icon: 'settings', hint: 'Ctrl+,', action: () => (app.modal = { type: 'settings' }) },
      { label: '管理环境变量…', icon: 'globe', action: () => (app.modal = { type: 'env', envId: null }) },
      { label: 'Cookie 管理…', icon: 'cookie', action: () => (app.modal = { type: 'cookies' }) },
      { label: '生成代码…', icon: 'code', action: genCode }
    ]
  },
  {
    label: '窗口',
    items: [
      { label: '最小化', icon: 'min', action: () => api.winMinimize() },
      { label: '最大化 / 还原', icon: 'max', action: () => api.winToggleMaximize() },
      { sep: true },
      { label: '关闭', icon: 'close', hint: 'Alt+F4', action: () => api.winClose() }
    ]
  },
  {
    label: '帮助',
    items: [{ label: '关于 EasyAPI', icon: 'info', action: about }]
  }
]

const openIndex = ref(-1)
const x = ref(0)
const y = ref(0)
const menuEl = ref<HTMLElement | null>(null)
const btnRefs = new Map<number, HTMLElement>()

function setBtnRef(i: number): (el: unknown) => void {
  return (el) => {
    if (el) btnRefs.set(i, el as HTMLElement)
    else btnRefs.delete(i)
  }
}

async function open(i: number): Promise<void> {
  openIndex.value = i
  await nextTick()
  const btn = btnRefs.get(i)
  if (!btn) return
  const r = btn.getBoundingClientRect()
  x.value = r.left
  y.value = r.bottom + 2
  await nextTick()
  if (!menuEl.value) return
  const mw = menuEl.value.offsetWidth
  if (x.value + mw > window.innerWidth - 8) x.value = window.innerWidth - 8 - mw
}

function toggle(i: number): void {
  if (openIndex.value === i) close()
  else void open(i)
}

function hover(i: number): void {
  if (openIndex.value >= 0 && openIndex.value !== i) void open(i)
}

function close(): void {
  openIndex.value = -1
}

function run(item: MenuItem): void {
  if (item.disabled) return
  close()
  item.action?.()
}

function onDocMousedown(e: MouseEvent): void {
  if (openIndex.value < 0) return
  const t = e.target as Node
  if (menuEl.value?.contains(t)) return
  for (const btn of btnRefs.values()) if (btn.contains(t)) return
  close()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && openIndex.value >= 0) close()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMousedown, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="menubar">
    <button
      v-for="(m, i) in MENUS"
      :key="m.label"
      :ref="setBtnRef(i)"
      class="menubar-btn"
      :class="{ open: openIndex === i }"
      @click="toggle(i)"
      @mouseenter="hover(i)"
    >
      {{ m.label }}
    </button>
  </div>

  <Teleport to="body">
    <div v-if="openIndex >= 0" ref="menuEl" class="ctx-menu menu-drop" :style="{ left: x + 'px', top: y + 'px' }">
      <template v-for="(it, j) in MENUS[openIndex].items" :key="j">
        <div v-if="it.sep" class="ctx-divider" />
        <div v-else class="ctx-item" :class="{ danger: it.danger, disabled: it.disabled }" @click="run(it)">
          <component :is="ICONS[it.icon ?? '']" v-if="it.icon && ICONS[it.icon]" :size="14" />
          <span>{{ it.label }}</span>
          <span v-if="it.hint" class="ctx-hint">{{ it.hint }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.menubar {
  display: flex;
  align-items: center;
  gap: 1px;
  margin-left: 12px;
  height: 100%;
  -webkit-app-region: no-drag;
}
.menubar-btn {
  height: 24px;
  padding: 0 10px;
  border: none;
  background: transparent;
  border-radius: 5px;
  color: var(--text-2);
  font-size: 12.5px;
  cursor: pointer;
  transition: background 0.1s, color 0.1s;
}
.menubar-btn:hover,
.menubar-btn.open {
  background: var(--bg-hover);
  color: var(--text);
}
</style>
