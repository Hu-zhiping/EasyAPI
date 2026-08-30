import type { RequestDef } from '../../../shared/types'
import { emptyAuth, emptyRequestBody, kv } from './http'

interface CurlResult {
  method: string
  url: string
  headers: Array<{ key: string; value: string }>
  bodyType: 'none' | 'raw' | 'urlencoded' | 'form-data'
  rawContent: string
  urlencoded: Array<[string, string]>
  form: Array<{ key: string; value: string; isFile: boolean }>
  bearer?: string
  basic?: { username: string; password: string }
}

/** 分词：支持单引号、双引号、反斜杠转义与 $'...' 形式 */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let cur = ''
  let has = false
  let i = 0
  while (i < input.length) {
    const c = input[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      if (has) {
        tokens.push(cur)
        cur = ''
        has = false
      }
      i++
      continue
    }
    if (c === '^' && input[i + 1] === '\n') {
      i += 2
      continue
    }
    if (c === '\\' && input[i + 1] === '\n') {
      i += 2
      continue
    }
    if (c === '\'' || c === '"') {
      const quote = c
      i++
      while (i < input.length) {
        if (quote === '"' && input[i] === '\\' && i + 1 < input.length) {
          cur += input[i + 1]
          i += 2
          continue
        }
        if (input[i] === quote) {
          i++
          break
        }
        cur += input[i]
        i++
      }
      has = true
      continue
    }
    if (c === '\\' && i + 1 < input.length) {
      cur += input[i + 1]
      i += 2
      has = true
      continue
    }
    cur += c
    i++
    has = true
  }
  if (has) tokens.push(cur)
  return tokens
}

export function parseCurl(text: string): CurlResult {
  const cleaned = text
    .trim()
    .replace(/^\s*curl\b/i, '')
    .replace(/\\\s*\n/g, ' ')
    .replace(/\^\s*\n/g, ' ')
  const tokens = tokenize(cleaned)

  const res: CurlResult = {
    method: '',
    url: '',
    headers: [],
    bodyType: 'none',
    rawContent: '',
    urlencoded: [],
    form: []
  }

  const dataParts: string[] = []
  let method = ''
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    const next = tokens[i + 1]
    switch (t) {
      case '-X':
      case '--request':
        if (next) {
          method = next.toUpperCase()
          i++
        }
        break
      case '-H':
      case '--header':
        if (next) {
          i++
          const idx = next.indexOf(':')
          if (idx > 0) res.headers.push({ key: next.slice(0, idx).trim(), value: next.slice(idx + 1).trim() })
        }
        break
      case '-d':
      case '--data':
      case '--data-raw':
      case '--data-ascii':
      case '--data-binary':
        if (next !== undefined) {
          dataParts.push(next)
          i++
        }
        break
      case '--data-urlencode':
        if (next !== undefined) {
          dataParts.push(next.replace(/^[^=]+=/, (m) => encodeURIComponent(m.slice(0, -1)) + '='))
          i++
        }
        break
      case '-F':
      case '--form':
        if (next) {
          i++
          const idx = next.indexOf('=')
          if (idx > 0) {
            const key = next.slice(0, idx)
            const value = next.slice(idx + 1)
            res.form.push({ key, value, isFile: value.startsWith('@') })
          }
        }
        break
      case '-u':
      case '--user':
        if (next) {
          i++
          const idx = next.indexOf(':')
          res.basic = {
            username: idx >= 0 ? next.slice(0, idx) : next,
            password: idx >= 0 ? next.slice(idx + 1) : ''
          }
        }
        break
      case '--url':
        if (next) {
          i++
          if (!res.url) res.url = next
        }
        break
      default: {
        if (t.startsWith('-')) break
        if (!res.url) res.url = t
        break
      }
    }
  }

  const isJson = res.headers.some((h) => h.key.toLowerCase() === 'content-type' && /json/i.test(h.value))
  if (res.form.length) {
    res.bodyType = 'form-data'
  } else if (dataParts.length) {
    const joined = dataParts.join('&')
    const looksKv = dataParts.every((d) => /^[^=&\s]+=[^&]*$/.test(d)) && dataParts.length > 0
    if (!isJson && looksKv) {
      res.bodyType = 'urlencoded'
      res.urlencoded = joined.split('&').map((p) => {
        const eq = p.indexOf('=')
        return [eq >= 0 ? p.slice(0, eq) : p, eq >= 0 ? p.slice(eq + 1) : ''] as [string, string]
      })
    } else {
      res.bodyType = 'raw'
      res.rawContent = isJson ? tryPretty(joined) : joined
    }
  }

  if (!res.method) res.method = res.bodyType === 'none' ? 'GET' : 'POST'
  else res.method = res.method.toUpperCase()

  const authHeader = res.headers.find((h) => h.key.toLowerCase() === 'authorization')
  if (authHeader) {
    const v = authHeader.value
    if (/^Bearer\s+/i.test(v)) {
      res.bearer = v.replace(/^Bearer\s+/i, '')
      res.headers = res.headers.filter((h) => h !== authHeader)
    } else if (/^Basic\s+/i.test(v)) {
      try {
        const [u, ...rest] = atob(v.replace(/^Basic\s+/i, '')).split(':')
        res.basic = { username: u, password: rest.join(':') }
        res.headers = res.headers.filter((h) => h !== authHeader)
      } catch {
        // 无效 base64，保留原头
      }
    }
  }
  return res
}

function tryPretty(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}

/** 将请求定义转换为 cURL 命令（bash 风格） */
export function stringifyCurl(req: RequestDef, finalUrl: string, headers: Record<string, string>, payload: RequestDef['body']): string {
  const lines: string[] = []
  let cmd = `curl -X ${req.method} '${finalUrl.replace(/'/g, `'\\''`)}'`
  for (const [k, v] of Object.entries(headers)) {
    cmd += ` \\\n  -H '${k}: ${v.replace(/'/g, `'\\''`)}'`
  }
  if (payload.mode === 'raw' && payload.rawContent) {
    cmd += ` \\\n  --data-raw '${payload.rawContent.replace(/'/g, `'\\''`)}'`
  } else if (payload.mode === 'urlencoded') {
    const qs = payload.urlencoded.filter((r) => r.enabled && r.key).map((r) => `${r.key}=${r.value}`)
    if (qs.length) cmd += ` \\\n  --data-raw '${qs.join('&')}'`
  } else if (payload.mode === 'form-data') {
    for (const f of payload.form) {
      if (!f.enabled || !f.key) continue
      const v = f.type === 'file' ? `@${f.value}` : f.value
      cmd += ` \\\n  -F '${f.key}=${v.replace(/'/g, `'\\''`)}'`
    }
  }
  lines.push(cmd)
  return lines.join('\n')
}

export function curlToRequestDef(c: CurlResult): { name: string; def: RequestDef } {
  const def: RequestDef = {
    method: (['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'].includes(c.method) ? c.method : 'GET') as RequestDef['method'],
    url: c.url,
    params: [],
    headers: kv(c.headers.map((h) => [h.key, h.value])),
    body: emptyRequestBody(),
    auth: emptyAuth(),
    preScript: '',
    tests: ''
  }
  if (c.bodyType === 'raw') {
    def.body.mode = 'raw'
    def.body.rawLanguage = /^[\s]*[[{]/.test(c.rawContent) ? 'json' : 'text'
    def.body.rawContent = c.rawContent
  } else if (c.bodyType === 'urlencoded') {
    def.body.mode = 'urlencoded'
    def.body.urlencoded = kv(c.urlencoded)
  } else if (c.bodyType === 'form-data') {
    def.body.mode = 'form-data'
    def.body.form = c.form.map((f) => ({
      id: crypto.randomUUID(),
      key: f.key,
      value: f.isFile ? f.value.slice(1) : f.value,
      type: f.isFile ? ('file' as const) : ('text' as const),
      enabled: true,
      desc: ''
    }))
  }
  if (c.bearer) {
    def.auth.type = 'bearer'
    def.auth.bearerToken = c.bearer
  } else if (c.basic) {
    def.auth.type = 'basic'
    def.auth.basicUsername = c.basic.username
    def.auth.basicPassword = c.basic.password
  }
  let name = 'cURL 导入的请求'
  try {
    const u = new URL(c.url)
    name = `${u.host}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    // 忽略非法 URL
  }
  return { name, def }
}
