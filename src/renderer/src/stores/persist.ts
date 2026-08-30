import { watch } from 'vue'
import type { AppData } from '../../../shared/types'

/** 将 store 中的一段状态防抖持久化到主进程 */
export function watchPersist(source: () => unknown, section: keyof AppData, delay = 350): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  watch(
    source,
    (v) => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        const clone = JSON.parse(JSON.stringify(v === undefined ? null : v))
        window.api.patchStore({ [section]: clone } as Partial<AppData>)
      }, delay)
    },
    { deep: true }
  )
}
