// EasyAPI E2E 功能测试探针：通过 CDP 驱动真实 UI，黑盒验证各功能模块
// 前置：应用以 --remote-debugging-port=9222 运行；scripts/test-server.mjs 已启动
const BASE = 'http://127.0.0.1:18080'

/* ---------- CDP 基础 ---------- */
const list = await (await fetch('http://127.0.0.1:9222/json/list')).json()
const page = list.find((t) => t.type === 'page')
if (!page) {
  console.error('FATAL: 未找到页面 target')
  process.exit(1)
}
const ws = new WebSocket(page.webSocketDebuggerUrl)
let mid = 0
const pending = new Map()
function send(method, params = {}, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const id = ++mid
    const timer = setTimeout(() => {
      pending.delete(id)
      reject(new Error('TIMEOUT ' + method))
    }, timeoutMs)
    pending.set(id, { resolve, reject, timer })
    ws.send(JSON.stringify({ id, method, params }))
  })
}
ws.onmessage = (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const p = pending.get(msg.id)
    pending.delete(msg.id)
    clearTimeout(p.timer)
    msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result)
  }
}
await new Promise((r, rej) => {
  ws.onopen = r
  ws.onerror = rej
  setTimeout(() => rej(new Error('WS 连接超时')), 8000)
})
await send('Runtime.enable')
await send('Page.enable')

/* ---------- 探针工具 ---------- */
async function ev(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.exceptionDetails) throw new Error('页面执行异常: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 300) + ` << ${expr.slice(0, 120)}`)
  return r.result.value
}
const q = (s) => `document.querySelector(${JSON.stringify(s)})`
const qa = (s) => `document.querySelectorAll(${JSON.stringify(s)})`

async function click(sel) {
  const ok = await ev(`!!${q(sel)} && (${q(sel)}.click(), true)`)
  if (!ok) throw new Error('元素不存在，无法点击: ' + sel)
}
async function clickByText(sel, text) {
  const found = await ev(`(() => {
    const els = [...${qa(sel)}]
    const el = els.find((e) => e.textContent.trim().includes(${JSON.stringify(text)}))
    if (!el) return false
    el.click(); return true
  })()`)
  if (!found) throw new Error(`未找到文本为「${text}」的 ${sel}`)
}
async function setInput(sel, value, kind = 'input') {
  await ev(`(() => {
    const el = ${q(sel)}
    if (!el) throw new Error('输入框不存在: ${sel}')
    const proto = ${kind === 'textarea' ? 'HTMLTextAreaElement' : 'HTMLInputElement'}.prototype
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(value)})
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
}
async function waitFor(desc, expr, timeoutMs = 8000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await ev(`!!(${expr})`)) return
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error('等待超时: ' + desc)
}
async function textOf(sel) {
  return (await ev(`${q(sel)}?.textContent ?? ''`)).trim()
}
/** 向 CodeMirror 编辑器粘贴内容（CM6 监听 paste 事件） */
async function cmPaste(sel, text) {
  await ev(`(() => {
    const el = ${q(sel)}
    if (!el) throw new Error('编辑器不存在: ${sel}')
    el.focus()
    const dt = new DataTransfer()
    dt.setData('text/plain', ${JSON.stringify(text)})
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
  })()`)
  await new Promise((r) => setTimeout(r, 120))
}
/** KV 表格第 row 行设置 key(0)/value(1)/desc(2) */
async function setKV(row, col, value) {
  await ev(`(() => {
    const tr = ${qa('.kv-grid .kv-tr')}[${row}]
    if (!tr) throw new Error('KV 行不存在 #' + ${row})
    const input = tr.querySelectorAll('input.bare')[${col}]
    if (!input) throw new Error('KV 列不存在')
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(value)})
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })()`)
}
/** 新建一个空白标签页并等待就绪 */
async function newTab() {
  const before = await ev(`${qa('.tab')}.length`)
  await click('.tab-add')
  await waitFor('新标签页出现', `${qa('.tab')}.length > ${before}`)
}
/** 设置 URL 并发送，等待响应视图（状态条或错误卡）出现 */
async function sendUrl(url, method) {
  if (method && method !== 'GET') {
    await click('.method-select-trigger')
    await waitFor('方法下拉出现', `!!${q('.pop-menu .pop-item')}`)
    await clickByText('.pop-menu .pop-item', method)
  }
  await setInput('.url-input', url)
  await ev(`${q('.send-btn')}.click()`)
  await waitFor('响应到达', `!!${q('.status-chip')} || !!${q('.error-card')}`, 10000)
}
function assert(cond, msg) {
  if (!cond) throw new Error('断言失败: ' + msg)
}

/* ---------- 测试框架 ---------- */
const results = []
let group = ''
async function test(name, fn) {
  const t0 = Date.now()
  try {
    await fn()
    results.push({ group, name, ok: true, ms: Date.now() - t0 })
    console.log(`  ✓ ${name} (${Date.now() - t0}ms)`)
  } catch (e) {
    results.push({ group, name, ok: false, err: String(e.message ?? e).slice(0, 220), ms: Date.now() - t0 })
    console.log(`  ✗ ${name} — ${String(e.message ?? e).slice(0, 180)}`)
  }
}
const G = (g) => () => (group = g, console.log(''))

/* ---------- A. 标签页 ---------- */
await G('A 标签页')()
await test('新建标签页', async () => {
  const before = await ev(`${qa('.tab')}.length`)
  await newTab()
  assert((await ev(`${qa('.tab')}.length`)) === before + 1, '标签数量应 +1')
})
await test('双击重命名标签页', async () => {
  await ev(`${q('.tab.active .tab-title')}.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))`)
  await waitFor('重命名输入框出现', `!!${q('.tab-edit')}`)
  await setInput('.tab-edit', 'E2E-改名测试')
  await ev(`${q('.tab-edit')}.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))`)
  await waitFor('标题生效', `${q('.tab.active .tab-title')}.textContent.includes('E2E-改名测试')`)
})
await test('关闭标签页', async () => {
  const before = await ev(`${qa('.tab')}.length`)
  await ev(`${q('.tab.active .tab-close')}.click()`)
  await waitFor('标签数量 -1', `${qa('.tab')}.length === ${before - 1}`)
})

/* ---------- B. 请求构建与发送 ---------- */
await G('B 请求构建与发送')()
await test('GET 请求返回 200 + 状态栏概要', async () => {
  await newTab()
  await sendUrl(BASE + '/ping')
  const chip = await textOf('.status-chip')
  assert(chip.includes('200'), '状态条应为 200，实际: ' + chip)
  assert(chip.toLowerCase().includes('ok'), '应含状态文本 OK')
  assert(!!(await ev(`!!${q('.sb-resp')}`)), '状态栏应显示响应概要')
})
await test('方法切换为 POST + raw JSON body（自动 Content-Type）', async () => {
  await newTab()
  await clickByText('.req-tabs .req-tab', 'Body')
  await ev(`(() => { [...${qa('.body-mode-seg button')}].find((b) => b.textContent.trim() === 'raw')?.click() })()`)
  await cmPaste('.code-host .cm-content', '{"name":"EasyAPI","n":1}')
  await sendUrl(BASE + '/echo', 'POST')
  assert((await textOf('.status-chip')).includes('201'), 'POST /echo 应回 201')
  await waitFor('美化视图渲染', `!!${q('.resp-body .cm-content')}`)
  const body = await textOf('.resp-body .cm-content')
  assert(body.includes('EasyAPI'), '响应应回显 body（echo 的 body 为 JSON 转义串，匹配原文即可）')
  assert(body.toLowerCase().includes('application/json'), '应自动带 application/json')
})
await test('参数表 → URL 双向同步', async () => {
  await newTab()
  await clickByText('.req-tabs .req-tab', '参数')
  await setKV(0, 0, 'a')
  await setKV(0, 1, '1')
  await waitFor('URL 同步查询串', `${q('.url-input')}.value.includes('a=1')`)
  await setInput('.url-input', BASE + '/echo?b=2')
  await new Promise((r) => setTimeout(r, 250))
  const back = await ev(`[...${qa('.kv-grid .kv-tr input.bare')}].map((i) => i.value).join(',')`)
  assert(back.includes('b') && back.includes('2'), 'URL → 参数表应回填 b=2，实际: ' + back)
})
await test('自定义请求头随请求发送', async () => {
  await newTab()
  await clickByText('.req-tabs .req-tab', '请求头')
  await setKV(0, 0, 'X-Client')
  await setKV(0, 1, 'EasyTest')
  await sendUrl(BASE + '/echo')
  const body = await textOf('.resp-body .cm-content')
  assert(body.toLowerCase().includes('x-client') && body.includes('EasyTest'), '服务端应回显自定义头')
})
await test('Bearer 授权自动生成 Authorization（自动头可视化）', async () => {
  await newTab()
  await clickByText('.req-tabs .req-tab', '授权')
  await ev(`[...${qa('.editor-area .pop-trigger')}][0]?.click()`)
  await waitFor('授权类型下拉', `!!${q('.pop-menu .pop-item')}`)
  await clickByText('.pop-menu .pop-item', 'Bearer')
  await waitFor('Bearer token 输入框', `!!${q('.editor-area .input.mono')}`)
  await setInput('.editor-area .input.mono', 'abc.def.ghi')
  await clickByText('.req-tabs .req-tab', '请求头')
  await waitFor('自动头行出现', `${qa('.auto-header-row')}.length >= 1`)
  const auto = await textOf('.auto-headers')
  assert(auto.includes('Authorization') && auto.includes('Bearer abc.def.ghi'), '应显示自动 Authorization 头')
  await sendUrl(BASE + '/echo')
  const body = await textOf('.resp-body .cm-content')
  assert(body.includes('Bearer abc.def.ghi'), '服务端应收到 Bearer 头')
})
await test('x-www-form-urlencoded body', async () => {
  await newTab()
  await clickByText('.req-tabs .req-tab', 'Body')
  await ev(`(() => { [...${qa('.body-mode-seg button')}].find((b) => b.textContent.trim() === 'x-www-form-urlencoded')?.click() })()`)
  await new Promise((r) => setTimeout(r, 150))
  await setKV(0, 0, 'k1')
  await setKV(0, 1, 'v1')
  await sendUrl(BASE + '/echo', 'POST')
  const body = await textOf('.resp-body .cm-content')
  assert(body.includes('k1=v1'), '应回显 form body')
  assert(body.toLowerCase().includes('x-www-form-urlencoded'), '应自动带表单 Content-Type')
})

/* ---------- C. 前置脚本与断言 ---------- */
await G('C 前置脚本与断言')()
await test('前置脚本：写环境变量 + console.log 输出', async () => {
  await newTab()
  await clickByText('.req-tabs .req-tab', '前置脚本')
  await cmPaste('.editor-area .cm-content', `pm.environment.set('e2eBase', '${BASE}')
console.log('E2E-prescript-log')`)
  await sendUrl('{{e2eBase}}/ping')
  assert((await textOf('.status-chip')).includes('200'), '{{变量}} 插值 + 脚本设变量后应 200')
  await ev(`[...${qa('.resp-viewbar .view-seg button')}][1]?.click()`)
  await waitFor('控制台行出现', `${qa('.console-row')}.length >= 1`)
  await ev(`${q('.console-row')}.click()`)
  await waitFor('脚本日志可见', `${q('.console-detail')}?.textContent.includes('E2E-prescript-log')`)
  await ev(`[...${qa('.resp-viewbar .view-seg button')}][0]?.click()`)
})
await test('测试断言：通过/失败计数与徽标', async () => {
  await clickByText('.req-tabs .req-tab', '测试')
  await cmPaste('.editor-area .cm-content', `pm.test('状态码为200', () => pm.response.to.have.status(200))
pm.test('必然失败', () => pm.expect(1).to.eql(2))`)
  await ev(`${q('.send-btn')}.click()`)
  await waitFor('断言徽标出现', `!!${q('.test-badge')}`, 10000)
  const badge = await textOf('.test-badge')
  assert(badge === '1/2', '断言徽标应为 1/2，实际: ' + badge)
  const results = await textOf('.editor-area')
  assert(results.includes('必然失败'), '测试面板应显示失败用例名')
})
await test('前置脚本错误阻断发送', async () => {
  await newTab()
  await clickByText('.req-tabs .req-tab', '前置脚本')
  await cmPaste('.editor-area .cm-content', `throw new Error('E2E-boom')`)
  await setInput('.url-input', BASE + '/ping')
  await ev(`${q('.send-btn')}.click()`)
  await waitFor('错误横幅出现', `!!${q('.script-warn')}`)
  const warn = await textOf('.script-warn')
  assert(warn.includes('E2E-boom') && warn.includes('未发送'), '横幅应含错误信息且说明未发送')
  assert(!(await ev(`!!${q('.status-chip')}`)), '出错时不应有响应状态')
})

/* ---------- D. 响应视图 ---------- */
await G('D 响应视图')()
await test('自动跟随重定向（302 → 200）', async () => {
  await newTab()
  await sendUrl(BASE + '/redirect')
  assert((await textOf('.status-chip')).includes('200'), '/redirect 跟随后应 200')
  assert((await textOf('.resp-body .cm-content')).includes('pong'), '应落到 /ping 内容')
})
await test('网络错误友好提示（连接拒绝）', async () => {
  await newTab()
  await sendUrl('http://127.0.0.1:9/nope')
  await waitFor('错误卡片', `!!${q('.error-card')}`)
  const err = await textOf('.error-card')
  assert(err.length > 4, '应有中文错误说明: ' + err.slice(0, 60))
})
await test('「请求」视图显示实际发送快照', async () => {
  await newTab()
  await sendUrl(BASE + '/echo?z=9')
  await clickByText('.resp-tabs .req-tab', '请求')
  await waitFor('快照 URL 出现', `!!${q('.sent-url')}`)
  const sent = await textOf('.sent-url')
  assert(sent.includes('z=9'), '快照应含最终 URL 参数')
})
await test('响应头视图计数', async () => {
  await clickByText('.resp-tabs .req-tab', '响应头')
  await waitFor('响应头表出现', `!!${q('.hdr-table')} || ${qa('.resp-tabs .req-tab .count')}.length >= 1`)
})

/* ---------- E. 环境变量与 Cookie ---------- */
await G('E 环境变量与 Cookie')()
await test('内置动态变量 {{$timestamp}}', async () => {
  await newTab()
  await sendUrl(BASE + '/echo?t={{$timestamp}}')
  await clickByText('.resp-tabs .req-tab', '请求')
  await waitFor('快照 URL', `!!${q('.sent-url')}`)
  const sent = await textOf('.sent-url')
  assert(/t=\d{10,}/.test(sent), '时间戳应被解析为数字: ' + sent)
})
await test('Set-Cookie 自动保存并回带', async () => {
  await newTab()
  await sendUrl(BASE + '/cookie/set')
  assert((await textOf('.status-chip')).includes('200'), 'cookie/set 应 200')
  await setInput('.url-input', BASE + '/cookie/check')
  await ev(`${q('.send-btn')}.click()`)
  await waitFor('第二次响应', `${q('.resp-body .cm-content')}.textContent.includes('sid')`, 10000)
  assert((await textOf('.resp-body .cm-content')).includes('abc123'), '应自动回带 sid=abc123')
})
await test('Cookie 管理弹窗展示域名分组', async () => {
  await ev(`[...${qa('.menubar-btn')}][2]?.click()`)
  await waitFor('工具菜单展开', `!!${q('.ctx-menu')}`)
  await clickByText('.ctx-menu .ctx-item', 'Cookie 管理')
  await waitFor('Cookie 弹窗', `!!${q('.modal-card')}`)
  const txt = await textOf('.modal-card')
  assert(txt.includes('127.0.0.1') && txt.includes('sid'), '弹窗应含 127.0.0.1 与 sid')
  await ev(`${q('.modal-foot .btn-primary')}?.click() || ${q('.modal-card .icon-btn')}?.click()`)
  await waitFor('弹窗关闭', `!${q('.modal-card')}`)
})

/* ---------- F. 集合 / 导入 / 历史 / 持久化 ---------- */
await G('F 集合与数据')()
await test('保存请求到集合（树中出现 + 脏标记消失）', async () => {
  await newTab()
  await sendUrl(BASE + '/ping')
  await ev(`${q('.save-btn')}.click()`)
  await waitFor('保存弹窗', `!!${q('.modal-card')}`)
  await setInput('.modal-card .form-row .input', 'E2E-已保存请求')
  await ev(`[...${qa('.modal-foot .btn-primary')}].find((b) => b.textContent.includes('保存'))?.click()`)
  await waitFor('弹窗关闭+保存完成', `!${q('.modal-card')}`)
  await waitFor('树中出现新节点', `[...${qa('.tree-name')}].some((n) => n.textContent.includes('E2E-已保存请求'))`)
  assert(!(await ev(`!!${q('.tab.active .tab-close.has-dirty')}`)), '保存后脏标记应消失')
})
await test('cURL 命令导入', async () => {
  await ev(`[...${qa('.menubar-btn')}][0]?.click()`)
  await waitFor('文件菜单展开', `!!${q('.ctx-menu')}`)
  await clickByText('.ctx-menu .ctx-item', '导入')
  await waitFor('导入弹窗', `!!${q('.modal-card')}`)
  await ev(`(() => { [...${qa('.modal-card .body-mode-seg button')}].find((b) => b.textContent.includes('cURL'))?.click() })()`)
  await setInput('.modal-card .kv-bulk', `curl -X POST ${BASE}/echo -H 'X-Import: yes' -d '{"a":1}'`, 'textarea')
  await new Promise((r) => setTimeout(r, 250))
  await waitFor('识别成功提示', `${q('.modal-card')}.textContent.includes('识别成功')`)
  await ev(`[...${qa('.modal-foot .btn-primary')}].find((b) => b.textContent.includes('导入'))?.click()`)
  await waitFor('弹窗关闭', `!${q('.modal-card')}`)
  await waitFor('cURL 导入集合出现', `[...${qa('.tree-name')}].some((n) => n.textContent.includes('cURL 导入'))`)
})
await test('历史记录面板记录请求', async () => {
  await click('.ab-btn[title="历史记录"]')
  await waitFor('历史条目出现', `${qa('.hist-row')}.length >= 3`)
})
await test('数据落盘（集合/历史/Cookie）', async () => {
  const fs = await import('node:fs')
  const file = process.env.APPDATA + '\\easyapi\\easyapi-data.json'
  await new Promise((r) => setTimeout(r, 2000)) // 等待渲染层 350ms 防抖 + 主进程 400ms 防抖落盘
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'))
  assert(data.history.length >= 3, '历史应 ≥3 条，实际 ' + data.history.length)
  assert(JSON.stringify(data.collections).includes('E2E-已保存请求'), '集合应含保存的请求')
  assert(JSON.stringify(data.cookies).includes('sid'), 'Cookie 应含 sid')
})

/* ---------- G. 界面开关 ---------- */
await G('G 界面')()
await test('主题切换（深浅往返）', async () => {
  const before = await ev(`document.documentElement.dataset.theme`)
  await ev(`${q('.tb-actions .win-btn')}.click()`)
  await waitFor('主题翻转', `document.documentElement.dataset.theme !== '${before}'`)
  await ev(`${q('.tb-actions .win-btn')}.click()`)
  await waitFor('主题还原', `document.documentElement.dataset.theme === '${before}'`)
})
await test('Ctrl+Shift+C 切换控制台', async () => {
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, shiftKey: true, bubbles: true }))`)
  await waitFor('控制台视图', `!!${q('.console-view')}`)
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true, shiftKey: true, bubbles: true }))`)
  await waitFor('控制台关闭', `!${q('.console-view')}`)
})
await test('设置弹窗打开与关闭', async () => {
  await ev(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true, bubbles: true }))`)
  await waitFor('设置弹窗', `${q('.modal-title')}.textContent.includes('设置')`)
  await ev(`[...${qa('.modal-foot .btn-primary')}].find((b) => b.textContent.includes('完成'))?.click()`)
  await waitFor('设置关闭', `!${q('.modal-card')}`)
})
await test('菜单「复制为 cURL」', async () => {
  await ev(`[...${qa('.menubar-btn')}][2]?.click()`)
  await waitFor('工具菜单', `!!${q('.ctx-menu')}`)
  await clickByText('.ctx-menu .ctx-item', '复制为 cURL')
  await waitFor('成功 toast', `[...${qa('.toast')}].some((t) => t.textContent.includes('cURL'))`)
})

/* ---------- 汇总 ---------- */
const pass = results.filter((r) => r.ok).length
const fail = results.length - pass
console.log('\n========== E2E 测试汇总 ==========')
const groups = [...new Set(results.map((r) => r.group))]
for (const g of groups) {
  const rs = results.filter((r) => r.group === g)
  console.log(`${g}: ${rs.filter((r) => r.ok).length}/${rs.length}`)
  for (const r of rs.filter((x) => !x.ok)) console.log(`    ✗ ${r.name}: ${r.err}`)
}
console.log(`总计: ${pass}/${results.length} 通过${fail ? '，' + fail + ' 失败' : ''}`)
ws.close()
process.exit(fail ? 1 : 0)
