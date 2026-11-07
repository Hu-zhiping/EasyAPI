import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { ConsoleEntry, CookieItem, RequestDef, Settings } from '../../../shared/types'
import { watchPersist } from './persist'

export type ModalState =
  | { type: 'save-request'; tabId: string }
  | { type: 'input'; title: string; label: string; initial: string; confirmText: string; danger?: boolean; onOk: (v: string) => void }
  | { type: 'env'; envId: string | null }
  | { type: 'import' }
  | { type: 'codegen'; tabId?: string; request?: RequestDef }
  | { type: 'settings' }
  | { type: 'cookies' }
  | { type: 'confirm'; title: string; message: string; confirmText: string; danger?: boolean; onOk: () => void }

export interface ContextMenuItem {
  label: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  action?: () => void
}

export interface ToastItem {
  id: string
  type: 'success' | 'error' | 'info'
  text: string
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  timeoutMs: 30000,
  followRedirects: true,
  sslVerify: true,
  saveHistory: true,
  historyLimit: 100,
  sidebarWidth: 264,
  splitRatio: 0.46,
  closeToTray: false
}

export const useAppStore = defineStore('app', () => {
  const settings = ref<Settings>({ ...DEFAULT_SETTINGS })
  const ready = ref(false)
  const version = ref('1.0.0')
  /** 运行平台（来自主进程，用于平台相关 UI 分支） */
  const platform = ref('win32')
  /** 是否已启用开机自启（真实状态来自系统登录项） */
  const launchAtStartup = ref(false)
  /** 侧边栏当前面板（跨组件共享，便于菜单/导入等场景切换） */
  const sidebarNav = ref<'collections' | 'envs' | 'history'>('collections')

  const modal = ref<ModalState | null>(null)
  const contextMenu = ref<{ x: number; y: number; items: ContextMenuItem[] } | null>(null)
  const toasts = ref<ToastItem[]>([])

  const consoleOpen = ref(false)
  const consoleLogs = ref<ConsoleEntry[]>([])
  const cookies = ref<CookieItem[]>([])

  function applyTheme(): void {
    document.documentElement.dataset['theme'] = settings.value.theme
  }

  function toast(text: string, type: ToastItem['type'] = 'info'): void {
    const id = crypto.randomUUID()
    toasts.value.push({ id, type, text })
    setTimeout(() => {
      toasts.value = toasts.value.filter((t) => t.id !== id)
    }, 2600)
  }

  function openContextMenu(x: number, y: number, items: ContextMenuItem[]): void {
    contextMenu.value = { x, y, items }
  }

  function closeContextMenu(): void {
    contextMenu.value = null
  }

  function pushConsole(e: ConsoleEntry): void {
    consoleLogs.value.unshift(e)
    if (consoleLogs.value.length > 200) consoleLogs.value.pop()
  }

  /** 合并响应 Set-Cookie：按 域+名 去重；expiresAt<=0 表示服务端要求删除 */
  function mergeCookies(items: CookieItem[]): void {
    const now = Date.now()
    const map = new Map<string, CookieItem>()
    for (const c of cookies.value) {
      if (c.expiresAt !== undefined && c.expiresAt <= now) continue
      map.set(c.domain + '\u0000' + c.name, c)
    }
    for (const c of items) {
      const key = c.domain + '\u0000' + c.name
      if (c.expiresAt !== undefined && c.expiresAt <= 0) map.delete(key)
      else map.set(key, c)
    }
    cookies.value = [...map.values()]
  }

  function removeCookie(id: string): void {
    cookies.value = cookies.value.filter((c) => c.id !== id)
  }

  function clearCookies(): void {
    cookies.value = []
  }

  function hydrate(data: { settings?: Partial<Settings>; cookies?: CookieItem[] }): void {
    settings.value = { ...DEFAULT_SETTINGS, ...(data.settings ?? {}) }
    cookies.value = data.cookies ?? []
    applyTheme()
  }

  function updateSettings(patch: Partial<Settings>): void {
    settings.value = { ...settings.value, ...patch }
    applyTheme()
  }

  watchPersist(() => settings.value, 'settings')
  watchPersist(() => cookies.value, 'cookies')

  return {
    settings,
    ready,
    version,
    platform,
    launchAtStartup,
    sidebarNav,
    modal,
    contextMenu,
    toasts,
    consoleOpen,
    consoleLogs,
    cookies,
    applyTheme,
    toast,
    openContextMenu,
    closeContextMenu,
    pushConsole,
    mergeCookies,
    removeCookie,
    clearCookies,
    hydrate,
    updateSettings
  }
})
