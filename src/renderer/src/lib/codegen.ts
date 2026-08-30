import type { Method, RequestDef } from '../../../shared/types'
import { stringifyCurl } from './curl'
import { buildPayload, type ResolveCtx } from './http'

export type CodeTarget = 'curl' | 'fetch' | 'axios' | 'python'

export const CODE_TARGETS: Array<{ value: CodeTarget; label: string }> = [
  { value: 'curl', label: 'cURL' },
  { value: 'fetch', label: 'JavaScript · Fetch' },
  { value: 'axios', label: 'JavaScript · Axios' },
  { value: 'python', label: 'Python · Requests' }
]

const jsStr = (s: string): string => JSON.stringify(s)

export function generateCode(target: CodeTarget, req: RequestDef, ctx: ResolveCtx): string {
  const payload = buildPayload(req, ctx)
  const headers = payload.headers

  if (target === 'curl') {
    return stringifyCurl(req, payload.url, headers, req.body)
  }

  if (target === 'fetch') {
    const lines: string[] = []
    lines.push(`fetch(${jsStr(payload.url)}, {`)
    lines.push(`  method: ${jsStr(req.method)},`)
    if (Object.keys(headers).length) {
      lines.push('  headers: {')
      for (const [k, v] of Object.entries(headers)) lines.push(`    ${jsStr(k)}: ${jsStr(v)},`)
      lines.push('  },')
    }
    if (payload.bodyMode === 'raw' && payload.rawContent) {
      lines.push(`  body: ${jsStr(payload.rawContent)},`)
    } else if (payload.bodyMode === 'urlencoded' && payload.urlencoded?.length) {
      lines.push(`  body: ${jsStr(new URLSearchParams(payload.urlencoded).toString())},`)
    } else if (payload.bodyMode === 'form-data' && payload.formFields?.length) {
      lines.push('  body: formData, // 使用 FormData 组装表单')
    }
    lines.push('});')
    if (payload.bodyMode === 'form-data' && payload.formFields?.length) {
      lines.unshift('const formData = new FormData();')
      for (const f of payload.formFields) {
        lines.splice(
          1,
          0,
          f.type === 'file'
            ? `formData.append(${jsStr(f.key)}, fileInput.files[0], ${jsStr(f.value.split(/[\\/]/).pop() ?? '')});`
            : `formData.append(${jsStr(f.key)}, ${jsStr(f.value)});`
        )
      }
    }
    return lines.join('\n')
  }

  if (target === 'axios') {
    const lines: string[] = []
    lines.push('import axios from "axios";')
    lines.push('')
    lines.push('const { data } = await axios({')
    lines.push(`  method: ${jsStr(req.method.toLowerCase())},`)
    lines.push(`  url: ${jsStr(payload.url)},`)
    if (Object.keys(headers).length) {
      lines.push('  headers: {')
      for (const [k, v] of Object.entries(headers)) lines.push(`    ${jsStr(k)}: ${jsStr(v)},`)
      lines.push('  },')
    }
    if (payload.bodyMode === 'raw' && payload.rawContent) {
      lines.push(`  data: ${jsStr(payload.rawContent)},`)
    } else if (payload.bodyMode === 'urlencoded' && payload.urlencoded?.length) {
      lines.push(`  data: ${jsStr(new URLSearchParams(payload.urlencoded).toString())},`)
    }
    lines.push('});')
    lines.push('console.log(data);')
    return lines.join('\n')
  }

  // python
  const lines: string[] = ['import requests', '']
  const hasBody = (payload.bodyMode === 'raw' && payload.rawContent) || (payload.bodyMode === 'urlencoded' && payload.urlencoded?.length)
  if (hasBody || Object.keys(headers).length) {
    lines.push(`res = requests.request(${JSON.stringify(req.method)}, ${JSON.stringify(payload.url)},`)
    if (Object.keys(headers).length) {
      lines.push('    headers={')
      for (const [k, v] of Object.entries(headers)) lines.push(`        ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
      lines.push('    },')
    }
    if (payload.bodyMode === 'raw' && payload.rawContent) {
      lines.push(`    data=${JSON.stringify(payload.rawContent)},`)
    } else if (payload.bodyMode === 'urlencoded' && payload.urlencoded?.length) {
      lines.push('    data={')
      for (const [k, v] of payload.urlencoded) lines.push(`        ${JSON.stringify(k)}: ${JSON.stringify(v)},`)
      lines.push('    },')
    }
    lines.push(')')
  } else {
    lines.push(`res = requests.request(${JSON.stringify(req.method)}, ${JSON.stringify(payload.url)})`)
  }
  lines.push('print(res.status_code)')
  lines.push('print(res.text)')
  return lines.join('\n')
}
