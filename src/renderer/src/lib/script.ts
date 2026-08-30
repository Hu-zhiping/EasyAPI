import type { EnvVariable, ScriptLogEntry, TestResult } from '../../../shared/types'

/** 供前置脚本读写的环境/全局变量适配器（由 tabs store 提供） */
export interface ScriptEnvAdapter {
  getEnv(name: string): string | null
  setEnv(name: string, value: string): void
  unsetEnv(name: string): void
  getGlobal(name: string): string | null
  setGlobal(name: string, value: string): void
  unsetGlobal(name: string): void
}

/** 前置脚本可直接修改的请求草稿（发送前生效） */
export interface ScriptDraft {
  method: string
  url: string
  headers: Array<{ key: string; value: string }>
}

export interface RunPreScriptOptions {
  code: string
  envs: ScriptEnvAdapter
  runtime: Map<string, string>
  draft: ScriptDraft
  logs: ScriptLogEntry[]
}

export function upsertVar(vars: EnvVariable[], key: string, value: string): EnvVariable[] {
  const idx = vars.findIndex((v) => v.key === key)
  if (idx >= 0) {
    const copy = vars.slice()
    copy[idx] = { ...copy[idx], value, enabled: true }
    return copy
  }
  return [...vars, { id: crypto.randomUUID(), key, value, enabled: true, desc: '' }]
}

function safeText(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null || v === undefined) return String(v)
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return '[object]'
    }
  }
  return String(v)
}

function makeHeaderHelper(headers: ScriptDraft['headers']) {
  const find = (name: string) => headers.find((h) => h.key.toLowerCase() === String(name).toLowerCase())
  return {
    add(h: { key: string; value: unknown }): void {
      if (h && h.key) headers.push({ key: String(h.key), value: safeText(h.value) })
    },
    upsert(h: { key: string; value: unknown }): void {
      if (!h || !h.key) return
      const existing = find(String(h.key))
      if (existing) existing.value = safeText(h.value)
      else headers.push({ key: String(h.key), value: safeText(h.value) })
    },
    get(name: string): string | null {
      return find(name)?.value ?? null
    },
    has(name: string): boolean {
      return !!find(name)
    },
    remove(name: string): void {
      const idx = headers.findIndex((h) => h.key.toLowerCase() === String(name).toLowerCase())
      if (idx >= 0) headers.splice(idx, 1)
    },
    all(): Array<{ key: string; value: string }> {
      return headers.map((h) => ({ ...h }))
    }
  }
}

/**
 * 在渲染进程沙箱中执行前置脚本（用户本机自写脚本，与 Postman 的信任模型一致）。
 * 脚本可以通过 pm.* 修改变量与请求草稿；运行期间的环境/全局变量修改会持久化。
 */
export async function runPreScript(opts: RunPreScriptOptions): Promise<{ error?: string }> {
  const { code, envs, runtime, draft, logs } = opts
  if (!code || !code.trim()) return {}

  const consoleShim = makeConsoleShim(logs)

  const chainGet = (name: string): string | null =>
    runtime.get(name) ?? envs.getEnv(name) ?? envs.getGlobal(name)

  const pm = {
    environment: {
      get: (n: string) => envs.getEnv(n),
      set: (n: string, v: unknown) => envs.setEnv(n, safeText(v)),
      unset: (n: string) => envs.unsetEnv(n)
    },
    globals: {
      get: (n: string) => envs.getGlobal(n),
      set: (n: string, v: unknown) => envs.setGlobal(n, safeText(v)),
      unset: (n: string) => envs.unsetGlobal(n)
    },
    variables: {
      /** 读取优先级：临时变量 > 环境变量 > 全局变量 */
      get: (n: string) => chainGet(n),
      set: (n: string, v: unknown) => void runtime.set(n, safeText(v)),
      unset: (n: string) => void runtime.delete(n)
    },
    request: {
      get method(): string {
        return draft.method
      },
      set method(v: string) {
        draft.method = String(v).toUpperCase()
      },
      get url(): string {
        return draft.url
      },
      set url(v: string) {
        draft.url = String(v)
      },
      headers: makeHeaderHelper(draft.headers)
    }
  }

  return runSandboxed(code, pm, consoleShim)
}

/* ==================== 测试脚本（断言） ==================== */

export interface ResponseAdapter {
  code: number
  status: string
  timeMs: number
  size: number
  headers: Array<{ key: string; value: string }>
  text: string
}

function fmtVal(v: unknown): string {
  if (typeof v === 'string') return `'${v}'`
  return safeText(v)
}

/** 精简版 chai 风格断言：pm.expect(x).to.eql(...) / .to.equal(...) / .to.match(...) 等 */
export function makeExpect(actual: unknown): { to: Record<string, unknown> } {
  const fail = (msg: string): never => {
    throw new Error(msg)
  }
  const to = {
    equal: (expected: unknown, msg?: string) => {
      if (actual !== expected) fail(msg ?? `断言失败：${fmtVal(actual)} 不等于 ${fmtVal(expected)}`)
    },
    eql: (expected: unknown, msg?: string) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        fail(msg ?? `断言失败：${fmtVal(actual)} 深度不等于 ${fmtVal(expected)}`)
      }
    },
    match: (re: RegExp | string, msg?: string) => {
      if (!new RegExp(re).test(String(actual))) fail(msg ?? `断言失败：${fmtVal(actual)} 不匹配 ${String(re)}`)
    },
    include: (frag: unknown, msg?: string) => {
      if (!String(actual).includes(String(frag))) fail(msg ?? `断言失败：${fmtVal(actual)} 不包含 ${fmtVal(frag)}`)
    },
    be: {
      above: (n: number, msg?: string) => {
        if (!(Number(actual) > n)) fail(msg ?? `断言失败：${fmtVal(actual)} 不大于 ${n}`)
      },
      below: (n: number, msg?: string) => {
        if (!(Number(actual) < n)) fail(msg ?? `断言失败：${fmtVal(actual)} 不小于 ${n}`)
      },
      oneOf: (list: unknown[], msg?: string) => {
        if (!Array.isArray(list) || !list.includes(actual)) {
          fail(msg ?? `断言失败：${fmtVal(actual)} 不在 ${fmtVal(list)} 中`)
        }
      }
    },
    have: {
      property: (name: string, msg?: string) => {
        if (actual === null || actual === undefined || !(name in (actual as object))) {
          fail(msg ?? `断言失败：对象不包含属性 ${name}`)
        }
      }
    },
    a: {
      string: () => {
        if (typeof actual !== 'string') fail(`断言失败：${fmtVal(actual)} 不是 string`)
      },
      number: () => {
        if (typeof actual !== 'number') fail(`断言失败：${fmtVal(actual)} 不是 number`)
      },
      object: () => {
        if (typeof actual !== 'object' || actual === null) fail(`断言失败：${fmtVal(actual)} 不是 object`)
      }
    }
  }
  return { to }
}

function makeResponseApi(r: ResponseAdapter): Record<string, unknown> {
  let parsed: { ok: boolean; value?: unknown; err?: string } = { ok: false }
  const parseOnce = (): unknown => {
    if (!parsed.ok && parsed.err === undefined) {
      try {
        parsed = { ok: true, value: JSON.parse(r.text) }
      } catch (e) {
        parsed = { ok: false, err: e instanceof Error ? e.message : String(e) }
      }
    }
    if (!parsed.ok) throw new Error(`响应体不是合法 JSON：${parsed.err}`)
    return parsed.value
  }
  const headerOf = (name: string): string | null =>
    r.headers.find((h) => h.key.toLowerCase() === String(name).toLowerCase())?.value ?? null
  return {
    get code() {
      return r.code
    },
    get status() {
      return r.status
    },
    get responseTime() {
      return r.timeMs
    },
    get size() {
      return r.size
    },
    headers: {
      get: headerOf,
      all: () => r.headers.map((h) => ({ ...h }))
    },
    text: () => r.text,
    json: parseOnce,
    to: {
      have: {
        status: (code: number) => {
          if (r.code !== code) throw new Error(`断言失败：状态码 ${r.code} 不等于 ${code}`)
        },
        header: (name: string, value?: string) => {
          const v = headerOf(name)
          if (v === null) throw new Error(`断言失败：响应头 ${name} 不存在`)
          if (value !== undefined && v !== value) throw new Error(`断言失败：响应头 ${name}=${v} 不等于 ${value}`)
        },
        body: (frag: string) => {
          if (!r.text.includes(String(frag))) throw new Error(`断言失败：响应体不包含 ${frag}`)
        }
      }
    }
  }
}

export interface RunTestScriptOptions {
  code: string
  envs: ScriptEnvAdapter
  response: ResponseAdapter
  logs: ScriptLogEntry[]
  results: TestResult[]
}

/** 响应返回后执行测试脚本：pm.test 注册断言，pm.response / pm.expect 提供校验能力 */
export async function runTestScript(opts: RunTestScriptOptions): Promise<{ error?: string }> {
  const { code, envs, response, logs, results } = opts
  if (!code || !code.trim()) return {}

  const consoleShim = makeConsoleShim(logs)
  const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e))

  const pm = {
    environment: {
      get: (n: string) => envs.getEnv(n),
      set: (n: string, v: unknown) => envs.setEnv(n, safeText(v)),
      unset: (n: string) => envs.unsetEnv(n)
    },
    globals: {
      get: (n: string) => envs.getGlobal(n),
      set: (n: string, v: unknown) => envs.setGlobal(n, safeText(v)),
      unset: (n: string) => envs.unsetGlobal(n)
    },
    response: makeResponseApi(response),
    expect: makeExpect,
    test: (name: string, fn: () => void | Promise<void>): Promise<void> | void => {
      try {
        const r = fn()
        if (r && typeof (r as Promise<void>).then === 'function') {
          return (r as Promise<void>).then(
            () => {
              results.push({ name, passed: true })
            },
            (e) => {
              results.push({ name, passed: false, error: msg(e) })
            }
          )
        }
        results.push({ name, passed: true })
      } catch (e) {
        results.push({ name, passed: false, error: msg(e) })
      }
    }
  }

  return runSandboxed(code, pm, consoleShim)
}

function makeConsoleShim(logs: ScriptLogEntry[]) {
  const push = (level: ScriptLogEntry['level'], args: unknown[]): void => {
    logs.push({ level, text: args.map(safeText).join(' '), at: new Date().toISOString() })
    if (logs.length > 100) logs.shift()
  }
  return {
    log: (...args: unknown[]) => push('log', args),
    info: (...args: unknown[]) => push('info', args),
    warn: (...args: unknown[]) => push('warn', args),
    error: (...args: unknown[]) => push('error', args)
  }
}

async function runSandboxed(
  code: string,
  pm: Record<string, unknown>,
  consoleShim: Record<string, unknown>
): Promise<{ error?: string }> {
  try {
    const AsyncFunction = Object.getPrototypeOf(async function () {
      /* 占位 */
    }).constructor as new (...args: string[]) => (pm: unknown, con: unknown) => Promise<void>
    const fn = new AsyncFunction('pm', 'console', code)
    await fn(pm, consoleShim)
    // 给未显式 await 的异步 pm.test 留一次微任务排空机会
    await Promise.resolve()
    await Promise.resolve()
    return {}
  } catch (e) {
    return { error: e instanceof Error ? `${e.name}: ${e.message}` : String(e) }
  }
}
