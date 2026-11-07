import type { EnvVariable } from '../../../shared/types'

export type VarLookup = (name: string) => string | null | undefined

const DYNAMIC: Record<string, () => string> = {
  $timestamp: () => String(Math.floor(Date.now() / 1000)),
  $timeMS: () => String(Date.now()),
  $isoTimestamp: () => new Date().toISOString(),
  $uuid: () => crypto.randomUUID(),
  $guid: () => crypto.randomUUID(),
  $randomInt: () => String(Math.floor(Math.random() * 1000)),
  $randomEmail: () => `user${Math.floor(Math.random() * 10000)}@example.com`,
  $randomFirstName: () => ['伟', '芳', '娜', '磊', '静', '涛', '明', '超'][Math.floor(Math.random() * 8)],
  $randomLastName: () => ['张', '王', '李', '赵', '刘', '陈', '杨', '黄'][Math.floor(Math.random() * 8)],
  $randomColor: () => ['#ff6c37', '#3fb950', '#4c9ffe', '#b48cf2', '#f7b955'][Math.floor(Math.random() * 5)],
  $randomIP: () => `${rand(1, 254)}.${rand(0, 255)}.${rand(0, 255)}.${rand(1, 254)}`
}

function rand(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1))
}

export function makeLookup(scopes: EnvVariable[][]): VarLookup {
  const map = new Map<string, string>()
  // 作用域优先级：先加入的优先（环境 > 全局）
  for (const scope of [...scopes].reverse()) {
    for (const v of scope) {
      if (v.enabled && v.key) map.set(v.key, v.value)
    }
  }
  return (name: string) => {
    if (DYNAMIC[name]) return DYNAMIC[name]()
    return map.get(name) ?? null
  }
}

/** 内置动态变量名集合（供 URL 高亮等场景判断变量是否可解析） */
export const DYNAMIC_VAR_NAMES: ReadonlySet<string> = new Set(Object.keys(DYNAMIC))

/** 将 {{var}} 替换为变量值，支持最多 5 层嵌套引用；未定义的变量原样保留 */
export function interpolate(text: string, lookup: VarLookup, depth = 5): string {
  if (!text || !text.includes('{{')) return text
  let out = text
  for (let i = 0; i < depth; i++) {
    const next = out.replace(/\{\{\s*([\w$.]+)\s*\}\}/g, (raw, name: string) => {
      const v = lookup(name)
      return v === null || v === undefined ? raw : v
    })
    if (next === out) break
    out = next
  }
  return out
}

/** 列出文本中引用的变量名（用于提示） */
export function referencedVars(text: string): string[] {
  const names: string[] = []
  const re = /\{\{\s*([\w$.]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (!names.includes(m[1])) names.push(m[1])
  }
  return names
}
