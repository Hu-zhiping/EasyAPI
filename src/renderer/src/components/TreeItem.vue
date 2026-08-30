<script setup lang="ts">
import { computed } from 'vue'
import { ChevronRight, Folder, MoreHorizontal } from 'lucide-vue-next'
import type { Collection, CollectionNode, FolderNode, RequestNode } from '../../../shared/types'
import { useAppStore, type ContextMenuItem } from '../stores/app'
import { useCollectionsStore } from '../stores/collections'
import { useTabsStore } from '../stores/tabs'
import { countRequests } from '../lib/tree'
import { methodClass, shortUrl } from '../lib/format'
import { exportPostmanCollection } from '../lib/postman'
import { emptyRequestDef } from '../lib/http'
import { expandedIds, treeDrag } from '../stores/uiState'

const props = defineProps<{
  node: CollectionNode
  collection: Collection
  depth: number
  forceOpen?: boolean
}>()

const app = useAppStore()
const cols = useCollectionsStore()
const tabs = useTabsStore()

const isContainer = computed(() => props.node.type === 'collection' || props.node.type === 'folder')
const isOpen = computed(() => props.forceOpen || expandedIds.has(props.node.id))
const isActive = computed(() => {
  const t = tabs.tabs.find((x) => x.savedRef?.nodeId === props.node.id)
  return !!t && t.id === tabs.activeId
})

function toggle(): void {
  if (!isOpen.value) expandedIds.add(props.node.id)
  else expandedIds.delete(props.node.id)
}

function open(): void {
  if (props.node.type !== 'request') return
  tabs.openRequest(props.node.name, props.node, {
    collectionId: props.collection.id,
    nodeId: props.node.id,
    name: props.node.name
  })
}

function promptNew(type: 'request' | 'folder'): void {
  const parentId = props.node.type === 'folder' ? props.node.id : null
  expandedIds.add(props.node.id)
  app.modal = {
    type: 'input',
    title: type === 'request' ? '新建请求' : '新建文件夹',
    label: '名称',
    initial: type === 'request' ? '未命名请求' : '新建文件夹',
    confirmText: '创建',
    onOk: (name) => {
      if (type === 'request') cols.addRequest(props.collection.id, parentId, name, emptyRequestDef('GET'))
      else cols.addFolder(props.collection.id, parentId, name)
    }
  }
}

function promptRename(): void {
  app.modal = {
    type: 'input',
    title: '重命名',
    label: '名称',
    initial: props.node.name,
    confirmText: '确定',
    onOk: (name) => {
      cols.renameNode(props.node.id, name)
      // 同步已打开标签页的标题
      for (const t of tabs.tabs) {
        if (t.savedRef?.nodeId === props.node.id) {
          t.title = name
          t.savedRef = { ...t.savedRef, name }
        }
      }
    }
  }
}

function confirmDelete(): void {
  const typeText =
    props.node.type === 'request' ? '请求' : props.node.type === 'folder' ? '文件夹' : '集合'
  // 预先收集将被删除的节点 id，删除后联动关闭相关标签页
  const ids = new Set<string>()
  const collect = (n: CollectionNode): void => {
    ids.add(n.id)
    if (n.type !== 'request') n.children.forEach(collect)
  }
  collect(props.node)
  app.modal = {
    type: 'confirm',
    title: `删除${typeText}`,
    message: `确定要删除「${props.node.name}」吗？${props.node.type !== 'request' ? '其中的所有内容都会被一并删除，' : ''}该操作不可撤销。`,
    confirmText: '删除',
    danger: true,
    onOk: () => {
      cols.removeNode(props.node.id)
      for (const t of [...tabs.tabs]) {
        if (t.savedRef && ids.has(t.savedRef.nodeId)) tabs.closeTab(t.id)
      }
    }
  }
}

async function exportCollection(): Promise<void> {
  const c = props.node as Collection
  const api = window.api
  const path = await api.pickSavePath({
    title: '导出集合',
    defaultName: `${c.name}.postman_collection.json`,
    filters: [{ name: 'Postman 集合', extensions: ['json'] }]
  })
  if (!path) return
  await api.writeFile({ path, content: JSON.stringify(exportPostmanCollection(c), null, 2) })
  app.toast('集合已导出（Postman v2.1 格式）', 'success')
}

function duplicate(): void {
  cols.duplicateNode(props.node.id)
}

function genCode(): void {
  if (props.node.type !== 'request') return
  app.modal = { type: 'codegen', request: props.node as RequestNode }
}

function menu(e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()
  const n = props.node
  const items: ContextMenuItem[] = []
  if (n.type === 'collection') {
    items.push(
      { label: '新建请求', icon: 'file-plus', action: () => promptNew('request') },
      { label: '新建文件夹', icon: 'folder-plus', action: () => promptNew('folder') },
      { label: '__sep' },
      { label: '重命名', icon: 'pencil', action: promptRename },
      { label: '复制集合', icon: 'copy', action: duplicate },
      { label: '导出集合', icon: 'download', action: () => void exportCollection() },
      { label: '__sep' },
      { label: '删除集合', icon: 'trash', danger: true, action: confirmDelete }
    )
  } else if (n.type === 'folder') {
    items.push(
      { label: '新建请求', icon: 'file-plus', action: () => promptNew('request') },
      { label: '新建文件夹', icon: 'folder-plus', action: () => promptNew('folder') },
      { label: '__sep' },
      { label: '重命名', icon: 'pencil', action: promptRename },
      { label: '复制文件夹', icon: 'copy', action: duplicate },
      { label: '__sep' },
      { label: '删除文件夹', icon: 'trash', danger: true, action: confirmDelete }
    )
  } else {
    items.push(
      { label: '重命名', icon: 'pencil', action: promptRename },
      { label: '复制请求', icon: 'copy', action: duplicate },
      { label: '生成代码', icon: 'code', action: genCode },
      { label: '__sep' },
      { label: '删除请求', icon: 'trash', danger: true, action: confirmDelete }
    )
  }
  app.openContextMenu(e.clientX, e.clientY, items)
}

const reqNode = computed(() => (props.node.type === 'request' ? (props.node as RequestNode) : null))
const containerNode = computed(() =>
  props.node.type === 'request' ? null : (props.node as FolderNode | Collection)
)

/* ---- 拖拽排序 ---- */
function onDragStart(e: DragEvent, id: string): void {
  treeDrag.id = id
  treeDrag.overId = null
  treeDrag.overPos = null
  e.dataTransfer?.setData('text/plain', id)
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragEnd(): void {
  treeDrag.id = null
  treeDrag.overId = null
  treeDrag.overPos = null
}

function onDragOver(e: DragEvent, node: CollectionNode): void {
  if (!treeDrag.id || treeDrag.id === node.id) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const y = e.clientY - rect.top
  let pos: 'before' | 'after' | 'into'
  if (node.type === 'request') {
    pos = y < rect.height / 2 ? 'before' : 'after'
  } else {
    pos = y < rect.height * 0.3 ? 'before' : y > rect.height * 0.7 ? 'after' : 'into'
  }
  treeDrag.overId = node.id
  treeDrag.overPos = pos
}

function onDrop(e: DragEvent, node: CollectionNode): void {
  const dragId = treeDrag.id
  const pos = treeDrag.overPos
  onDragEnd()
  if (!dragId || !pos) return
  if (cols.moveNode(dragId, node.id, pos) && pos === 'into') expandedIds.add(node.id)
}

function dragClass(node: CollectionNode): Record<string, boolean> {
  return {
    'drag-into': treeDrag.overId === node.id && treeDrag.overPos === 'into',
    'drag-before': treeDrag.overId === node.id && treeDrag.overPos === 'before',
    'drag-after': treeDrag.overId === node.id && treeDrag.overPos === 'after'
  }
}
</script>

<template>
  <div>
    <!-- 容器行（集合/文件夹） -->
    <div
      v-if="containerNode"
      class="tree-row"
      :class="dragClass(node)"
      :style="{ paddingLeft: 6 + depth * 14 + 'px' }"
      draggable="true"
      @click="toggle"
      @contextmenu="menu"
      @dragstart="onDragStart($event, node.id)"
      @dragend="onDragEnd"
      @dragover.prevent="onDragOver($event, node)"
      @drop.prevent="onDrop($event, node)"
    >
      <span class="tree-chevron" :class="{ open: isOpen }">
        <ChevronRight :size="13" />
      </span>
      <span class="tree-icon"><Folder :size="14" /></span>
      <span class="tree-name">{{ node.name }}</span>
      <span v-if="node.type === 'collection'" class="tree-count">{{ countRequests(node) }}</span>
      <button class="icon-btn tree-kebab" title="更多操作" @click="menu">
        <MoreHorizontal :size="15" />
      </button>
    </div>

    <!-- 请求行 -->
    <div
      v-else-if="reqNode"
      class="tree-row"
      :class="{ active: isActive, ...dragClass(node) }"
      :style="{ paddingLeft: 6 + depth * 14 + 'px' }"
      :title="reqNode.url ? shortUrl(reqNode.url) : ''"
      draggable="true"
      @click="open"
      @contextmenu="menu"
      @dragstart="onDragStart($event, node.id)"
      @dragend="onDragEnd"
      @dragover.prevent="onDragOver($event, node)"
      @drop.prevent="onDrop($event, node)"
    >
      <span class="tree-chevron hidden"><ChevronRight :size="13" /></span>
      <span class="tree-icon req">
        <span class="chip method-chip" :class="methodClass(reqNode.method)">{{ reqNode.method }}</span>
      </span>
      <span class="tree-name">{{ node.name }}</span>
      <button class="icon-btn tree-kebab" title="更多操作" @click="menu">
        <MoreHorizontal :size="15" />
      </button>
    </div>

    <!-- 子级 -->
    <div v-if="containerNode && isOpen && containerNode.children.length" class="tree-children">
      <TreeItem
        v-for="c in containerNode.children"
        :key="c.id"
        :node="c"
        :collection="collection"
        :depth="depth + 1"
        :force-open="forceOpen"
      />
    </div>
  </div>
</template>
