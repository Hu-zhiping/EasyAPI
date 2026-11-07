import { snippetCompletion } from '@codemirror/autocomplete'
import type { Completion, CompletionContext, CompletionResult } from '@codemirror/autocomplete'

interface PmOption {
  label: string
  detail: string
  apply?: string
  type: string
}

/** apply 模板里的 $N/$0 必须经 snippetCompletion 包装才会变成可跳转的占位符字段；
 *  直接把含 $ 的模板作为字符串 apply 会把 "$1" 字面插入文档 */
function toCompletions(opts: PmOption[]): Completion[] {
  return opts.map((o) => {
    if (o.apply && o.apply.includes('$')) {
      const { apply, ...rest } = o
      return snippetCompletion(apply, rest)
    }
    return o
  })
}

/** 按「对象路径」组织的成员补全表，apply 为 CM6 片段模板（$N 为占位符） */
const SCOPE_MEMBERS: Record<string, PmOption[]> = {
  pm: [
    { label: 'environment', detail: '环境变量', type: 'property' },
    { label: 'globals', detail: '全局变量', type: 'property' },
    { label: 'variables', detail: '临时变量（优先级最高）', type: 'property' },
    { label: 'request', detail: '当前请求（可修改）', type: 'property' },
    { label: 'test', apply: "test('${1}', () => {\n  ${2}\n})", detail: 'test(name, fn) 定义测试用例（测试脚本）', type: 'method' },
    { label: 'expect', apply: 'expect(${1})', detail: 'expect(value) 断言（测试脚本）', type: 'method' },
    { label: 'response', detail: '响应对象（测试脚本）', type: 'property' }
  ],
  'pm.environment': [
    { label: 'get', apply: "get('${1}')${0}", detail: 'get(name) 读取环境变量', type: 'method' },
    { label: 'set', apply: "set('${1}', '${2}')${0}", detail: 'set(name, value) 写入环境变量', type: 'method' },
    { label: 'unset', apply: "unset('${1}')${0}", detail: 'unset(name) 删除环境变量', type: 'method' }
  ],
  'pm.globals': [
    { label: 'get', apply: "get('${1}')${0}", detail: 'get(name) 读取全局变量', type: 'method' },
    { label: 'set', apply: "set('${1}', '${2}')${0}", detail: 'set(name, value) 写入全局变量', type: 'method' },
    { label: 'unset', apply: "unset('${1}')${0}", detail: 'unset(name) 删除全局变量', type: 'method' }
  ],
  'pm.variables': [
    { label: 'get', apply: "get('${1}')${0}", detail: 'get(name) 读取（临时>环境>全局）', type: 'method' },
    { label: 'set', apply: "set('${1}', '${2}')${0}", detail: 'set(name, value) 写入临时变量', type: 'method' },
    { label: 'unset', apply: "unset('${1}')${0}", detail: 'unset(name) 删除临时变量', type: 'method' }
  ],
  'pm.request': [
    { label: 'method', detail: '请求方法（可写）', type: 'property' },
    { label: 'url', detail: '请求 URL（可写）', type: 'property' },
    { label: 'headers', detail: '请求头集合', type: 'property' }
  ],
  'pm.request.headers': [
    { label: 'add', apply: "add({ key: '${1}', value: '${2}' })${0}", detail: 'add({key, value}) 添加请求头', type: 'method' },
    { label: 'upsert', apply: "upsert({ key: '${1}', value: '${2}' })${0}", detail: 'upsert({key, value}) 添加或替换', type: 'method' },
    { label: 'get', apply: "get('${1}')${0}", detail: 'get(name) 读取请求头', type: 'method' },
    { label: 'has', apply: "has('${1}')${0}", detail: 'has(name) 是否存在', type: 'method' },
    { label: 'remove', apply: "remove('${1}')${0}", detail: 'remove(name) 删除请求头', type: 'method' },
    { label: 'all', apply: 'all()${0}', detail: 'all() 获取全部请求头', type: 'method' }
  ],
  'pm.response': [
    { label: 'code', detail: '状态码', type: 'property' },
    { label: 'status', detail: '状态文本', type: 'property' },
    { label: 'responseTime', detail: '耗时（毫秒）', type: 'property' },
    { label: 'size', detail: '响应大小（字节）', type: 'property' },
    { label: 'headers', detail: '响应头集合', type: 'property' },
    { label: 'text', apply: 'text()${0}', detail: 'text() 以文本读取响应体', type: 'method' },
    { label: 'json', apply: 'json()${0}', detail: 'json() 解析为 JSON', type: 'method' },
    { label: 'to', detail: 'to.have.* 状态/头/断言', type: 'property' }
  ],
  'pm.response.headers': [
    { label: 'get', apply: "get('${1}')${0}", detail: 'get(name) 读取响应头', type: 'method' },
    { label: 'all', apply: 'all()${0}', detail: 'all() 获取全部响应头', type: 'method' }
  ],
  'pm.response.to': [
    { label: 'have', detail: 'have.status / have.header / have.body', type: 'property' }
  ],
  'pm.response.to.have': [
    { label: 'status', apply: 'status(${1})${0}', detail: 'status(code) 断言状态码', type: 'method' },
    { label: 'header', apply: "header('${1}', '${2}')${0}", detail: "header(name, value?) 断言响应头", type: 'method' },
    { label: 'body', apply: "body('${1}')${0}", detail: 'body(fragment) 断言包含文本', type: 'method' }
  ],
  console: [
    { label: 'log', apply: 'log(${1})${0}', detail: '输出到网络控制台', type: 'method' },
    { label: 'info', apply: 'info(${1})${0}', detail: '输出到网络控制台', type: 'method' },
    { label: 'warn', apply: 'warn(${1})${0}', detail: '输出警告到网络控制台', type: 'method' },
    { label: 'error', apply: 'error(${1})${0}', detail: '输出错误到网络控制台', type: 'method' }
  ]
}

/** JS 关键字与常用全局（补齐 lang-javascript 自带的局部变量提示） */
const JS_WORDS: PmOption[] = [
  { label: 'const', detail: '关键字', type: 'keyword' },
  { label: 'let', detail: '关键字', type: 'keyword' },
  { label: 'var', detail: '关键字', type: 'keyword' },
  { label: 'function', apply: 'function ${1}(${2}) {\n  ${3}\n}', detail: '函数声明', type: 'keyword' },
  { label: 'return', detail: '关键字', type: 'keyword' },
  { label: 'if', apply: 'if (${1}) {\n  ${2}\n}', detail: '条件', type: 'keyword' },
  { label: 'else', detail: '关键字', type: 'keyword' },
  { label: 'for', apply: 'for (let i = 0; i < ${1}; i++) {\n  ${2}\n}', detail: '循环', type: 'keyword' },
  { label: 'forof', apply: 'for (const ${1} of ${2}) {\n  ${3}\n}', detail: 'for…of 循环', type: 'keyword' },
  { label: 'while', apply: 'while (${1}) {\n  ${2}\n}', detail: '循环', type: 'keyword' },
  { label: 'try', apply: 'try {\n  ${1}\n} catch (e) {\n  ${2}\n}', detail: '异常捕获', type: 'keyword' },
  { label: 'catch', detail: '关键字', type: 'keyword' },
  { label: 'throw', detail: '关键字', type: 'keyword' },
  { label: 'async', detail: '关键字', type: 'keyword' },
  { label: 'new', detail: '关键字', type: 'keyword' },
  { label: 'JSON', detail: 'JSON 解析/序列化', type: 'class' },
  { label: 'Math', detail: '数学工具', type: 'class' },
  { label: 'Date', detail: '日期时间', type: 'class' },
  { label: 'Object', detail: '对象工具', type: 'class' },
  { label: 'Array', detail: '数组工具', type: 'class' },
  { label: 'String', detail: '字符串工具', type: 'class' },
  { label: 'Number', detail: '数值工具', type: 'class' },
  { label: 'Promise', detail: 'Promise', type: 'class' },
  { label: 'parseInt', detail: 'parseInt(string, radix?)', type: 'function' },
  { label: 'parseFloat', detail: 'parseFloat(string)', type: 'function' },
  { label: 'setTimeout', detail: 'setTimeout(fn, ms)', type: 'function' }
]

const TOP_LEVEL: PmOption[] = [
  { label: 'pm', detail: 'EasyAPI 脚本对象', type: 'keyword' },
  { label: 'console', detail: '输出到网络控制台', type: 'keyword' },
  { label: 'await', detail: '等待异步操作（脚本为 async 执行）', type: 'keyword' },
  { label: 'testcase', apply: "pm.test('${1}', () => {\n  ${2}\n})", detail: '测试用例模板', type: 'function' },
  { label: 'expectEq', apply: 'pm.expect(${1}).to.eql(${2})', detail: '相等断言模板', type: 'function' },
  { label: 'expectStatus', apply: "pm.test('状态码为 ${1}', () => {\n  pm.response.to.have.status(${1})\n})", detail: '状态码断言模板', type: 'function' },
  { label: 'setVar', apply: "pm.environment.set('${1}', '${2}')", detail: '写环境变量模板', type: 'function' },
  ...JS_WORDS
]

/** 前置脚本的 pm.* 上下文补全源，通过 javascriptLanguage.data 挂载 */
export function pmCompletionSource(ctx: CompletionContext): CompletionResult | null {
  const line = ctx.state.doc.lineAt(ctx.pos)
  const before = line.text.slice(0, ctx.pos - line.from)

  // pm.xxx. / console. 等成员位置
  const member = /(?:^|[^\w$.])([\w$]+(?:\.[\w$]+)*)\.(\w*)$/.exec(before)
  if (member) {
    const options = SCOPE_MEMBERS[member[1]]
    if (!options) return null
    return {
      from: ctx.pos - member[2].length,
      options: toCompletions(options),
      validFor: /^[\w$.]*$/
    }
  }

  // 语句起始位置的顶层建议（按已输入前缀过滤，避免行中噪音）
  const bare = /(?:^|[^\w$])(\w*)$/.exec(before)
  if (bare) {
    const word = bare[1]
    const lower = word.toLowerCase()
    const options = TOP_LEVEL.filter((o) => o.label.toLowerCase().startsWith(lower))
    if (!options.length) return null
    return { from: ctx.pos - word.length, options: toCompletions(options), validFor: /^[\w$]*$/ }
  }
  return null
}
