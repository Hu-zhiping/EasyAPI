<script setup lang="ts">
import { computed, ref } from 'vue'
import { Folder, FilePlus2, Plus } from 'lucide-vue-next'
import ModalShell from '../ModalShell.vue'
import { useAppStore } from '../../stores/app'
import { useCollectionsStore } from '../../stores/collections'
import { useTabsStore } from '../../stores/tabs'
import { countRequests, findInCollections } from '../../lib/tree'
import { expandedIds } from '../../stores/uiState'
import type { CollectionNode, FolderNode } from '../../../../shared/types'

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
  count?: number
}

const NEW_KEY = '__new__'

const locations = computed<LocationItem[]>(() => {
  // 现有集合/文件夹在前；「创建新集合」压到最底并用分隔线隔离，
  // 避免与集合重名混淆、或被误当作默认保存位置（同名集合用计数区分）
  const out: LocationItem[] = []
  for (const c of cols.collections) {
    out.push({ key: `${c.id}::`, collectionId: c.id, parentId: null, label: c.name, depth: 0, icon: 'collection', count: countRequests(c) })
    const walk = (nodes: CollectionNode[], depth: number): void => {
      for (const n of nodes) {
        if (n.type !== 'folder') continue
        out.push({ key: `${c.id}::${n.id}`, collectionId: c.id, parentId: n.id, label: n.name, depth, icon: 'folder', count: countRequests(n) })
        walk(n.children, depth + 1)
      }
    }
    walk(c.children, 1)
  }
  out.push({ key: NEW_KEY, collectionId: '', parentId: null, label: '创建新集合…', depth: 0, icon: 'new' })
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

/** 输入法组合中（选词的 Enter）不触发保存 */
function enterSave(e: KeyboardEvent): void {
  if (e.isComposing || e.keyCode === 229) return
  save()
}

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
      <input v-model="name" class="input" spellcheck="false" @keydown.enter="enterSave" />
    </div>
    <div class="form-row" style="align-items: flex-start; margin-bottom: 0">
      <label style="padding-top: 5px">保存位置</label>
      <div class="loc-list">
        <div
          v-for="loc in locations"
          :key="loc.key"
          class="loc-row"
          :class="{ selected: selected === loc.key, 'new-item': loc.icon === 'new' }"
          :style="{ paddingLeft: 8 + loc.depth * 16 + 'px' }"
          @click="selected = loc.key"
        >
          <span v-if="loc.icon !== 'new'" class="radio-dot" :class="{ checked: selected === loc.key }" />
          <Plus v-else :size="13" style="color: var(--accent)" />
          <Folder v-if="loc.icon === 'folder'" :size="13" style="color: var(--text-3)" />
          <FilePlus2 v-else-if="loc.icon === 'collection'" :size="13" style="color: var(--text-3)" />
          <span class="loc-label">{{ loc.label }}</span>
          <span v-if="loc.icon !== 'new' && loc.count" class="loc-count">{{ loc.count }} 项</span>
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
  max-height: 240px;
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
.loc-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* 同名集合用已有请求数区分 */
.loc-count {
  flex: none;
  font-size: 10.5px;
  color: var(--text-3);
  background: var(--bg-active);
  border-radius: 8px;
  padding: 0 6px;
  line-height: 15px;
}
.loc-row.selected .loc-count {
  background: var(--accent-soft);
  color: var(--accent);
}
/* 「创建新集合」入口：置于列表末尾，与现有目标明确区隔 */
.loc-row.new-item {
  margin-top: 4px;
  border-top: 1px dashed var(--border);
  border-radius: 0 0 5px 5px;
  color: var(--text-3);
}
.loc-row.new-item:hover,
.loc-row.new-item.selected {
  color: var(--accent);
  background: var(--accent-soft);
}
</style>
