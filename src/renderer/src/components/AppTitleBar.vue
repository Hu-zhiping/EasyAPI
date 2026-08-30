<script setup lang="ts">
import { onMounted } from 'vue'
import { Minus, Square, Copy, X, Settings, Sun, Moon } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { ref } from 'vue'
import MenuBar from './MenuBar.vue'

const app = useAppStore()
const api = window.api
const maximized = ref(false)
let unlisten: (() => void) | null = null

onMounted(async () => {
  maximized.value = await api.winIsMaximized()
  unlisten = api.onMaximized((v) => (maximized.value = v))
})

function toggleTheme(): void {
  app.updateSettings({ theme: app.settings.theme === 'dark' ? 'light' : 'dark' })
}
</script>

<template>
  <div class="titlebar">
    <div class="tb-logo">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2 L4.5 13.5 H11 L9.5 22 L19.5 9.5 H12.5 Z" />
      </svg>
    </div>
    <span class="tb-title">EasyAPI</span>
    <span class="tb-ver">v{{ app.version }}</span>
    <MenuBar />
    <div class="tb-actions">
      <button class="win-btn" title="切换主题" @click="toggleTheme">
        <Sun v-if="app.settings.theme === 'dark'" :size="15" />
        <Moon v-else :size="15" />
      </button>
      <button class="win-btn" title="设置" @click="app.modal = { type: 'settings' }">
        <Settings :size="15" />
      </button>
      <div class="divider-v" />
      <button class="win-btn" title="最小化" @click="api.winMinimize()"><Minus :size="15" /></button>
      <button class="win-btn" :title="maximized ? '向下还原' : '最大化'" @click="api.winToggleMaximize()">
        <Copy v-if="maximized" :size="13" />
        <Square v-else :size="12" />
      </button>
      <button class="win-btn close" title="关闭" @click="api.winClose()"><X :size="16" /></button>
    </div>
  </div>
</template>
