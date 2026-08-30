import type { Collection, CollectionNode, FolderNode, RequestDef } from '../../../shared/types'
import { emptyAuth, emptyRequestBody } from './http'

function makeId(): string {
  return crypto.randomUUID()
}

function toKv(list: any): Array<{ id: string; key: string; value: string; enabled: boolean; desc?: string }> {
  if (!Array.isArray(list)) return []
  return list.map((h: any) => ({
    id: makeId(),
    key: String(h.key ?? ''),
    value: String(h.value ?? ''),
    enabled: !h.disabled,
    desc: typeof h.description === 'string' ? h.description : h.description?.content ?? ''
  }))
}

function mapBody(req: any): RequestDef['body'] {
  const body = emptyRequestBody()
  const b = req?.body
  if (!b) return body
  if (b.mode === 'raw') {
    body.mode = 'raw'
    body.rawContent = String(b.raw ?? '')
    const lang = String(b.options?.raw?.language ?? 'json').toLowerCase()
    body.rawLanguage = ['json', 'text', 'xml', 'html', 'javascript'].includes(lang)
      ? (lang as RequestDef['body']['rawLanguage'])
      : 'text'
    if (body.rawLanguage === 'json') {
      try {
        body.rawContent = JSON.stringify(JSON.parse(body.rawContent), null, 2)
      } catch {
        // 非法 JSON 原样保留
      }
    }
  } else if (b.mode === 'urlencoded') {
    body.mode = 'urlencoded'
    body.urlencoded = toKv(b.urlencoded)
  } else if (b.mode === 'formdata') {
    body.mode = 'form-data'
    body.form = (Array.isArray(b.formdata) ? b.formdata : []).map((f: any) => ({
      id: makeId(),
      key: String(f.key ?? ''),
      value: String(f.value?.src ?? f.value ?? ''),
      type: f.type === 'file' ? ('file' as const) : ('text' as const),
      enabled: !f.disabled,
      desc: typeof f.description === 'string' ? f.description : ''
    }))
  }
  return body
}

function mapAuth(req: any): RequestDef['auth'] {
  const auth = emptyAuth()
  const a = req?.auth
  if (!a?.type) return auth
  if (a.type === 'bearer') {
    auth.type = 'bearer'
    auth.bearerToken = String(a.bearer?.[0]?.value ?? '')
  } else if (a.type === 'basic') {
    auth.type = 'basic'
    auth.basicUsername = String(a.basic?.[0]?.value ?? '')
    auth.basicPassword = String(a.basic?.[1]?.value ?? '')
  } else if (a.type === 'apikey') {
    auth.type = 'apikey'
    auth.apiKeyKey = String(a.apikey?.find((x: any) => x.key === 'key')?.value ?? '')
    auth.apiKeyValue = String(a.apikey?.find((x: any) => x.key === 'value')?.value ?? '')
    auth.apiKeyIn = a.apikey?.find((x: any) => x.key === 'in')?.value === 'query' ? 'query' : 'header'
  }
  return auth
}

function mapMethod(m: any): RequestDef['method'] {
  const up = String(m ?? 'GET').toUpperCase()
  return (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(up) ? up : 'GET') as RequestDef['method']
}

function mapUrlToDef(url: any): { url: string; params: RequestDef['params'] } {
  if (typeof url === 'string') return { url, params: [] }
  const raw = String(url?.raw ?? '')
  const params = toKv(url?.query)
  return { url: raw, params }
}

function extractEventScript(item: any, listen: 'prerequest' | 'test'): string {
  const events = Array.isArray(item?.event) ? item.event : []
  const ev = events.find((e: any) => e?.listen === listen)
  const exec = ev?.script?.exec
  if (Array.isArray(exec)) return exec.join('\n')
  if (typeof exec === 'string') return exec
  return ''
}

function mapItem(item: any): CollectionNode | null {
  if (Array.isArray(item?.item)) {
    const folder: FolderNode = {
      id: makeId(),
      type: 'folder',
      name: String(item.name ?? '未命名文件夹'),
      children: item.item.map((c: any) => mapItem(c)).filter(Boolean) as CollectionNode[]
    }
    return folder
  }
  const req = item?.request
  if (!req) return null
  const { url, params } = mapUrlToDef(req.url)
  return {
    id: makeId(),
    type: 'request',
    name: String(item.name ?? '未命名请求'),
    method: mapMethod(req.method),
    url,
    params,
    headers: toKv(req.header),
    body: mapBody(req),
    auth: mapAuth(req),
    preScript: extractEventScript(item, 'prerequest'),
    tests: extractEventScript(item, 'test'),
    description: typeof item.description === 'string' ? item.description : undefined,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
}

/** 解析 Postman Collection v2.x JSON */
export function importPostmanCollection(json: any): Collection {
  const now = Date.now()
  return {
    id: makeId(),
    type: 'collection',
    name: String(json?.info?.name ?? '导入的集合'),
    description: typeof json?.info?.description === 'string' ? json.info.description : undefined,
    children: (Array.isArray(json?.item) ? json.item : []).map((c: any) => mapItem(c)).filter(Boolean) as CollectionNode[],
    createdAt: now,
    updatedAt: now
  }
}

/* ---------- 导出为 Postman v2.1 格式 ---------- */

function fromKv(rows: RequestDef['params'] | RequestDef['headers']): any[] {
  return rows.map((r) => ({ key: r.key, value: r.value, ...(r.enabled ? {} : { disabled: true }), ...(r.desc ? { description: r.desc } : {}) }))
}

function fromBody(body: RequestDef['body']): any {
  if (body.mode === 'none') return { mode: 'raw', raw: '' }
  if (body.mode === 'raw') {
    return { mode: 'raw', raw: body.rawContent, options: { raw: { language: body.rawLanguage } } }
  }
  if (body.mode === 'urlencoded') {
    return { mode: 'urlencoded', urlencoded: fromKv(body.urlencoded) }
  }
  if (body.mode === 'form-data') {
    return {
      mode: 'formdata',
      formdata: body.form.map((f) => ({
        key: f.key,
        value: f.type === 'file' ? '' : f.value,
        ...(f.type === 'file' ? { type: 'file', src: f.value } : {}),
        ...(f.enabled ? {} : { disabled: true })
      }))
    }
  }
  return { mode: 'raw', raw: '' }
}

function fromAuth(auth: RequestDef['auth']): any | undefined {
  if (auth.type === 'none') return undefined
  if (auth.type === 'bearer') return { type: 'bearer', bearer: [{ key: 'token', value: auth.bearerToken }] }
  if (auth.type === 'basic')
    return {
      type: 'basic',
      basic: [
        { key: 'username', value: auth.basicUsername },
        { key: 'password', value: auth.basicPassword }
      ]
    }
  return {
    type: 'apikey',
    apikey: [
      { key: 'key', value: auth.apiKeyKey },
      { key: 'value', value: auth.apiKeyValue },
      { key: 'in', value: auth.apiKeyIn }
    ]
  }
}

function exportItem(node: CollectionNode): any {
  if (node.type === 'folder') {
    return { name: node.name, item: node.children.map(exportItem) }
  }
  if (node.type === 'collection') {
    return { name: node.name, item: node.children.map(exportItem) }
  }
  const req: any = {
    method: node.method,
    header: fromKv(node.headers),
    body: fromBody(node.body),
    url: {
      raw: node.url,
      protocol: undefined,
      query: fromKv(node.params)
    }
  }
  const events: any[] = []
  if (node.preScript?.trim()) {
    events.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: node.preScript.split('\n') } })
  }
  if (node.tests?.trim()) {
    events.push({ listen: 'test', script: { type: 'text/javascript', exec: node.tests.split('\n') } })
  }
  if (events.length) req.event = events
  const auth = fromAuth(node.auth)
  if (auth) req.auth = auth
  return { name: node.name, request: req, ...(node.description ? { description: node.description } : {}) }
}

export function exportPostmanCollection(c: Collection): any {
  return {
    info: {
      _postman_id: c.id,
      name: c.name,
      description: c.description ?? '',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    item: c.children.map(exportItem)
  }
}
