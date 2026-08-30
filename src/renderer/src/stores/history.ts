import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { HistoryEntry } from '../../../shared/types'
import { watchPersist } from './persist'
import { useAppStore } from './app'

export const useHistoryStore = defineStore('history', () => {
  const entries = ref<HistoryEntry[]>([])

  function hydrate(data: { history?: HistoryEntry[] }): void {
    entries.value = data.history ?? []
  }

  function add(entry: Omit<HistoryEntry, 'id'>): void {
    const app = useAppStore()
    if (!app.settings.saveHistory) return
    entries.value.unshift({ ...entry, id: crypto.randomUUID() })
    const limit = Math.max(10, app.settings.historyLimit)
    if (entries.value.length > limit) entries.value.length = limit
  }

  function remove(id: string): void {
    entries.value = entries.value.filter((e) => e.id !== id)
  }

  function clear(): void {
    entries.value = []
  }

  watchPersist(() => entries.value, 'history')

  return { entries, hydrate, add, remove, clear }
})
