<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { Minus, Square, Copy, X, Settings, Sun, Moon, Globe, ChevronDown } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { useEnvsStore } from '../stores/envs'
import MenuBar from './MenuBar.vue'
import PopSelect from './PopSelect.vue'
import { TITLEBAR_OVERLAY } from '../../../shared/titlebar'

const app = useAppStore()
const envs = useEnvsStore()
const api = window.api
const maximized = ref(false)
let unlisten: (() => void) | null = null

/** win/mac 用系统叠加窗口按钮（贴边分屏 / 阴影 / 双击最大化均为原生行为）；Linux 退回自绘 */
const nativeControls = computed(() => app.platform !== 'linux')

const envOptions = computed(() => [
  { value: '', label: '无环境' },
  { value: '__sep', label: '' },
  { value: '__label', label: '环境变量' },
  ...envs.environments.map((e) => ({
    value: e.id,
    label: e.name,
    desc: `${e.variables.filter((v) => v.enabled && v.key).length} 个变量`
  })),
  { value: '__sep2', label: '' },
  { value: '__manage', label: '管理环境…' }
])

function onEnvPick(v: string): void {
  if (v === '__manage') {
    app.modal = { type: 'env', envId: null }
    return
  }
  envs.activeEnvId = v || null
}

onMounted(async () => {
  if (!nativeControls.value) {
    maximized.value = await api.winIsMaximized()
    unlisten = api.onMaximized((v) => (maximized.value = v))
  }
})

function toggleTheme(): void {
  app.updateSettings({ theme: app.settings.theme === 'dark' ? 'light' : 'dark' })
}

// 主题切换时同步原生窗口按钮的底色与符号色
watch(
  () => app.settings.theme,
  (t) => {
    if (nativeControls.value) api.setTitleBarOverlay(TITLEBAR_OVERLAY[t])
  }
)
</script>

<template>
  <div class="titlebar" :class="{ 'native-controls': nativeControls }">
    <div class="tb-logo">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
        <path d="M13 2 L4.5 13.5 H11 L9.5 22 L19.5 9.5 H12.5 Z" />
      </svg>
    </div>
    <MenuBar />
    <div class="tb-actions">
      <PopSelect
        class="tb-env"
        :model-value="envs.activeEnvId ?? ''"
        :options="envOptions"
        align="right"
        @select="onEnvPick"
      >
        <template #trigger>
          <span class="tb-env-trigger" title="切换当前环境">
            <Globe :size="13" />
            <span class="tb-env-name">{{ envs.activeEnv?.name ?? '无环境' }}</span>
            <ChevronDown :size="12" />
          </span>
        </template>
      </PopSelect>
      <div class="tb-action-divider" />
      <button class="win-btn" title="切换主题" @click="toggleTheme">
        <Sun v-if="app.settings.theme === 'dark'" :size="15" />
        <Moon v-else :size="15" />
      </button>
      <button class="win-btn" title="设置" @click="app.modal = { type: 'settings' }">
        <Settings :size="15" />
      </button>
      <template v-if="!nativeControls">
        <div class="divider-v" />
        <button class="win-btn" title="最小化" @click="api.winMinimize()"><Minus :size="15" /></button>
        <button class="win-btn" :title="maximized ? '向下还原' : '最大化'" @click="api.winToggleMaximize()">
          <Copy v-if="maximized" :size="13" />
          <Square v-else :size="12" />
        </button>
        <button class="win-btn close" title="关闭" @click="api.winClose()"><X :size="16" /></button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.tb-env {
  margin-right: 4px;
}
.tb-env-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  max-width: 170px;
  padding: 0 9px;
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text-2);
  background: var(--bg);
  font-size: 12px;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.tb-env-trigger:hover {
  color: var(--text);
  border-color: var(--border-strong);
  background: var(--bg-hover);
}
.tb-env-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tb-action-divider {
  width: 1px;
  height: 16px;
  margin: 0 5px;
  background: var(--border);
}
/* 原生窗口按钮（叠加层）占据标题栏右侧，自绘按钮避开该区域 */
.titlebar.native-controls .tb-actions {
  margin-right: 144px;
}
</style>
