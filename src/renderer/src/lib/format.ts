import type { Method } from '../../../shared/types'

export function formatBytes(n: number): string {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export function formatTime(iso: string): string {
  const d = new Date(iso)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso)
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export function dateGroup(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = d.getTime()
  if (t >= startOfToday) return '今天'
  if (t >= startOfToday - 86400000) return '昨天'
  if (t >= startOfToday - 6 * 86400000) return '本周'
  return '更早'
}

export function methodClass(m: string): string {
  return 'm-' + m.toLowerCase()
}

export function statusClass(status: number | null): string {
  if (!status) return 's-err'
  if (status < 300) return 's-2'
  if (status < 400) return 's-3'
  if (status < 500) return 's-4'
  return 's-5'
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url)
    return u.host + (u.pathname === '/' ? '' : u.pathname)
  } catch {
    return url
  }
}

export function fileName(p: string): string {
  return p.split(/[\\/]/).pop() ?? p
}

/** 由 URL 派生标签页标题（host + path，超长截断）；空 URL 返回「未命名请求」 */
export function titleFromUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return '未命名请求'
  let u = trimmed
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u
  try {
    const parsed = new URL(u)
    const s = parsed.host + (parsed.pathname === '/' ? '' : parsed.pathname)
    if (!s) return trimmed.slice(0, 24)
    return s.length > 24 ? s.slice(0, 24) + '…' : s
  } catch {
    return trimmed.slice(0, 24)
  }
}

export function urlDisplayName(url: string): string {
  return shortUrl(url)
}

export const METHOD_COLORS: Record<Method, string> = {
  GET: '#3fb950',
  POST: '#e8a33d',
  PUT: '#4c9ffe',
  PATCH: '#2dd4bf',
  DELETE: '#f4645f',
  HEAD: '#b48cf2',
  OPTIONS: '#8b8fa3'
}
