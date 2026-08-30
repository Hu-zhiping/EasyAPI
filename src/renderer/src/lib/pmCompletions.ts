import type { CompletionContext, CompletionResult } from '@codemirror/autocomplete'

interface PmOption {
  label: string
  detail: string
  apply?: string
  type: string
}

/** 按「对象路径」组织的成员补全表，apply 为 CM6 片段模板（$N 为占位符） */
const SCOPE_MEMBERS: Record<string, PmOption[]> = {
  pm: [
    { label: 'environment', detail: '环境变量', type: 'property' },
    { label: 'globals', detail: '全局变量', type: 'property' },
    { label: 'variables', detail: '临时变量（优先级最高）', type: 'property' },
    { label: 'request', detail: '当前请求（可修改）', type: 'property' }
  ],
  'pm.environment': [
    { label: 'get', apply: "get('$1')$0", detail: 'get(name) 读取环境变量', type: 'method' },
    { label: 'set', apply: "set('$1', '')$0", detail: 'set(name, value) 写入环境变量', type: 'method' },
    { label: 'unset', apply: "unset('$1')$0", detail: 'unset(name) 删除环境变量', type: 'method' }
  ],
  'pm.globals': [
    { label: 'get', apply: "get('$1')$0", detail: 'get(name) 读取全局变量', type: 'method' },
    { label: 'set', apply: "set('$1', '')$0", detail: 'set(name, value) 写入全局变量', type: 'method' },
    { label: 'unset', apply: "unset('$1')$0", detail: 'unset(name) 删除全局变量', type: 'method' }
  ],
  'pm.variables': [
    { label: 'get', apply: "get('$1')$0", detail: 'get(name) 读取（临时>环境>全局）', type: 'method' },
    { label: 'set', apply: "set('$1', '')$0", detail: 'set(name, value) 写入临时变量', type: 'method' },
    { label: 'unset', apply: "unset('$1')$0", detail: 'unset(name) 删除临时变量', type: 'method' }
  ],
  'pm.request': [
    { label: 'method', detail: '请求方法（可写）', type: 'property' },
    { label: 'url', detail: '请求 URL（可写）', type: 'property' },
    { label: 'headers', detail: '请求头集合', type: 'property' }
  ],
  'pm.request.headers': [
    { label: 'add', apply: "add({ key: '$1', value: '$2' })$0", detail: 'add({key, value}) 添加请求头', type: 'method' },
    { label: 'upsert', apply: "upsert({ key: '$1', value: '$2' })$0", detail: 'upsert({key, value}) 添加或替换', type: 'method' },
    { label: 'get', apply: "get('$1')$0", detail: 'get(name) 读取请求头', type: 'method' },
    { label: 'has', apply: "has('$1')$0", detail: 'has(name) 是否存在', type: 'method' },
    { label: 'remove', apply: "remove('$1')$0", detail: 'remove(name) 删除请求头', type: 'method' },
    { label: 'all', apply: 'all()$0', detail: 'all() 获取全部请求头', type: 'method' }
  ],
  console: [
    { label: 'log', apply: 'log($1)$0', detail: '输出到网络控制台', type: 'method' },
    { label: 'info', apply: 'info($1)$0', detail: '输出到网络控制台', type: 'method' },
    { label: 'warn', apply: 'warn($1)$0', detail: '输出警告到网络控制台', type: 'method' },
    { label: 'error', apply: 'error($1)$0', detail: '输出错误到网络控制台', type: 'method' }
  ]
}

const TOP_LEVEL: PmOption[] = [
  { label: 'pm', detail: 'EasyAPI 脚本对象', type: 'keyword' },
  { label: 'console', detail: '输出到网络控制台', type: 'keyword' },
  { label: 'await', detail: '等待异步操作（脚本为 async 执行）', type: 'keyword' }
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
      options,
      validFor: /^[\w$.]*$/
    }
  }

  // 语句起始位置的顶层建议（按已输入前缀过滤，避免行中噪音）
  const bare = /(?:^|[^\w$])(\w*)$/.exec(before)
  if (bare) {
    const word = bare[1]
    const options = TOP_LEVEL.filter((o) => o.label.startsWith(word.toLowerCase()))
    if (!options.length) return null
    return { from: ctx.pos - word.length, options, validFor: /^[\w$]*$/ }
  }
  return null
}
