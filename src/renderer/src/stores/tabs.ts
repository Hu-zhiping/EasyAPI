import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { PersistedTab, Method, RequestDef, ResponseInfo, ScriptLogEntry, Tab, TestResult } from '../../../shared/types'
import { METHODS } from '../../../shared/types'
import { buildPayload, emptyRequestDef, requestDefFromNode } from '../lib/http'
import { runPreScript, runTestScript, upsertVar, type ScriptEnvAdapter } from '../lib/script'
import { parseSetCookies, matchCookies } from '../lib/cookies'
import { useAppStore } from './app'
import { useCollectionsStore } from './collections'
import { useEnvsStore } from './envs'
import { useHistoryStore } from './history'
import { watchPersist } from './persist'
import { findInCollections } from '../lib/tree'

const inflight = new Map<string, string>()

export const useTabsStore = defineStore('tabs', () => {
  const tabs = ref<Tab[]>([])
  const activeId = ref<string | null>(null)

  const activeTab = computed<Tab | null>(() => tabs.value.find((t) => t.id === activeId.value) ?? null)

  function newTab(def?: Partial<RequestDef>, title?: string): Tab {
    const tab: Tab = {
      id: crypto.randomUUID(),
      title: title ?? '未命名请求',
      request: { ...emptyRequestDef(def?.method ?? 'GET'), ...JSON.parse(JSON.stringify(def ?? {})) },
      response: null,
      sending: false,
      savedRef: null,
      subTab: def?.url ? 'body' : 'params',
      respTab: 'pretty',
      lastError: null,
      scriptError: null,
      testResults: null,
      sentReq: null
    }
    if (def?.method && def.method !== 'GET') tab.request.method = def.method
    if (def?.body && def.body.mode !== 'none') tab.subTab = 'body'
    tabs.value.push(tab)
    activeId.value = tab.id
    return tab
  }

  function openRequest(nodeName: string, def: RequestDef, savedRef: Tab['savedRef']): void {
    const existing = tabs.value.find((t) => t.savedRef?.nodeId === savedRef?.nodeId)
    if (existing) {
      activeId.value = existing.id
      return
    }
    const tab: Tab = {
      id: crypto.randomUUID(),
      title: nodeName,
      request: requestDefFromNode(def),
      response: null,
      sending: false,
      savedRef,
      subTab: 'params',
      respTab: 'pretty',
      lastError: null,
      scriptError: null,
      testResults: null,
      sentReq: null
    }
    tabs.value.push(tab)
    activeId.value = tab.id
  }

  function closeTab(id: string): void {
    const idx = tabs.value.findIndex((t) => t.id === id)
    if (idx < 0) return
    const wasActive = activeId.value === id
    const t = tabs.value[idx]
    if (t.sending) cancel(t.id)
    tabs.value.splice(idx, 1)
    if (wasActive) {
      const next = tabs.value[Math.min(idx, tabs.value.length - 1)]
      activeId.value = next?.id ?? null
    }
  }

  function closeOthers(id: string): void {
    for (const t of [...tabs.value]) if (t.id !== id) closeTab(t.id)
  }

  function closeRight(id: string): void {
    const idx = tabs.value.findIndex((t) => t.id === id)
    for (const t of tabs.value.slice(idx + 1)) closeTab(t.id)
  }

  function isDirty(tab: Tab): boolean {
    if (!tab.savedRef) return tab.request.url !== '' || tab.request.body.mode !== 'none' || tab.request.headers.length > 0
    const cols = useCollectionsStore()
    const found = findInCollections(cols.collections, tab.savedRef.nodeId)
    if (!found || found.node.type !== 'request') return false
    return canonical(found.node) !== canonical(tab.request)
  }

  function canonical(r: RequestDef): string {
    // 忽略全空的行，避免自动补位的空行导致「未保存」误判
    const strip = (rows: RequestDef['params']): RequestDef['params'] => rows.filter((x) => x.key || x.value)
    return JSON.stringify({
      m: r.method,
      u: r.url,
      p: strip(r.params),
      h: strip(r.headers),
      b: { ...r.body, form: strip(r.body.form), urlencoded: strip(r.body.urlencoded) },
      a: r.auth,
      s: r.preScript ?? '',
      t: r.tests ?? ''
    })
  }

  async function send(tabId: string): Promise<void> {
    const app = useAppStore()
    const envs = useEnvsStore()
    const history = useHistoryStore()
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab || tab.sending) return

    tab.sending = true
    tab.lastError = null
    tab.scriptError = null
    tab.testResults = null
    const inflightId = crypto.randomUUID()
    inflight.set(tab.id, inflightId)

    try {
      // ---- 前置脚本：先于变量解析执行，可修改方法 / URL / 请求头，可写变量 ----
      const logs: ScriptLogEntry[] = []
      const runtime = new Map<string, string>()
      const draft = {
        method: tab.request.method as string,
        url: tab.request.url,
        headers: tab.request.headers.filter((h) => h.enabled && h.key).map((h) => ({ key: h.key, value: h.value }))
      }

      // 环境变量适配器：前置脚本与测试脚本共用（修改变量会持久化）
      const scriptEnvs: ScriptEnvAdapter = {
        getEnv: (n) => envs.activeEnv?.variables.find((v) => v.enabled && v.key === n)?.value ?? null,
        setEnv: (n, v) => {
          const env = envs.activeEnv
          if (env) env.variables = upsertVar(env.variables, n, v)
          else {
            envs.globals = upsertVar(envs.globals, n, v)
            logs.push({ level: 'info', text: `未选择环境，「${n}」已写入全局变量`, at: new Date().toISOString() })
          }
        },
        unsetEnv: (n) => {
          const env = envs.activeEnv
          if (env) env.variables = env.variables.filter((x) => x.key !== n)
        },
        getGlobal: (n) => envs.globals.find((v) => v.enabled && v.key === n)?.value ?? null,
        setGlobal: (n, v) => {
          envs.globals = upsertVar(envs.globals, n, v)
        },
        unsetGlobal: (n) => {
          envs.globals = envs.globals.filter((x) => x.key !== n)
        }
      }

      if ((tab.request.preScript ?? '').trim()) {
        const result = await runPreScript({ code: tab.request.preScript ?? '', envs: scriptEnvs, runtime, draft, logs })
        if (inflight.get(tab.id) !== inflightId) return
        if (result.error) {
          tab.scriptError = result.error
          app.toast('前置脚本执行失败，请求未发送', 'error')
          return
        }
      }

      if (!draft.url.trim()) {
        app.toast('请先输入请求 URL', 'error')
        return
      }

      // ---- Cookie 自动管理：附加该域的 Cookie（用户手动设置了 Cookie 头时不覆盖） ----
      const { matched: matchedCookies, expiredIds } = matchCookies(app.cookies, draft.url)
      if (expiredIds.length) app.cookies = app.cookies.filter((c) => !expiredIds.includes(c.id))
      if (matchedCookies.length && !draft.headers.some((h) => h.key.toLowerCase() === 'cookie')) {
        draft.headers.push({ key: 'Cookie', value: matchedCookies.map((c) => `${c.name}=${c.value}`).join('; ') })
      }

      // 脚本修改后的请求定义（body/params/auth 沿用原值）
      const method = METHODS.includes(draft.method as Method) ? (draft.method as Method) : tab.request.method
      const effective: RequestDef = {
        ...JSON.parse(JSON.stringify(tab.request)),
        method,
        url: draft.url,
        headers: draft.headers.map((h) => ({ id: crypto.randomUUID(), key: h.key, value: h.value, enabled: true, desc: '' }))
      }

      const runtimeVars = [...runtime].map(([key, value]) => ({ id: crypto.randomUUID(), key, value, enabled: true }))
      const payload = buildPayload(effective, {
        env: envs.activeEnv?.variables ?? [],
        globals: envs.globals,
        runtime: runtimeVars
      })
      const reqId = crypto.randomUUID()
      inflight.set(tab.id, reqId)

      const res = await window.api.sendRequest({
        ...payload,
        id: reqId,
        timeoutMs: app.settings.timeoutMs,
        followRedirects: app.settings.followRedirects,
        sslVerify: app.settings.sslVerify
      })
      if (inflight.get(tab.id) !== reqId) return
      if (res.errorCode === 'ERR_CANCELED') {
        app.toast('请求已取消', 'info')
        return
      }
      tab.sentReq = {
        method: res.method,
        url: res.requestUrl,
        headers: Object.entries(payload.headers).map(([key, value]) => ({ key, value }))
      }
      tab.response = res
      if (res.error) tab.lastError = res.error

      // ---- Cookie 自动管理：保存响应的 Set-Cookie ----
      const newCookies = parseSetCookies(res.headers, res.requestUrl)
      if (newCookies.length) app.mergeCookies(newCookies)

      // ---- 测试脚本（断言）：响应返回后执行 ----
      if ((tab.request.tests ?? '').trim()) {
        const results: TestResult[] = []
        const r2 = await runTestScript({
          code: tab.request.tests ?? '',
          envs: scriptEnvs,
          logs,
          results,
          response: {
            code: res.status,
            status: res.statusText,
            timeMs: res.timeMs,
            size: res.size,
            headers: res.headers,
            text: res.bodyText ?? ''
          }
        })
        if (inflight.get(tab.id) !== reqId) return
        if (r2.error) {
          tab.testResults = [{ name: '测试脚本执行失败', passed: false, error: r2.error }]
          app.toast('测试脚本执行失败', 'error')
        } else {
          tab.testResults = results
        }
      }

      history.add({
        method: res.method,
        url: res.requestUrl,
        status: res.status || null,
        ok: res.ok,
        durationMs: res.timeMs,
        size: res.size,
        error: res.error,
        at: new Date().toISOString(),
        request: JSON.parse(JSON.stringify(tab.request))
      })
      app.pushConsole({
        id: crypto.randomUUID(),
        at: res.sentAt,
        method: res.method,
        url: res.requestUrl,
        status: res.status || null,
        ok: res.ok,
        durationMs: res.timeMs,
        size: res.size,
        error: res.error,
        requestHeaders: payload.headers,
        responseHeaders: res.headers,
        scriptLogs: logs.length ? logs : undefined,
        scriptError: tab.scriptError ?? undefined,
        testResults: tab.testResults ?? undefined
      })
    } catch (err) {
      tab.lastError = err instanceof Error ? err.message : String(err)
      app.toast(tab.lastError, 'error')
    } finally {
      inflight.delete(tab.id)
      const cur = tabs.value.find((t) => t.id === tabId)
      if (cur) cur.sending = false
    }
  }

  function cancel(tabId: string): void {
    const reqId = inflight.get(tabId)
    if (reqId) window.api.cancelRequest(reqId)
  }

  function sendActive(): void {
    if (activeId.value) void send(activeId.value)
  }

  function markSaved(tabId: string, collectionId: string, nodeId: string, name: string): void {
    const tab = tabs.value.find((t) => t.id === tabId)
    if (!tab) return
    tab.savedRef = { collectionId, nodeId, name }
    tab.title = name
  }

  /** 保存当前标签页：已关联集合时直接更新，否则弹保存对话框；as=true 强制另存为 */
  function saveActive(as = false): void {
    const app = useAppStore()
    const cols = useCollectionsStore()
    const t = activeTab.value
    if (!t) {
      app.toast('没有可保存的请求', 'info')
      return
    }
    if (!as && t.savedRef) {
      const ok = cols.updateRequestNode(t.savedRef.nodeId, t.request, t.title)
      if (ok) {
        app.toast('已保存到集合', 'success')
        return
      }
      // 原集合位置已不存在（如集合被删除），引导重新选择保存位置
      app.toast('原保存位置已不存在，请重新选择', 'error')
    }
    app.modal = { type: 'save-request', tabId: t.id }
  }

  function hydrateSession(sessionTabs: PersistedTab[]): void {
    for (const s of sessionTabs) {
      const tab: Tab = {
        id: crypto.randomUUID(),
        title: s.title,
        request: requestDefFromNode(s.request),
        response: null,
        sending: false,
        savedRef: s.savedRef,
        subTab: s.subTab ?? 'params',
        respTab: 'pretty',
        lastError: null,
        scriptError: null,
        testResults: null,
        sentReq: null
      }
      tabs.value.push(tab)
    }
    activeId.value = tabs.value[0]?.id ?? null
    if (!tabs.value.length) newTab()
  }

  watchPersist(
    () =>
      tabs.value.map((t): PersistedTab => ({
        title: t.title,
        request: JSON.parse(JSON.stringify(t.request)) as RequestDef,
        savedRef: t.savedRef,
        subTab: t.subTab
      })),
    'sessionTabs'
  )

  return {
    tabs,
    activeId,
    activeTab,
    newTab,
    openRequest,
    closeTab,
    closeOthers,
    closeRight,
    isDirty,
    send,
    cancel,
    sendActive,
    markSaved,
    saveActive,
    hydrateSession
  }
})
