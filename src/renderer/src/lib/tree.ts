import type { Collection, CollectionNode, FolderNode } from '../../../shared/types'

export interface FoundNode {
  node: CollectionNode
  parent: FolderNode | Collection | null
  collection: Collection
}

export function walkCollection(
  c: Collection,
  fn: (node: CollectionNode, parent: FolderNode | Collection | null) => void
): void {
  const visit = (nodes: CollectionNode[], parent: FolderNode | Collection | null): void => {
    for (const n of nodes) {
      fn(n, parent)
      if (n.type === 'folder') visit(n.children, n)
    }
  }
  visit(c.children, c)
}

export function findInCollections(collections: Collection[], id: string): FoundNode | null {
  for (const c of collections) {
    let found: FoundNode | null = null
    walkCollection(c, (node, parent) => {
      if (!found && node.id === id) found = { node, parent, collection: c }
    })
    if (found) return found
  }
  return null
}

export function removeFromTree(c: Collection, id: string): boolean {
  const removeAt = (nodes: CollectionNode[]): boolean => {
    const idx = nodes.findIndex((n) => n.id === id)
    if (idx >= 0) {
      nodes.splice(idx, 1)
      return true
    }
    return nodes.some((n) => n.type === 'folder' && removeAt(n.children))
  }
  return removeAt(c.children)
}

/** 深拷贝节点并重置所有子节点 id */
export function cloneNode(node: CollectionNode): CollectionNode {
  const copy = JSON.parse(JSON.stringify(node)) as CollectionNode
  const reset = (n: CollectionNode): void => {
    n.id = crypto.randomUUID()
    if (n.type === 'folder') n.children.forEach(reset)
  }
  reset(copy)
  return copy
}

export function countRequests(node: CollectionNode): number {
  if (node.type === 'request') return 1
  let n = 0
  for (const c of node.children) n += countRequests(c)
  return n
}

/** 匹配过滤时保留命中的节点及其祖先链；返回 null 表示无匹配 */
export function filterTree(nodes: CollectionNode[], kw: string): CollectionNode[] | null {
  if (!kw) return null
  const k = kw.toLowerCase()
  const out: CollectionNode[] = []
  for (const n of nodes) {
    if (n.type === 'request') {
      if (n.name.toLowerCase().includes(k) || n.url.toLowerCase().includes(k)) out.push(n)
    } else {
      const children = filterTree(n.children, kw)
      if (children) out.push({ ...n, children } as CollectionNode)
      else if (n.name.toLowerCase().includes(k)) out.push(JSON.parse(JSON.stringify(n)) as CollectionNode)
    }
  }
  return out
}
