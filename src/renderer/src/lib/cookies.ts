import type { CookieItem, ResponseHeader } from '../../../shared/types'

/** 从响应头解析 Set-Cookie，生成待入库的 Cookie 列表 */
export function parseSetCookies(headers: ResponseHeader[], requestUrl: string): CookieItem[] {
  let host = ''
  try {
    host = new URL(requestUrl).hostname
  } catch {
    return []
  }
  const out: CookieItem[] = []
  for (const h of headers) {
    if (h.key.toLowerCase() !== 'set-cookie') continue
    for (const line of h.value.split('\n')) {
      const [pair, ...attrs] = line.split(';')
      const eq = pair.indexOf('=')
      if (eq <= 0) continue
      const name = pair.slice(0, eq).trim()
      if (!name) continue
      const value = pair.slice(eq + 1).trim()
      let domain = host
      let expiresAt: number | undefined
      let path: string | undefined
      for (const raw of attrs) {
        const [k, ...rest] = raw.trim().split('=')
        const key = k.trim().toLowerCase()
        const val = rest.join('=').trim()
        if (key === 'domain') domain = val.replace(/^\./, '') || host
        else if (key === 'path') path = val
        else if (key === 'max-age') {
          const n = Number(val)
          if (Number.isFinite(n)) expiresAt = n <= 0 ? 0 : Date.now() + n * 1000
        } else if (key === 'expires') {
          const t = Date.parse(val)
          if (!Number.isNaN(t)) expiresAt = t
        }
      }
      out.push({ id: crypto.randomUUID(), domain, name, value, path, expiresAt })
    }
  }
  return out
}

/** 计算应随请求发送的 Cookie，并找出已过期的条目 id（由调用方清理） */
export function matchCookies(
  jar: CookieItem[],
  url: string
): { matched: CookieItem[]; expiredIds: string[] } {
  let host = ''
  try {
    host = new URL(url).hostname
  } catch {
    return { matched: [], expiredIds: [] }
  }
  const now = Date.now()
  const matched: CookieItem[] = []
  const expiredIds: string[] = []
  for (const c of jar) {
    if (c.expiresAt !== undefined && c.expiresAt <= now) {
      expiredIds.push(c.id)
      continue
    }
    const d = c.domain.replace(/^\./, '')
    if (host === d || host.endsWith('.' + d)) matched.push(c)
  }
  return { matched, expiredIds }
}
