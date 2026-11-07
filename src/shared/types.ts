export type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'

export const METHODS: Method[] = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

export interface KV {
  id: string
  key: string
  value: string
  enabled: boolean
  desc?: string
}

export type BodyMode = 'none' | 'form-data' | 'urlencoded' | 'raw' | 'binary'

export type RawLanguage = 'json' | 'text' | 'xml' | 'html' | 'javascript'

export interface FormField extends KV {
  type: 'text' | 'file'
}

export interface RequestBody {
  mode: BodyMode
  rawLanguage: RawLanguage
  rawContent: string
  form: FormField[]
  urlencoded: KV[]
  binaryPath: string
}

export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey'

export interface AuthConfig {
  type: AuthType
  bearerToken: string
  basicUsername: string
  basicPassword: string
  apiKeyKey: string
  apiKeyValue: string
  apiKeyIn: 'header' | 'query'
}

export interface RequestDef {
  method: Method
  url: string
  params: KV[]
  headers: KV[]
  body: RequestBody
  auth: AuthConfig
  /** 前置脚本：发送前执行，可通过 pm.* 修改变量与请求 */
  preScript: string
  /** 测试脚本（断言）：响应返回后执行，用 pm.test / pm.response 校验结果 */
  tests: string
  /** 请求描述（接口说明，保存在请求上） */
  description?: string
}

export interface RequestNode extends RequestDef {
  id: string
  type: 'request'
  name: string
  description?: string
  createdAt: number
  updatedAt: number
}

export interface FolderNode {
  id: string
  type: 'folder'
  name: string
  children: CollectionNode[]
  description?: string
}

export interface Collection {
  id: string
  type: 'collection'
  name: string
  children: CollectionNode[]
  description?: string
  createdAt: number
  updatedAt: number
}

export type CollectionNode = RequestNode | FolderNode | Collection

export interface ResponseHeader {
  key: string
  value: string
}

export interface ResponseInfo {
  id: string
  status: number
  statusText: string
  ok: boolean
  timeMs: number
  size: number
  headers: ResponseHeader[]
  /** base64 编码的原始响应体，超过大小限制时为 null */
  bodyBase64: string | null
  /** 解码后的响应体文本（可能被截断），二进制内容为 null */
  bodyText: string | null
  contentType: string
  charset: string
  truncated: boolean
  requestUrl: string
  method: string
  sentAt: string
  error?: string
  errorCode?: string
}

export interface HistoryEntry {
  id: string
  method: string
  url: string
  status: number | null
  ok: boolean
  durationMs: number
  size: number
  at: string
  error?: string
  request: RequestDef
}

export interface EnvVariable {
  id: string
  key: string
  value: string
  enabled: boolean
  desc?: string
}

export interface Environment {
  id: string
  name: string
  variables: EnvVariable[]
}

export interface Settings {
  theme: 'dark' | 'light'
  timeoutMs: number
  followRedirects: boolean
  sslVerify: boolean
  saveHistory: boolean
  historyLimit: number
  sidebarWidth: number
  splitRatio: number
  /** 关闭窗口时最小化到系统托盘而不是退出 */
  closeToTray: boolean
}

/** 窗口几何状态（由主进程维护，用于重启后还原） */
export interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
  maximized: boolean
  fullscreen: boolean
  zoomFactor: number
}

export type ReqSubTab = 'params' | 'headers' | 'body' | 'auth' | 'pre' | 'tests'
export type RespSubTab = 'pretty' | 'raw' | 'preview' | 'request' | 'headers' | 'cookies'

export interface ScriptLogEntry {
  level: 'log' | 'info' | 'warn' | 'error'
  text: string
  at: string
}

export interface TestResult {
  name: string
  passed: boolean
  error?: string
}

export interface Tab {
  id: string
  title: string
  request: RequestDef
  response: ResponseInfo | null
  sending: boolean
  savedRef: { collectionId: string; nodeId: string; name: string } | null
  subTab: ReqSubTab
  respTab: RespSubTab
  lastError: string | null
  /** 最近一次发送的前置脚本错误（出错时请求不会发出） */
  scriptError: string | null
  /** 最近一次测试脚本的断言结果 */
  testResults: TestResult[] | null
  /** 最近一次实际发送的请求快照（变量解析、鉴权与脚本修改之后） */
  sentReq: { method: string; url: string; headers: Array<{ key: string; value: string }> } | null
  /** 标题是否由 URL 自动生成（手动重命名后为 false，不再覆盖） */
  autoNamed?: boolean
}

export interface CookieItem {
  id: string
  domain: string
  name: string
  value: string
  path?: string
  /** 过期时间戳（毫秒），undefined 表示会话 Cookie（手动删除前一直有效） */
  expiresAt?: number
}

export interface AppData {
  collections: Collection[]
  environments: Environment[]
  globals: EnvVariable[]
  activeEnvId: string | null
  history: HistoryEntry[]
  settings: Settings
  sessionTabs: PersistedTab[]
  cookies: CookieItem[]
  windowState?: WindowState
}

export interface PersistedTab {
  title: string
  request: RequestDef
  savedRef: Tab['savedRef']
  subTab: ReqSubTab
}

/** 发送到主进程的请求载荷（变量已解析完成） */
export interface HttpRequestPayload {
  id: string
  method: string
  url: string
  headers: Record<string, string>
  bodyMode: BodyMode
  rawLanguage: RawLanguage
  rawContent?: string
  urlencoded?: Array<[string, string]>
  formFields?: Array<{ key: string; type: 'text' | 'file'; value: string }>
  binaryPath?: string
  timeoutMs: number
  followRedirects: boolean
  sslVerify: boolean
}

export interface FileFilter {
  name: string
  extensions: string[]
}

export interface ConsoleEntry {
  id: string
  at: string
  method: string
  url: string
  status: number | null
  ok: boolean
  durationMs: number
  size: number
  error?: string
  requestHeaders: Record<string, string>
  responseHeaders: ResponseHeader[]
  scriptLogs?: ScriptLogEntry[]
  scriptError?: string
  testResults?: TestResult[]
}

export interface RendererApi {
  sendRequest(payload: HttpRequestPayload): Promise<ResponseInfo>
  cancelRequest(id: string): void
  loadStore(): Promise<AppData>
  patchStore(patch: Partial<AppData>): void
  pickFile(opts?: { title?: string; filters?: FileFilter[] }): Promise<string | null>
  pickSavePath(opts?: { title?: string; defaultName?: string; filters?: FileFilter[] }): Promise<string | null>
  readFile(path: string): Promise<string>
  writeFile(req: { path: string; content: string; encoding?: 'utf8' | 'base64' }): Promise<void>
  openExternal(url: string): void
  /** 在系统资源管理器中打开应用数据目录 */
  openDataDir(): void
  appInfo(): Promise<AppInfo>
  winMinimize(): void
  winToggleMaximize(): void
  winClose(): void
  winIsMaximized(): Promise<boolean>
  onMaximized(cb: (v: boolean) => void): () => void
  /** 设置窗口标题（任务栏同步显示） */
  setWindowTitle(title: string): void
  /** 显示并聚焦主窗口（托盘恢复等场景） */
  winShow(): void
  /** 界面缩放（含任务栏快捷键 Ctrl+= / Ctrl+- / Ctrl+0） */
  zoomIn(): void
  zoomOut(): void
  zoomReset(): void
  toggleFullscreen(): void
  /** 更新原生标题栏叠加按钮配色（跟随主题） */
  setTitleBarOverlay(opts: { color: string; symbolColor: string }): void
  /** 开机自启（写入当前用户登录项），返回生效状态 */
  setLaunchAtStartup(enabled: boolean): Promise<boolean>
}

export interface AppInfo {
  version: string
  platform: string
  /** 是否已启用开机自启 */
  launchAtStartup: boolean
}
