import type {
  AuthConfig,
  EnvVariable,
  HttpRequestPayload,
  KV,
  Method,
  RequestBody,
  RequestDef
} from '../../../shared/types'
import { interpolate, makeLookup } from './interpolate'

export interface ResolveCtx {
  env: EnvVariable[]
  globals: EnvVariable[]
  /** 前置脚本 pm.variables.set 写入的临时变量，优先级最高 */
  runtime?: EnvVariable[]
}

/** URL 中查询参数与参数表的双向同步工具 */
export function parseUrlQuery(url: string): Array<{ key: string; value: string }> {
  const out: Array<{ key: string; value: string }> = []
  const hashIdx = url.indexOf('#')
  const noHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url
  const qIdx = noHash.indexOf('?')
  if (qIdx < 0) return out
  const qs = noHash.slice(qIdx + 1)
  if (!qs) return out
  for (const part of qs.split('&')) {
    if (!part) continue
    const eq = part.indexOf('=')
    const k = eq >= 0 ? part.slice(0, eq) : part
    const v = eq >= 0 ? part.slice(eq + 1) : ''
    try {
      out.push({ key: decodeURIComponent(k), value: decodeURIComponent(v) })
    } catch {
      out.push({ key: k, value: v })
    }
  }
  return out
}

export function setUrlQuery(url: string, rows: KV[]): string {
  const hashIdx = url.indexOf('#')
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : ''
  let base = hashIdx >= 0 ? url.slice(0, hashIdx) : url
  const qIdx = base.indexOf('?')
  if (qIdx >= 0) base = base.slice(0, qIdx)
  const qs = rows
    .filter((r) => r.enabled && r.key)
    .map((r) => `${encodeURIComponent(r.key)}=${encodeURIComponent(r.value)}`)
    .join('&')
  return base + (qs ? '?' + qs : '') + hash
}

export function queryEquals(rows: KV[], url: string): boolean {
  const inUrl = parseUrlQuery(url)
  const enabled = rows.filter((r) => r.enabled && r.key).map((r) => ({ key: r.key, value: r.value }))
  if (inUrl.length !== enabled.length) return false
  return enabled.every((r, i) => inUrl[i].key === r.key && inUrl[i].value === r.value)
}

/** 与请求表同步后的参数行（保留原有行的启用状态与描述） */
export function syncParamsFromUrl(rows: KV[], url: string): KV[] {
  const parsed = parseUrlQuery(url)
  const out: KV[] = []
  const used = new Set<string>()
  for (const p of parsed) {
    const prev = rows.find((r) => r.key === p.key && !used.has(r.id))
    if (prev) {
      used.add(prev.id)
      out.push({ ...prev, value: p.value })
    } else {
      out.push({ id: crypto.randomUUID(), key: p.key, value: p.value, enabled: true, desc: '' })
    }
  }
  return out
}

function applyAuth(
  headers: Record<string, string>,
  url: string,
  auth: AuthConfig,
  lookup: (s: string) => string | null | undefined
): { headers: Record<string, string>; url: string } {
  const hasHeader = (name: string) =>
    Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase())

  if (auth.type === 'bearer' && auth.bearerToken && !hasHeader('authorization')) {
    headers['Authorization'] = `Bearer ${interpolate(auth.bearerToken, lookup)}`
  } else if (auth.type === 'basic' && !hasHeader('authorization')) {
    const raw = `${interpolate(auth.basicUsername, lookup)}:${interpolate(auth.basicPassword, lookup)}`
    headers['Authorization'] = `Basic ${btoa(unescape(encodeURIComponent(raw)))}`
  } else if (auth.type === 'apikey' && auth.apiKeyKey) {
    const key = interpolate(auth.apiKeyKey, lookup)
    const value = interpolate(auth.apiKeyValue, lookup)
    if (auth.apiKeyIn === 'header' && !hasHeader(key)) headers[key] = value
    else if (auth.apiKeyIn === 'query') url = appendQueryParam(url, key, value)
  }
  return { headers, url }
}

function appendQueryParam(url: string, key: string, value: string): string {
  if (!key) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

/** 发送到主进程的请求载荷（变量已解析完成） */
export type HttpRequestCore = Omit<
  HttpRequestPayload,
  'id' | 'timeoutMs' | 'followRedirects' | 'sslVerify'
>

/** 把编辑器中的请求定义解析为发送载荷：变量插值 → 鉴权 → 参数合并 */
export function buildPayload(req: RequestDef, ctx: ResolveCtx): HttpRequestCore {
  const lookup = makeLookup([...(ctx.runtime ? [ctx.runtime] : []), ctx.env, ctx.globals])

  // 先插值再补协议：变量值可能自带 http(s)://（如 {{baseUrl}}/path），先补协议会拼出
  // https://http://host 的坏 URL；插值后仍无协议的裸域名才默认补 https://
  let url = interpolate(req.url.trim(), lookup)
  if (url && !/^[a-z][a-z0-9+.-]*:\/\//i.test(url)) url = 'https://' + url

  const headers: Record<string, string> = {}
  const seen = new Set<string>()
  for (const h of req.headers) {
    if (!h.enabled || !h.key) continue
    const key = interpolate(h.key, lookup)
    if (seen.has(key.toLowerCase())) continue
    seen.add(key.toLowerCase())
    headers[key] = interpolate(h.value, lookup)
  }

  // 参数表作为查询参数的唯一事实来源（表格为空时保留 URL 中手写的查询串）
  if (req.params.some((p) => p.enabled && p.key)) {
    url = setUrlQuery(url, req.params.map((p) => ({ ...p, value: interpolate(p.value, lookup) })))
  }

  const withAuth = applyAuth(headers, url, req.auth, lookup)

  const body: Pick<
    HttpRequestPayload,
    'bodyMode' | 'rawLanguage' | 'rawContent' | 'urlencoded' | 'formFields' | 'binaryPath'
  > = {
    bodyMode: req.body.mode,
    rawLanguage: req.body.rawLanguage,
    rawContent: req.body.mode === 'raw' ? interpolate(req.body.rawContent, lookup) : undefined,
    urlencoded:
      req.body.mode === 'urlencoded'
        ? req.body.urlencoded.filter((r) => r.enabled && r.key).map((r) => [interpolate(r.key, lookup), interpolate(r.value, lookup)] as [string, string])
        : undefined,
    formFields:
      req.body.mode === 'form-data'
        ? req.body.form.filter((f) => f.enabled && f.key).map((f) => ({ key: interpolate(f.key, lookup), type: f.type, value: interpolate(f.value, lookup) }))
        : undefined,
    binaryPath: req.body.mode === 'binary' ? req.body.binaryPath : undefined
  }

  return {
    method: req.method,
    url: withAuth.url,
    headers: withAuth.headers,
    ...body
  }
}

export interface AutoHeader {
  key: string
  value: string
}

/**
 * 根据 Body 类型与授权配置推导「将自动附加」的请求头（与主进程发送逻辑一致）。
 * 用户已手动设置同名请求头（大小写不敏感）时不再生成。
 */
export function resolveAutoHeaders(req: RequestDef): AutoHeader[] {
  const out: AutoHeader[] = []
  const has = (name: string): boolean =>
    req.headers.some((h) => h.enabled && h.key.toLowerCase() === name.toLowerCase())
  const b = req.body
  if (b.mode === 'raw' && b.rawContent.trim()) {
    if (!has('content-type')) {
      const ct: Record<string, string> = {
        json: 'application/json',
        xml: 'application/xml',
        html: 'text/html',
        javascript: 'application/javascript',
        text: 'text/plain'
      }
      out.push({ key: 'Content-Type', value: ct[b.rawLanguage] ?? 'text/plain' })
    }
  } else if (b.mode === 'urlencoded') {
    if (!has('content-type')) out.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded' })
  } else if (b.mode === 'form-data') {
    if (!has('content-type')) out.push({ key: 'Content-Type', value: 'multipart/form-data' })
  } else if (b.mode === 'binary' && b.binaryPath) {
    if (!has('content-type')) out.push({ key: 'Content-Type', value: 'application/octet-stream' })
  }
  const a = req.auth
  if (a.type === 'bearer' && a.bearerToken && !has('authorization')) {
    out.push({ key: 'Authorization', value: `Bearer ${a.bearerToken}` })
  } else if (a.type === 'basic' && !has('authorization')) {
    const raw = `${a.basicUsername}:${a.basicPassword}`
    out.push({ key: 'Authorization', value: `Basic ${btoa(unescape(encodeURIComponent(raw)))}` })
  } else if (a.type === 'apikey' && a.apiKeyIn === 'header' && a.apiKeyKey && !has(a.apiKeyKey)) {
    out.push({ key: a.apiKeyKey, value: a.apiKeyValue })
  }
  return out
}

export function kv(rows: Array<[string, string]>): KV[] {
  return rows.map(([key, value]) => ({ id: crypto.randomUUID(), key, value, enabled: true, desc: '' }))
}

export function emptyRequestBody(): RequestBody {
  return { mode: 'none', rawLanguage: 'json', rawContent: '', form: [], urlencoded: [], binaryPath: '' }
}

export function emptyAuth(): AuthConfig {
  return { type: 'none', bearerToken: '', basicUsername: '', basicPassword: '', apiKeyKey: '', apiKeyValue: '', apiKeyIn: 'header' }
}

export function emptyRequestDef(method: Method = 'GET'): RequestDef {
  return {
    method,
    url: '',
    params: [],
    headers: [],
    body: emptyRequestBody(),
    auth: emptyAuth(),
    preScript: '',
    tests: ''
  }
}

export function requestDefFromNode(n: RequestDef): RequestDef {
  const def = JSON.parse(
    JSON.stringify({
      method: n.method,
      url: n.url,
      params: n.params,
      headers: n.headers,
      body: n.body,
      auth: n.auth,
      preScript: n.preScript,
      tests: n.tests
    })
  ) as RequestDef
  // 兼容旧数据：缺少脚本字段时补齐
  if (typeof def.preScript !== 'string') (def as { preScript: string }).preScript = ''
  if (typeof def.tests !== 'string') (def as { tests: string }).tests = ''
  return def
}
