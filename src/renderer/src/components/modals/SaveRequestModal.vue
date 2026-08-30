<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder, FilePlus2, Plus } from 'lucide-vue-next'
import ModalShell from '../ModalShell.vue'
import { useAppStore } from '../../stores/app'
import { useCollectionsStore } from '../../stores/collections'
import { useTabsStore } from '../../stores/tabs'
import { findInCollections } from '../../lib/tree'
import { expandedIds } from '../../stores/uiState'
import type { FolderNode } from '../../../../shared/types'

const app = useAppStore()
const cols = useCollectionsStore()
const tabs = useTabsStore()

const modal = app.modal as { type: 'save-request'; tabId: string }
const tab = tabs.tabs.find((t) => t.id === modal.tabId)

const name = ref(tab?.title ?? '未命名请求')

interface LocationItem {
  key: string
  collectionId: string
  parentId: string | null
  label: string
  depth: number
  icon: 'collection' | 'folder' | 'new'
}

const NEW_KEY = '__new__'

const locations = computed<LocationItem[]>(() => {
  const out: LocationItem[] = [{ key: NEW_KEY, collectionId: '', parentId: null, label: '新建集合…', depth: 0, icon: 'new' }]
  for (const c of cols.collections) {
    out.push({ key: `${c.id}::`, collectionId: c.id, parentId: null, label: c.name, depth: 0, icon: 'collection' })
    const walk = (nodes: FolderNode[], depth: number): void => {
      for (const n of nodes) {
        if (n.type !== 'folder') continue
        out.push({ key: `${c.id}::${n.id}`, collectionId: c.id, parentId: n.id, label: n.name, depth, icon: 'folder' })
        walk(n.children.filter((x): x is FolderNode => x.type === 'folder'), depth + 1)
      }
    }
    walk(c.children.filter((x): x is FolderNode => x.type === 'folder'), 1)
  }
  return out
})

const defaultKey = computed(() => {
  if (tab?.savedRef) {
    const found = findInCollections(cols.collections, tab.savedRef.nodeId)
    const parentId = found && found.parent && found.parent.type === 'folder' ? found.parent.id : null
    return `${tab.savedRef.collectionId}::${parentId ?? ''}`
  }
  return cols.collections.length ? `${cols.collections[0].id}::` : NEW_KEY
})

const selected = ref(defaultKey.value)
const newColName = ref('新建集合')

const isNew = computed(() => selected.value === NEW_KEY)

function save(): void {
  if (!tab) return
  const finalName = name.value.trim() || '未命名请求'
  if (isNew.value) {
    const c = cols.addCollection(newColName.value.trim() || '新建集合')
    const node = cols.addRequest(c.id, null, finalName, tab.request)
    if (node) {
      tabs.markSaved(tab.id, c.id, node.id, finalName)
      expandedIds.add(c.id)
    }
  } else {
    const [collectionId, parentId] = selected.value.split('::')
    const node = cols.addRequest(collectionId, parentId || null, finalName, tab.request)
    if (node) {
      tabs.markSaved(tab.id, collectionId, node.id, finalName)
      expandedIds.add(collectionId)
      if (parentId) expandedIds.add(parentId)
    }
  }
  app.sidebarNav = 'collections'
  app.toast('请求已保存到集合', 'success')
  app.modal = null
}
</script>

<template>
  <ModalShell title="保存请求" :width="480" @close="app.modal = null">
    <div class="form-row">
      <label>请求名称</label>
      <input v-model="name" class="input" spellcheck="false" @keydown.enter="save" />
    </div>
    <div class="form-row" style="align-items: flex-start; margin-bottom: 0">
      <label style="padding-top: 5px">保存位置</label>
      <div class="loc-list">
        <div
          v-for="loc in locations"
          :key="loc.key"
          class="loc-row"
          :style="{ paddingLeft: 8 + loc.depth * 16 + 'px' }"
          :class="{ selected: selected === loc.key }"
          @click="selected = loc.key"
        >
          <span class="radio-dot" :class="{ checked: selected === loc.key }" />
          <Folder v-if="loc.icon === 'folder'" :size="13" style="color: var(--text-3)" />
          <Plus v-else-if="loc.icon === 'new'" :size="13" style="color: var(--accent)" />
          <FilePlus2 v-else :size="13" style="color: var(--text-3)" />
          <span>{{ loc.label }}</span>
        </div>
      </div>
    </div>
    <div v-if="isNew" class="form-row" style="margin-top: 12px">
      <label>集合名称</label>
      <input v-model="newColName" class="input" spellcheck="false" />
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="app.modal = null">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.loc-list {
  flex: 1;
  max-height: 220px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 4px;
  background: var(--bg);
}
.loc-row {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 30px;
  border-radius: 5px;
  padding-right: 8px;
  cursor: pointer;
  font-size: 12.5px;
  color: var(--text-2);
}
.loc-row:hover {
  background: var(--bg-hover);
}
.loc-row.selected {
  color: var(--text);
  background: var(--accent-soft);
}
</style>
