<script setup lang="ts">
import CollectionsPanel from './CollectionsPanel.vue'
import EnvironmentsPanel from './EnvironmentsPanel.vue'
import HistoryPanel from './HistoryPanel.vue'
import { useAppStore } from '../stores/app'

const app = useAppStore()

function onResizeMove(e: MouseEvent): void {
  // 减去最左侧 48px 图标栏后的剩余宽度即侧边面板宽度
  const w = Math.min(420, Math.max(200, e.clientX - 48))
  app.updateSettings({ sidebarWidth: w })
}

function onResizeUp(): void {
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeUp)
  document.body.style.cursor = ''
}

function startResize(): void {
  document.body.style.cursor = 'col-resize'
  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeUp)
}
</script>

<template>
  <div class="sidebar" :style="{ width: app.settings.sidebarWidth + 'px' }">
    <div v-show="app.sidebarNav === 'collections'" class="sidebar-pane">
      <CollectionsPanel />
    </div>
    <div v-show="app.sidebarNav === 'envs'" class="sidebar-pane">
      <EnvironmentsPanel />
    </div>
    <div v-show="app.sidebarNav === 'history'" class="sidebar-pane">
      <HistoryPanel />
    </div>
  </div>
  <div class="sidebar-resizer" @mousedown="startResize" />
</template>

<style scoped>
.sidebar-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
