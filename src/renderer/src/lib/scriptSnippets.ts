/** 脚本编辑器右侧代码片段面板的数据（对齐 Postman Snippets） */
export interface ScriptSnippet {
  title: string
  code: string
}

export const SNIPPETS_PRE: ScriptSnippet[] = [
  {
    title: '设置环境变量',
    code: `pm.environment.set('baseUrl', 'https://api.example.com')`
  },
  {
    title: '读取环境变量',
    code: `const value = pm.environment.get('key')`
  },
  {
    title: '设置全局变量',
    code: `pm.globals.set('token', 'xxx')`
  },
  {
    title: '读取变量（临时>环境>全局）',
    code: `const value = pm.variables.get('key')`
  },
  {
    title: '添加请求头',
    code: `pm.request.headers.add({ key: 'X-Sign', value: 'sign-123' })`
  },
  {
    title: '修改请求 URL',
    code: `pm.request.url = 'https://api.example.com/v2/users'`
  },
  {
    title: '切换请求方法',
    code: `pm.request.method = 'POST'`
  },
  {
    title: '等待 1 秒',
    code: `await new Promise((r) => setTimeout(r, 1000))`
  },
  {
    title: '时间戳变量',
    code: `pm.variables.set('ts', String(Date.now()))`
  },
  {
    title: '输出调试日志',
    code: `console.log('调试信息', pm.variables.get('key'))`
  }
]

export const SNIPPETS_TEST: ScriptSnippet[] = [
  {
    title: '状态码为 200',
    code: `pm.test('状态码为 200', () => {
  pm.response.to.have.status(200)
})`
  },
  {
    title: '响应时间 < 500ms',
    code: `pm.test('响应时间小于 500ms', () => {
  pm.expect(pm.response.responseTime).to.be.below(500)
})`
  },
  {
    title: 'JSON 字段断言',
    code: `pm.test('返回了 name 字段', () => {
  const data = pm.response.json()
  pm.expect(data.name).to.eql('EasyAPI')
})`
  },
  {
    title: '响应体包含文本',
    code: `pm.test('响应体包含 success', () => {
  pm.response.to.have.body('success')
})`
  },
  {
    title: '响应头存在',
    code: `pm.test('包含 Content-Type 头', () => {
  pm.response.to.have.header('Content-Type')
})`
  },
  {
    title: '读取环境变量',
    code: `const token = pm.environment.get('token')`
  },
  {
    title: '输出响应日志',
    code: `console.log('响应内容', pm.response.text())`
  }
]
