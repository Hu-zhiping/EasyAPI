import { reactive } from 'vue'

/** 集合树展开状态（跨组件共享） */
export const expandedIds = reactive(new Set<string>())

/** 控制台展开的日志行 */
export const expandedConsole = reactive(new Set<string>())

/** 集合树拖拽状态 */
export const treeDrag = reactive<{
  id: string | null
  overId: string | null
  overPos: 'before' | 'after' | 'into' | null
}>({ id: null, overId: null, overPos: null })
