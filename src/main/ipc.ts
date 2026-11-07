import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, shell } from 'electron'
import fs from 'node:fs'
import type { AppData, FileFilter } from '../shared/types'
import type { DataStore } from './store'

function toDialogFilters(filters?: FileFilter[]): { name: string; extensions: string[] }[] {
  return (filters ?? []).map((f) => ({ name: f.name, extensions: f.extensions }))
}

/** 渲染层可触发的窗口行为（实现位于 index.ts） */
export interface WindowActions {
  showWindow(): void
  zoomIn(): void
  zoomOut(): void
  zoomReset(): void
  toggleFullscreen(): void
}

export function registerIpc(store: DataStore, getWin: () => BrowserWindow | null, actions: WindowActions): void {
  ipcMain.handle('store:load', () => store.load())
  ipcMain.handle('store:patch', (_e, patch: Partial<AppData>) => {
    store.patch(patch)
  })

  ipcMain.handle('dialog:pickFile', async (_e, opts?: { title?: string; filters?: FileFilter[] }) => {
    const win = getWin()
    if (!win) return null
    const res = await dialog.showOpenDialog(win, {
      title: opts?.title ?? '选择文件',
      properties: ['openFile'],
      filters: toDialogFilters(opts?.filters)
    })
    return res.canceled || !res.filePaths.length ? null : res.filePaths[0]
  })

  ipcMain.handle(
    'dialog:pickSavePath',
    async (_e, opts?: { title?: string; defaultName?: string; filters?: FileFilter[] }) => {
      const win = getWin()
      if (!win) return null
      const res = await dialog.showSaveDialog(win, {
        title: opts?.title ?? '保存文件',
        defaultPath: opts?.defaultName,
        filters: toDialogFilters(opts?.filters)
      })
      return res.canceled || !res.filePath ? null : res.filePath
    }
  )

  ipcMain.handle('fs:readFile', (_e, p: string) => fs.readFileSync(p, 'utf-8'))

  ipcMain.handle('fs:writeFile', (_e, req: { path: string; content: string; encoding?: 'utf8' | 'base64' }) => {
    if (req.encoding === 'base64') fs.writeFileSync(req.path, Buffer.from(req.content, 'base64'))
    else fs.writeFileSync(req.path, req.content, 'utf-8')
  })

  ipcMain.handle('shell:openExternal', (_e, url: string) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url)
  })

  ipcMain.handle('shell:openDataDir', () => {
    void shell.openPath(app.getPath('userData'))
  })

  ipcMain.handle('app:info', () => ({
    version: app.getVersion(),
    platform: process.platform,
    launchAtStartup: app.getLoginItemSettings().openAtLogin
  }))

  ipcMain.handle('app:setLaunchAtStartup', (_e, enabled: boolean) => {
    // 开发态注册的是 electron 开发版可执行文件，禁止写入登录项
    if (!app.isPackaged) return false
    app.setLoginItemSettings({ openAtLogin: !!enabled, args: ['--hidden'] })
    return app.getLoginItemSettings().openAtLogin
  })

  ipcMain.handle('win:isMaximized', () => getWin()?.isMaximized() ?? false)
  ipcMain.on('win:minimize', () => getWin()?.minimize())
  ipcMain.on('win:toggleMaximize', () => {
    const win = getWin()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('win:close', () => getWin()?.close())
  ipcMain.on('win:show', () => actions.showWindow())
  ipcMain.on('win:zoomIn', () => actions.zoomIn())
  ipcMain.on('win:zoomOut', () => actions.zoomOut())
  ipcMain.on('win:zoomReset', () => actions.zoomReset())
  ipcMain.on('win:toggleFullscreen', () => actions.toggleFullscreen())
  ipcMain.on('win:setTitleBarOverlay', (_e, opts: { color: string; symbolColor: string }) => {
    const win = getWin()
    if (!win || win.isDestroyed()) return
    try {
      win.setTitleBarOverlay({ color: String(opts.color), symbolColor: String(opts.symbolColor) })
    } catch {
      /* 平台不支持原生叠加按钮时忽略 */
    }
  })
  ipcMain.on('win:setTitle', (_e, title: string) => {
    const t = String(title).slice(0, 90)
    getWin()?.setTitle(t || 'EasyAPI')
  })
}
