import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Collection, CollectionNode, FolderNode, RequestDef, RequestNode } from '../../../shared/types'
import { cloneNode, findInCollections, removeFromTree } from '../lib/tree'
import { watchPersist } from './persist'

export const useCollectionsStore = defineStore('collections', () => {
  const collections = ref<Collection[]>([])

  function hydrate(data: { collections?: Collection[] }): void {
    collections.value = data.collections ?? []
  }

  function addCollection(name: string, description?: string): Collection {
    const c: Collection = {
      id: crypto.randomUUID(),
      type: 'collection',
      name,
      description,
      children: [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    collections.value.push(c)
    return c
  }

  function addFolder(collectionId: string, parentId: string | null, name: string): FolderNode | null {
    const c = collections.value.find((x) => x.id === collectionId)
    if (!c) return null
    const folder: FolderNode = { id: crypto.randomUUID(), type: 'folder', name, children: [] }
    if (parentId) {
      const found = findInCollections([c], parentId)
      if (found && found.node.type === 'folder') (found.node as FolderNode).children.push(folder)
      else c.children.push(folder)
    } else {
      c.children.push(folder)
    }
    touch(c)
    return folder
  }

  function addRequest(collectionId: string, parentId: string | null, name: string, def: RequestDef): RequestNode | null {
    const c = collections.value.find((x) => x.id === collectionId)
    if (!c) return null
    const node: RequestNode = {
      ...JSON.parse(JSON.stringify(def)),
      id: crypto.randomUUID(),
      type: 'request',
      name,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    if (parentId) {
      const found = findInCollections([c], parentId)
      if (found && found.node.type === 'folder') (found.node as FolderNode).children.push(node)
      else c.children.push(node)
    } else {
      c.children.push(node)
    }
    touch(c)
    return node
  }

  function renameNode(id: string, name: string): void {
    for (const c of collections.value) {
      const found = findInCollections([c], id)
      if (found) {
        found.node.name = name
        if (found.node.type === 'request') found.node.updatedAt = Date.now()
        touch(c)
        return
      }
    }
  }

  function updateRequestNode(id: string, def: RequestDef, name?: string): boolean {
    for (const c of collections.value) {
      const found = findInCollections([c], id)
      if (found && found.node.type === 'request') {
        const req = JSON.parse(JSON.stringify(def)) as RequestDef
        Object.assign(found.node, req)
        if (name !== undefined) found.node.name = name
        found.node.updatedAt = Date.now()
        touch(c)
        return true
      }
    }
    return false
  }

  function duplicateNode(id: string): void {
    for (const c of collections.value) {
      const found = findInCollections([c], id)
      if (!found) continue
      const copy = cloneNode(found.node)
      const siblings = found.parent ? (found.parent as FolderNode).children : c.children
      const idx = siblings.findIndex((n) => n.id === id)
      siblings.splice(idx >= 0 ? idx + 1 : siblings.length, 0, copy)
      touch(c)
      return
    }
  }

  function removeNode(id: string): void {
    const idx = collections.value.findIndex((c) => c.id === id)
    if (idx >= 0) {
      collections.value.splice(idx, 1)
      return
    }
    for (const c of collections.value) {
      if (removeFromTree(c, id)) {
        touch(c)
        return
      }
    }
  }

  function containsId(node: CollectionNode, id: string): boolean {
    if (node.id === id) return true
    if (node.type !== 'request') return (node.children as CollectionNode[]).some((c) => containsId(c, id))
    return false
  }

  /** 拖拽排序：把 id 节点移动到 targetId 的 before/after/into 位置（into 仅支持文件夹/集合） */
  function moveNode(id: string, targetId: string, pos: 'before' | 'after' | 'into'): boolean {
    if (id === targetId) return false
    const src = findInCollections(collections.value, id)
    if (!src) return false
    if (containsId(src.node, targetId)) return false // 不能移动到自身或其后代内部
    const tgt = findInCollections(collections.value, targetId)
    if (!tgt) return false
    const node = src.node

    // into 只允许文件夹与集合
    if (pos === 'into' && tgt.node.type === 'request') return false

    removeFromTree(src.collection, id)
    const tgt2 = findInCollections(collections.value, targetId)
    if (!tgt2) return false

    if (pos === 'into') {
      ;(tgt2.node as FolderNode | Collection).children.push(node)
    } else {
      const siblings = tgt2.parent ? (tgt2.parent as FolderNode).children : tgt2.collection.children
      const idx = siblings.findIndex((n) => n.id === targetId)
      if (idx < 0) return false
      siblings.splice(pos === 'before' ? idx : idx + 1, 0, node)
    }
    touch(tgt2.collection)
    return true
  }

  function touch(c: Collection): void {
    c.updatedAt = Date.now()
  }

  function importCollections(list: Collection[]): void {
    collections.value.push(...list)
  }

  watchPersist(() => collections.value, 'collections')

  return {
    collections,
    hydrate,
    addCollection,
    addFolder,
    addRequest,
    renameNode,
    updateRequestNode,
    duplicateNode,
    removeNode,
    moveNode,
    importCollections
  }
})
