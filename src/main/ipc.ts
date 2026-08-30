import { app, BrowserWindow, dialog, ipcMain, Menu, MenuItemConstructorOptions, shell } from 'electron'
import fs from 'node:fs'
import type { AppData, FileFilter } from '../shared/types'
import type { DataStore } from './store'

function toDialogFilters(filters?: FileFilter[]): { name: string; extensions: string[] }[] {
  return (filters ?? []).map((f) => ({ name: f.name, extensions: f.extensions }))
}

export function registerIpc(store: DataStore, getWin: () => BrowserWindow | null): void {
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

  ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform }))

  ipcMain.handle('win:isMaximized', () => getWin()?.isMaximized() ?? false)
  ipcMain.on('win:minimize', () => getWin()?.minimize())
  ipcMain.on('win:toggleMaximize', () => {
    const win = getWin()
    if (!win) return
    if (win.isMaximized()) win.unmaximize()
    else win.maximize()
  })
  ipcMain.on('win:close', () => getWin()?.close())
  ipcMain.on('win:setTitle', (_e, title: string) => {
    const t = String(title).slice(0, 90)
    getWin()?.setTitle(t || 'EasyAPI')
  })
}
