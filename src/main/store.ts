import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import type { AppData, Collection, RequestDef } from '../shared/types'

const uid = (): string => crypto.randomUUID()

function emptyRequest(method: RequestDef['method'], url: string, name: string): RequestDef {
  return {
    method,
    url,
    params: [],
    headers: [],
    body: { mode: method === 'GET' ? 'none' : 'raw', rawLanguage: 'json', rawContent: '', form: [], urlencoded: [], binaryPath: '' },
    auth: {
      type: 'none',
      bearerToken: '',
      basicUsername: '',
      basicPassword: '',
      apiKeyKey: '',
      apiKeyValue: '',
      apiKeyIn: 'header'
    },
    preScript: '',
    tests: ''
  }
}

function makeRequestNode(name: string, def: RequestDef) {
  return { id: uid(), type: 'request' as const, name, ...structuredClone(def), createdAt: Date.now(), updatedAt: Date.now() }
}

function defaultData(): AppData {
  const now = Date.now()
  const envId = uid()
  const postsReq = emptyRequest('GET', '{{baseUrl}}/posts/1', '获取文章详情')
  const postsList = emptyRequest('GET', '{{baseUrl}}/posts', '分页获取文章列表')
  postsList.params = [{ id: uid(), key: '_limit', value: '5', enabled: true, desc: '每页数量' }]
  const createPost = emptyRequest('POST', '{{baseUrl}}/posts', '创建新文章')
  createPost.body.rawContent = JSON.stringify({ title: 'EasyAPI', body: '来自 EasyAPI 的请求', userId: 1 }, null, 2)
  const delPost = emptyRequest('DELETE', '{{baseUrl}}/posts/1', '删除文章')
  const hbGet = emptyRequest('GET', 'https://httpbin.org/get', '回显请求信息')
  hbGet.headers = [{ id: uid(), key: 'X-Client', value: 'EasyAPI', enabled: true, desc: '自定义请求头' }]
  const hbPost = emptyRequest('POST', 'https://httpbin.org/post', 'POST 回显')
  hbPost.body.rawContent = JSON.stringify({ hello: 'EasyAPI' }, null, 2)

  const collection: Collection = {
    id: uid(),
    type: 'collection',
    name: '示例接口',
    description: '内置示例，点击即可体验',
    createdAt: now,
    updatedAt: now,
    children: [
      {
        id: uid(),
        type: 'folder',
        name: 'JSONPlaceholder 演示',
        children: [makeRequestNode(postsReq && '获取文章详情', postsReq), makeRequestNode('分页获取文章列表', postsList), makeRequestNode('创建新文章', createPost), makeRequestNode('删除文章', delPost)]
      },
      {
        id: uid(),
        type: 'folder',
        name: 'HttpBin 演示',
        children: [makeRequestNode('回显请求信息', hbGet), makeRequestNode('POST 回显', hbPost)]
      }
    ]
  }

  return {
    collections: [collection],
    environments: [
      {
        id: envId,
        name: '开发环境',
        variables: [{ id: uid(), key: 'baseUrl', value: 'https://jsonplaceholder.typicode.com', enabled: true }]
      }
    ],
    globals: [],
    activeEnvId: envId,
    history: [],
    settings: {
      theme: 'dark',
      timeoutMs: 30000,
      followRedirects: true,
      sslVerify: true,
      saveHistory: true,
      historyLimit: 100,
      sidebarWidth: 264,
      splitRatio: 0.46
    },
    sessionTabs: [],
    cookies: []
  }
}

export class DataStore {
  private file: string
  private data: AppData
  private dirty = false
  private timer: NodeJS.Timeout | null = null

  constructor() {
    const dir = app.getPath('userData')
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    this.file = path.join(dir, 'easyapi-data.json')
    this.data = this.readFromDisk()
  }

  private readFromDisk(): AppData {
    try {
      if (fs.existsSync(this.file)) {
        const raw = JSON.parse(fs.readFileSync(this.file, 'utf-8')) as Partial<AppData>
        const def = defaultData()
        return {
          ...def,
          ...raw,
          settings: { ...def.settings, ...(raw.settings ?? {}) },
          cookies: raw.cookies ?? []
        }
      }
    } catch (err) {
      // 数据文件损坏：先备份原文件再回退默认值，避免后续保存覆盖掉用户原始数据
      try {
        const backup = `${this.file}.corrupt-${Date.now()}.bak`
        fs.copyFileSync(this.file, backup)
        console.error('[EasyAPI] 数据文件损坏，原文件已备份至', backup, err)
      } catch {
        console.error('[EasyAPI] 数据文件损坏且备份失败', err)
      }
    }
    return defaultData()
  }

  load(): AppData {
    return this.data
  }

  patch(p: Partial<AppData>): void {
    this.data = { ...this.data, ...p }
    this.schedule()
  }

  private schedule(): void {
    this.dirty = true
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => this.flushSync(), 400)
  }

  flushSync(): void {
    if (!this.dirty) return
    this.dirty = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
    try {
      const tmp = this.file + '.tmp'
      fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
      fs.renameSync(tmp, this.file)
    } catch (err) {
      console.error('[EasyAPI] 数据保存失败:', err)
    }
  }
}
