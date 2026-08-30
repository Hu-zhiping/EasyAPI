import { ipcMain } from 'electron'
import axios from 'axios'
import FormData from 'form-data'
import fs from 'node:fs'
import http from 'node:http'
import https from 'node:https'
import type { HttpRequestPayload, ResponseInfo, ResponseHeader } from '../shared/types'

const pending = new Map<string, AbortController>()

const STATUS_TEXT: Record<number, string> = {
  100: 'Continue', 101: 'Switching Protocols', 200: 'OK', 201: 'Created', 202: 'Accepted',
  204: 'No Content', 206: 'Partial Content', 301: 'Moved Permanently', 302: 'Found',
  303: 'See Other', 304: 'Not Modified', 307: 'Temporary Redirect', 308: 'Permanent Redirect',
  400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden', 404: 'Not Found',
  405: 'Method Not Allowed', 406: 'Not Acceptable', 408: 'Request Timeout', 409: 'Conflict',
  410: 'Gone', 413: 'Payload Too Large', 415: 'Unsupported Media Type', 422: 'Unprocessable Entity',
  429: 'Too Many Requests', 500: 'Internal Server Error', 501: 'Not Implemented',
  502: 'Bad Gateway', 503: 'Service Unavailable', 504: 'Gateway Timeout', 505: 'HTTP Version Not Supported'
}

const TLS_CODES = new Set([
  'EPROTO', 'ERR_TLS_CERT_ALTNAME_INVALID', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'CERT_HAS_EXPIRED', 'ERR_SSL_WRONG_VERSION_NUMBER', 'E_CERT'
])

function friendlyError(code: string | undefined, raw: string): string {
  switch (code) {
    case 'ENOTFOUND': return '无法解析主机名，请检查 URL 拼写或网络连接'
    case 'ECONNREFUSED': return '连接被拒绝，目标服务可能未启动或端口不正确'
    case 'ECONNRESET': return '连接被重置，服务端提前断开了连接'
    case 'ETIMEDOUT': return '连接超时，目标服务器无响应'
    case 'ECONNABORTED': return '请求超时，可在「设置」中调整超时时间'
    case 'EHOSTUNREACH':
    case 'ENETUNREACH': return '无法访问目标网络，请检查网络或代理设置'
    case 'ERR_CANCELED': return '请求已取消'
    case 'EPROTO': return 'TLS 协议错误，服务端可能不支持 HTTPS'
    default:
      if (code && TLS_CODES.has(code)) return `SSL 证书验证失败（${code}）。如为自签名证书，可在「设置」中关闭 SSL 验证`
      return raw || '请求失败'
  }
}

function isTexty(contentType: string, buf: Buffer): boolean {
  if (contentType) {
    return /(text\/|json|xml|javascript|html|x-www-form-urlencoded|csv|markdown|graphql)/i.test(contentType)
  }
  const sample = buf.subarray(0, 2048).toString('utf-8')
  let bad = 0
  for (const ch of sample) if (ch === '\uFFFD') bad++
  return sample.length > 0 && bad / Math.max(sample.length, 1) < 0.02
}

function decodeBody(buf: Buffer, contentType: string): { text: string | null; charset: string } {
  const m = /charset=([\w-]+)/i.exec(contentType)
  const charset = (m?.[1] ?? 'utf-8').toLowerCase()
  if (!isTexty(contentType, buf)) return { text: null, charset }
  let dec: InstanceType<typeof TextDecoder>
  try {
    dec = new TextDecoder(charset)
  } catch {
    dec = new TextDecoder('utf-8')
  }
  return { text: dec.decode(buf), charset }
}

function flattenHeaders(h: Record<string, unknown>): ResponseHeader[] {
  return Object.entries(h).map(([key, value]) => ({
    key,
    value: Array.isArray(value) ? value.join('\n') : String(value)
  }))
}

function buildAxiosConfig(p: HttpRequestPayload) {
  const headers: Record<string, string> = { ...p.headers }
  const hasHeader = (name: string): boolean =>
    Object.keys(headers).some((k) => k.toLowerCase() === name.toLowerCase())

  let data: string | FormData | fs.ReadStream | undefined
  if (p.bodyMode === 'raw') {
    data = p.rawContent ?? ''
    if (!hasHeader('content-type') && data) {
      const ct: Record<string, string> = {
        json: 'application/json',
        xml: 'application/xml',
        html: 'text/html',
        javascript: 'application/javascript',
        text: 'text/plain'
      }
      headers['Content-Type'] = ct[p.rawLanguage] ?? 'text/plain'
    }
  } else if (p.bodyMode === 'urlencoded') {
    data = new URLSearchParams(p.urlencoded ?? []).toString()
    if (!hasHeader('content-type')) headers['Content-Type'] = 'application/x-www-form-urlencoded'
  } else if (p.bodyMode === 'form-data') {
    const fd = new FormData()
    for (const f of p.formFields ?? []) {
      if (!f.key) continue
      if (f.type === 'file' && f.value) fd.append(f.key, fs.createReadStream(f.value), { filename: f.value.split(/[\\/]/).pop() })
      else fd.append(f.key, f.value)
    }
    data = fd
    if (!hasHeader('content-type')) Object.assign(headers, fd.getHeaders())
  } else if (p.bodyMode === 'binary') {
    data = fs.createReadStream(p.binaryPath ?? '')
    if (!hasHeader('content-type')) headers['Content-Type'] = 'application/octet-stream'
  }

  const agents: Record<string, http.Agent | https.Agent> = {}
  if (!p.sslVerify) {
    agents.httpAgent = new http.Agent({ keepAlive: false })
    agents.httpsAgent = new https.Agent({ rejectUnauthorized: false })
  }

  return {
    method: p.method.toLowerCase() as never,
    url: p.url,
    headers,
    data,
    timeout: p.timeoutMs > 0 ? p.timeoutMs : 0,
    maxRedirects: p.followRedirects ? 5 : 0,
    responseType: 'arraybuffer' as const,
    validateStatus: () => true,
    signal: undefined as AbortSignal | undefined,
    ...agents
  }
}

export function registerRequestHandlers(): void {
  ipcMain.handle('http:request', async (_e, payload: HttpRequestPayload): Promise<ResponseInfo> => {
    const start = Date.now()
    const controller = new AbortController()
    pending.set(payload.id, controller)
    const base: ResponseInfo = {
      id: payload.id,
      status: 0,
      statusText: '',
      ok: false,
      timeMs: 0,
      size: 0,
      headers: [],
      bodyBase64: null,
      bodyText: null,
      contentType: '',
      charset: 'utf-8',
      truncated: false,
      requestUrl: payload.url,
      method: payload.method,
      sentAt: new Date().toISOString()
    }
    try {
      // 本地文件类的二进制体在发送前校验，给出更友好的错误
      if (payload.bodyMode === 'binary' && payload.binaryPath && !fs.existsSync(payload.binaryPath)) {
        throw new Error('选择的文件不存在，请重新选择')
      }
      if (payload.bodyMode === 'form-data') {
        for (const f of payload.formFields ?? []) {
          if (f.type === 'file' && f.value && !fs.existsSync(f.value)) {
            throw new Error(`文件不存在: ${f.value}`)
          }
        }
      }
      const cfg = buildAxiosConfig(payload)
      cfg.signal = controller.signal
      const res = await axios.request(cfg)
      const buf = Buffer.from(res.data as ArrayBuffer)
      const contentType = String(res.headers['content-type'] ?? '')
      const { text, charset } = decodeBody(buf, contentType)
      const limit = 8 * 1024 * 1024
      const bigText = text && text.length > 2 * 1024 * 1024
      return {
        ...base,
        status: res.status,
        statusText: res.statusText || STATUS_TEXT[res.status] || '',
        ok: res.status >= 200 && res.status < 300,
        timeMs: Date.now() - start,
        size: buf.length,
        headers: flattenHeaders(res.headers as Record<string, unknown>),
        bodyBase64: buf.length <= limit ? buf.toString('base64') : null,
        bodyText: bigText ? text!.slice(0, 2 * 1024 * 1024) : text,
        contentType,
        charset,
        truncated: !!bigText || buf.length > limit
      }
    } catch (err) {
      const timeMs = Date.now() - start
      if (axios.isAxiosError(err)) {
        if (err.code === 'ERR_CANCELED') {
          return { ...base, timeMs, error: '请求已取消', errorCode: 'ERR_CANCELED' }
        }
        return {
          ...base,
          timeMs,
          error: friendlyError(err.code ?? '', err.message),
          errorCode: err.code ?? 'ERROR'
        }
      }
      return {
        ...base,
        timeMs,
        error: friendlyError(undefined, err instanceof Error ? err.message : String(err)),
        errorCode: 'ERROR'
      }
    } finally {
      pending.delete(payload.id)
    }
  })

  ipcMain.on('http:cancel', (_e, id: string) => {
    pending.get(id)?.abort()
  })
}
