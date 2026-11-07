/**
 * EasyAPI 脚本沙箱的 pm API 类型声明（与 src/renderer/src/lib/script.ts 的运行时实现一一对应）。
 * 通过 monaco.languages.typescript.javascriptDefaults.addExtraLib 注入，
 * 为前置/后置脚本提供真实语言服务的成员补全、参数提示与悬停文档。
 */
export const PM_DTS = /* d.ts */ `
/** 变量存取器（pm.environment / pm.globals / pm.variables 通用） */
interface PmVarScope {
  /** 读取变量，不存在时返回 null */
  get(name: string): string | null
  /** 写入变量（对象/数字会自动序列化为文本） */
  set(name: string, value: unknown): void
  /** 删除变量 */
  unset(name: string): void
}

/** 请求头集合（pm.request.headers） */
interface PmHeaderCollection {
  /** 添加一个请求头（不查重） */
  add(header: { key: string; value: unknown }): void
  /** 添加请求头，同名时替换旧值 */
  upsert(header: { key: string; value: unknown }): void
  /** 按名称读取请求头（大小写不敏感），不存在时返回 null */
  get(name: string): string | null
  /** 判断请求头是否存在（大小写不敏感） */
  has(name: string): boolean
  /** 删除指定请求头 */
  remove(name: string): void
  /** 获取全部请求头的副本 */
  all(): Array<{ key: string; value: string }>
}

/** 当前请求（前置脚本可修改，发送前生效） */
interface PmRequest {
  /** 请求方法（写入时自动转大写），如 'GET' / 'POST' */
  method: string
  /** 完整请求 URL，可直接改写 */
  url: string
  /** 请求头集合 */
  headers: PmHeaderCollection
}

/** 响应头集合（pm.response.headers） */
interface PmResponseHeaders {
  /** 按名称读取响应头（大小写不敏感），不存在时返回 null */
  get(name: string): string | null
  /** 获取全部响应头的副本 */
  all(): Array<{ key: string; value: string }>
}

/** 断言链（pm.expect(x).to.*） */
interface PmExpectation {
  to: {
    /** 全等断言（===） */
    equal(expected: unknown, msg?: string): void
    /** 深度相等断言（JSON 序列化比较） */
    eql(expected: unknown, msg?: string): void
    /** 正则匹配断言 */
    match(regex: RegExp | string, msg?: string): void
    /** 包含断言（字符串片段） */
    include(fragment: unknown, msg?: string): void
    be: {
      /** 断言数值大于 n */
      above(n: number, msg?: string): void
      /** 断言数值小于 n */
      below(n: number, msg?: string): void
      /** 断言值在数组中 */
      oneOf(list: unknown[], msg?: string): void
    }
    have: {
      /** 断言对象包含属性 */
      property(name: string, msg?: string): void
    }
    a: {
      /** 断言类型为 string */
      string(): void
      /** 断言类型为 number */
      number(): void
      /** 断言类型为 object（非 null） */
      object(): void
    }
  }
}

/** 响应对象（仅测试脚本可用） */
interface PmResponse {
  /** HTTP 状态码 */
  readonly code: number
  /** 状态文本，如 'OK' / 'Not Found' */
  readonly status: string
  /** 请求耗时（毫秒） */
  readonly responseTime: number
  /** 响应大小（字节） */
  readonly size: number
  /** 响应头集合 */
  readonly headers: PmResponseHeaders
  /** 以文本读取响应体 */
  text(): string
  /** 将响应体解析为 JSON（非合法 JSON 时抛错） */
  json(): any
  /** 快捷断言：pm.response.to.have.status(200) 等 */
  readonly to: {
    readonly have: {
      /** 断言状态码 */
      status(code: number): void
      /** 断言响应头存在（可校验值） */
      header(name: string, value?: string): void
      /** 断言响应体包含文本 */
      body(fragment: string): void
    }
  }
}

/**
 * EasyAPI 脚本对象。
 * 前置脚本可用：environment / globals / variables / request；
 * 测试脚本可用：environment / globals / response / expect / test。
 */
declare namespace pm {
  /** 环境变量 */
  const environment: PmVarScope
  /** 全局变量 */
  const globals: PmVarScope
  /** 临时变量（读取优先级：临时 > 环境 > 全局） */
  const variables: PmVarScope
  /** 当前请求（前置脚本中可直接修改 method / url / headers） */
  const request: PmRequest
  /** 响应对象（仅测试脚本） */
  const response: PmResponse
  /** 创建断言链 */
  function expect(actual: unknown): PmExpectation
  /** 注册一个测试用例，失败时在测试结果面板标红 */
  function test(name: string, fn: () => void | Promise<void>): void
}
`
