<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { Component } from 'vue'
import {
  Copy,
  Download,
  FilePlus,
  FolderOpen,
  FolderPlus,
  Pencil,
  Play,
  Trash2,
  X,
  Code2,
  Layers,
  Radio
} from 'lucide-vue-next'
import { useAppStore, type ContextMenuItem } from '../stores/app'

const app = useAppStore()

const ICONS: Record<string, Component> = {
  pencil: Pencil,
  copy: Copy,
  trash: Trash2,
  'folder-plus': FolderPlus,
  'file-plus': FilePlus,
  download: Download,
  code: Code2,
  play: Play,
  open: FolderOpen,
  close: X,
  layers: Layers,
  radio: Radio
}

const x = ref(0)
const y = ref(0)
const el = ref<HTMLElement | null>(null)

watch(
  () => app.contextMenu,
  async (v) => {
    if (!v) return
    x.value = v.x
    y.value = v.y
    await nextTick()
    if (!el.value) return
    const mw = el.value.offsetWidth
    const mh = el.value.offsetHeight
    if (x.value + mw > window.innerWidth - 8) x.value = window.innerWidth - 8 - mw
    if (y.value + mh > window.innerHeight - 8) y.value = window.innerHeight - 8 - mh
  }
)

function run(item: ContextMenuItem): void {
  if (item.disabled) return
  app.closeContextMenu()
  item.action?.()
}

function onDocClick(e: MouseEvent): void {
  const t = e.target as Node
  // 点击菜单内部时不关闭，否则菜单在 mouseup 前被移除，click 无法触发
  if (el.value?.contains(t)) return
  app.closeContextMenu()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') app.closeContextMenu()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocClick, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocClick, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="app.contextMenu" ref="el" class="ctx-menu" :style="{ left: x + 'px', top: y + 'px' }">
      <template v-for="(item, i) in app.contextMenu.items" :key="i">
        <div v-if="item.label.startsWith('__sep')" class="ctx-divider" />
        <div
          v-else
          class="ctx-item"
          :class="{ danger: item.danger, disabled: item.disabled }"
          @click="run(item)"
        >
          <component :is="ICONS[item.icon ?? '']" v-if="item.icon && ICONS[item.icon]" :size="14" />
          <span>{{ item.label }}</span>
        </div>
      </template>
    </div>
  </Teleport>
</template>
