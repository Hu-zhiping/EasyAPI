import { app, BrowserWindow, Menu, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { DataStore } from './store'
import { registerRequestHandlers } from './requestEngine'
import { registerIpc } from './ipc'

let win: BrowserWindow | null = null
let store: DataStore

process.env.ELECTRON_DISABLE_SECURITY_WARNINGS = 'true'

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

function createWindow(): void {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: false,
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

  win.on('ready-to-show', () => win?.show())
  win.on('maximize', () => win?.webContents.send('win:maximizedChanged', true))
  win.on('unmaximize', () => win?.webContents.send('win:maximizedChanged', false))

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  // 无边框窗口下的快捷键：F12 / Ctrl+Shift+I 打开 DevTools
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return
    const ctrl = input.control || input.meta
    if (input.key === 'F12' || (ctrl && input.shift && input.key.toLowerCase() === 'i')) {
      win?.webContents.toggleDevTools()
      e.preventDefault()
    }
    if (!app.isPackaged && ctrl && !input.shift && input.key.toLowerCase() === 'r') {
      win?.webContents.reload()
      e.preventDefault()
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
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    Menu.setApplicationMenu(null)
    store = new DataStore()
    registerRequestHandlers()
    registerIpc(store, () => win)
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('will-quit', () => {
    store?.flushSync()
  })
}
