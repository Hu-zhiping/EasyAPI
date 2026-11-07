import { app, BrowserWindow, Menu, MenuItemConstructorOptions, nativeImage, screen, shell, Tray } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { WindowState } from '../shared/types'
import { TITLEBAR_OVERLAY } from '../shared/titlebar'
import { DataStore } from './store'
import { registerRequestHandlers } from './requestEngine'
import { registerIpc } from './ipc'

let win: BrowserWindow | null = null
let store: DataStore
let tray: Tray | null = null
/** 托盘/正常退出置 true，用于区分「关闭到托盘」与真正退出 */
let quitting = false

/** Linux 无原生标题栏叠加能力，退回自绘窗口按钮 */
const useNativeControls = process.platform !== 'linux'

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

/* ---------- 窗口状态记忆 ---------- */

/** Chrome 风格的缩放档位（zoomFactor） */
const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1.0, 1.1, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0]

const winState = {
  /** 最近一次「正常状态」下的窗口边界（最大化/全屏时不更新，还原时使用） */
  bounds: null as { x?: number; y?: number; width: number; height: number } | null,
  maximized: false,
  fullscreen: false,
  zoomFactor: 1,
  saveTimer: null as NodeJS.Timeout | null
}

function snapshotWindowState(): WindowState {
  const b = winState.bounds ?? win?.getBounds() ?? { width: 1280, height: 840 }
  return {
    x: b.x,
    y: b.y,
    width: b.width,
    height: b.height,
    maximized: winState.maximized,
    fullscreen: winState.fullscreen,
    zoomFactor: winState.zoomFactor
  }
}

function saveWindowState(immediate = false): void {
  if (!win) return
  if (winState.saveTimer) {
    clearTimeout(winState.saveTimer)
    winState.saveTimer = null
  }
  if (immediate) {
    store.patch({ windowState: snapshotWindowState() })
    return
  }
  winState.saveTimer = setTimeout(() => store.patch({ windowState: snapshotWindowState() }), 500)
}

/** 校验保存的位置是否仍落在某个显示器内，避免窗口恢复到屏幕外 */
function clampToDisplays(x?: number, y?: number, width?: number, height?: number): { x?: number; y?: number } {
  if (x === undefined || y === undefined) return {}
  const ok = screen.getAllDisplays().some((d) => {
    const wa = d.workArea
    return (
      x + (width ?? 0) > wa.x + 80 &&
      x < wa.x + wa.width - 80 &&
      y + (height ?? 0) > wa.y &&
      y < wa.y + wa.height - 40
    )
  })
  return ok ? { x, y } : {}
}

/* ---------- 界面缩放 ---------- */

function zoomStep(delta: 1 | -1): number {
  const cur = winState.zoomFactor
  if (delta > 0) return ZOOM_STEPS.find((z) => z > cur + 1e-6) ?? ZOOM_STEPS[ZOOM_STEPS.length - 1]
  return [...ZOOM_STEPS].reverse().find((z) => z < cur - 1e-6) ?? ZOOM_STEPS[0]
}

function applyZoom(next: number): void {
  if (next === winState.zoomFactor) return
  winState.zoomFactor = next
  win?.webContents.setZoomFactor(next)
  saveWindowState()
}

function zoomIn(): void {
  applyZoom(zoomStep(1))
}
function zoomOut(): void {
  applyZoom(zoomStep(-1))
}
function zoomReset(): void {
  applyZoom(1)
}
function toggleFullscreen(): void {
  const w = win
  if (!w) return
  w.setFullScreen(!w.isFullScreen())
}

/* ---------- 崩溃日志 ---------- */

/** 崩溃信息落盘，便于排查生产问题 */
function logCrash(kind: string, err: unknown): void {
  const message = err instanceof Error ? (err.stack ?? err.message) : String(err)
  try {
    const line = `\n[${new Date().toISOString()}] ${kind}: ${message}`
    fs.appendFileSync(path.join(app.getPath('userData'), 'easyapi-crash.log'), line)
  } catch {
    /* 日志写入失败时静默 */
  }
  console.error(`[${kind}]`, err)
}

process.on('uncaughtException', (e) => logCrash('uncaughtException', e))
process.on('unhandledRejection', (e) => logCrash('unhandledRejection', e))

/* ---------- 系统托盘 ---------- */

function trayIconPath(): string {
  // 打包后 icon.png 经 extraResources 落在 resources 根目录；开发态取项目 build 目录
  return app.isPackaged ? path.join(process.resourcesPath, 'icon.png') : path.join(__dirname, '../../build/icon.png')
}

function setLaunchAtStartup(enabled: boolean): boolean {
  // 开发态注册的是 electron 开发版可执行文件，开机自启会弹出空白窗口，禁止注册
  if (!app.isPackaged) return false
  app.setLoginItemSettings({ openAtLogin: enabled, args: ['--hidden'] })
  return app.getLoginItemSettings().openAtLogin
}

function showWindow(): void {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createTray(): void {
  if (tray) return
  const icon = nativeImage.createFromPath(trayIconPath()).resize({ width: 16, height: 16 })
  tray = new Tray(icon)
  tray.setToolTip('EasyAPI — API 调试工具')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '显示主界面', click: showWindow },
      { type: 'separator' },
      {
        label: '开机自启',
        type: 'checkbox',
        checked: app.getLoginItemSettings().openAtLogin,
        click: (item) => void setLaunchAtStartup(item.checked)
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          quitting = true
          app.quit()
        }
      }
    ])
  )
  tray.on('click', showWindow)
  tray.on('double-click', showWindow)
}

/* ---------- 原生标题栏叠加按钮配色（跟随主题） ---------- */

function overlayColors(): { color: string; symbolColor: string } {
  return TITLEBAR_OVERLAY[store.getSettings().theme]
}

function createWindow(): void {
  const st = store.load().windowState
  win = new BrowserWindow({
    width: st?.width ?? 1280,
    height: st?.height ?? 840,
    ...clampToDisplays(st?.x, st?.y, st?.width, st?.height),
    minWidth: 980,
    minHeight: 640,
    show: false,
    // 保留系统窗口框（阴影 / 贴边分屏 / 双击最大化），仅隐藏标题栏，用叠加按钮替代自绘控制按钮
    frame: !useNativeControls ? false : undefined,
    titleBarStyle: useNativeControls ? 'hidden' : undefined,
    titleBarOverlay: useNativeControls ? { ...overlayColors(), height: 36 } : undefined,
    backgroundColor: '#161618',
    title: 'EasyAPI',
    icon: app.isPackaged ? undefined : path.join(__dirname, '../../build/icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false
    }
  })

  winState.bounds = st ? { x: st.x, y: st.y, width: st.width, height: st.height } : null
  winState.maximized = st?.maximized ?? false
  winState.fullscreen = st?.fullscreen ?? false
  winState.zoomFactor = st?.zoomFactor ?? 1

  // 登录项以 --hidden 启动时直接驻留托盘，不依赖 closeToTray 设置
  const startHidden = process.argv.includes('--hidden')

  win.on('ready-to-show', () => {
    win?.webContents.setZoomFactor(winState.zoomFactor)
    if (startHidden) {
      createTray()
      return
    }
    if (winState.maximized) win?.maximize()
    if (winState.fullscreen) win?.setFullScreen(true)
    win?.show()
  })
  win.on('maximize', () => {
    winState.maximized = true
    win?.webContents.send('win:maximizedChanged', true)
    saveWindowState(true)
  })
  win.on('unmaximize', () => {
    winState.maximized = false
    win?.webContents.send('win:maximizedChanged', false)
    saveWindowState(true)
  })
  win.on('enter-full-screen', () => {
    winState.fullscreen = true
    saveWindowState(true)
  })
  win.on('leave-full-screen', () => {
    winState.fullscreen = false
    saveWindowState(true)
  })
  const trackBounds = (): void => {
    if (!win || win.isMaximized() || win.isFullScreen()) return
    winState.bounds = win.getBounds()
    saveWindowState()
  }
  win.on('resize', trackBounds)
  win.on('move', trackBounds)

  win.on('close', (e) => {
    saveWindowState(true)
    store.flushSync()
    if (!quitting && store.getSettings().closeToTray) {
      e.preventDefault()
      createTray()
      win?.hide()
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Ctrl+滚轮缩放（Chromium 原生手势），同步进档位并持久化
  win.webContents.on('zoom-changed', (_e, dir) => (dir === 'in' ? zoomIn() : zoomOut()))

  // 无边框窗口下的快捷键：F12 / Ctrl+Shift+I 打开 DevTools，Ctrl+=/-/0 缩放，F11 全屏
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    const key = input.key.toLowerCase()
    if (input.key === 'F11') {
      toggleFullscreen()
      e.preventDefault()
      return
    }
    if (input.key === 'F12' || (ctrl && input.shift && key === 'i')) {
      win?.webContents.toggleDevTools()
      e.preventDefault()
      return
    }
    if (!app.isPackaged && ctrl && !input.shift && key === 'r') {
      win?.webContents.reload()
      e.preventDefault()
      return
    }
    if (ctrl && !input.shift && !input.alt) {
      if (input.key === '=' || input.key === '+') {
        zoomIn()
        e.preventDefault()
      } else if (input.key === '-') {
        zoomOut()
        e.preventDefault()
      } else if (input.key === '0') {
        zoomReset()
        e.preventDefault()
      }
    }
  })

  // 输入框右键菜单（剪切/复制/粘贴/全选）
  win.webContents.on('context-menu', (_e, params) => {
    const tpl: MenuItemConstructorOptions[] = []
    if (params.selectionText) tpl.push({ role: 'copy', label: '复制' })
    if (params.isEditable) {
      tpl.push(
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { type: 'separator' },
        { role: 'selectAll', label: '全选' }
      )
    }
    if (params.linkURL && /^https?:\/\//i.test(params.linkURL)) {
      tpl.push({ label: '在浏览器中打开', click: () => shell.openExternal(params.linkURL) })
    }
    if (tpl.length) Menu.buildFromTemplate(tpl).popup({ window: win ?? undefined })
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.setAppUserModelId('com.easyapi.desktop')

  app.on('second-instance', () => showWindow())

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    store = new DataStore()
    registerRequestHandlers(() => win)
    registerIpc(store, () => win, { showWindow, zoomIn, zoomOut, zoomReset, toggleFullscreen })
    createWindow()
    if (store.getSettings().closeToTray) createTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('before-quit', () => {
    quitting = true
  })

  app.on('window-all-closed', () => {
    if (quitting || !store?.getSettings().closeToTray) app.quit()
  })

  app.on('will-quit', () => {
    store?.flushSync()
  })
}
