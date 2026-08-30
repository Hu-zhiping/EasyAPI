import { contextBridge, ipcRenderer } from 'electron'
import type { AppData, FileFilter, HttpRequestPayload, RendererApi } from '../shared/types'

const api: RendererApi = {
  sendRequest: (payload: HttpRequestPayload) => ipcRenderer.invoke('http:request', payload),
  cancelRequest: (id: string) => ipcRenderer.send('http:cancel', id),
  loadStore: (): Promise<AppData> => ipcRenderer.invoke('store:load'),
  patchStore: (patch: Partial<AppData>) => ipcRenderer.invoke('store:patch', patch),
  pickFile: (opts?: { title?: string; filters?: FileFilter[] }) => ipcRenderer.invoke('dialog:pickFile', opts),
  pickSavePath: (opts?: { title?: string; defaultName?: string; filters?: FileFilter[] }) =>
    ipcRenderer.invoke('dialog:pickSavePath', opts),
  readFile: (path: string) => ipcRenderer.invoke('fs:readFile', path),
  writeFile: (req: { path: string; content: string; encoding?: 'utf8' | 'base64' }) =>
    ipcRenderer.invoke('fs:writeFile', req),
  openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),
  appInfo: () => ipcRenderer.invoke('app:info'),
  winMinimize: () => ipcRenderer.send('win:minimize'),
  winToggleMaximize: () => ipcRenderer.send('win:toggleMaximize'),
  winClose: () => ipcRenderer.send('win:close'),
  winIsMaximized: () => ipcRenderer.invoke('win:isMaximized'),
  onMaximized: (cb: (v: boolean) => void) => {
    const listener = (_e: unknown, v: boolean) => cb(v)
    ipcRenderer.on('win:maximizedChanged', listener)
    return () => ipcRenderer.removeListener('win:maximizedChanged', listener)
  },
  setWindowTitle: (title: string) => ipcRenderer.send('win:setTitle', title)
}

contextBridge.exposeInMainWorld('api', api)
