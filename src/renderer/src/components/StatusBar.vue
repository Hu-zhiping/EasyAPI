<script setup lang="ts">
import { computed } from 'vue'
import { Globe, Terminal, HardDrive } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { useEnvsStore } from '../stores/envs'
import { useTabsStore } from '../stores/tabs'
import { formatBytes, formatDuration } from '../lib/format'

const app = useAppStore()
const envs = useEnvsStore()
const tabs = useTabsStore()

/** 激活标签页的最近响应：状态 / 耗时 / 大小，常驻可见 */
const resp = computed(() => tabs.activeTab?.response ?? null)
const respLevel = computed<'ok' | 'warn' | 'err'>(() => {
  if (!resp.value) return 'err'
  const s = resp.value.status
  if (s >= 200 && s < 400) return 'ok'
  if (s < 500) return 'warn'
  return 'err'
})
</script>

<template>
  <div class="statusbar">
    <span class="sb-item" title="当前使用的环境，点击管理环境变量" @click="app.sidebarNav = 'envs'">
      <Globe :size="11" />
      {{ envs.activeEnv?.name ?? '无环境' }}
    </span>
    <span class="sb-item" v-if="envs.globals.filter((g) => g.enabled && g.key).length" title="已启用的全局变量">
      {{ envs.globals.filter((g) => g.enabled && g.key).length }} 个全局变量
    </span>

    <span v-if="resp" class="sb-resp" :title="`最近响应：${resp.method} ${resp.requestUrl}`">
      <i class="sb-dot" :class="respLevel" />
      <span class="sb-num">{{ resp.status || (resp.error ? '失败' : '—') }}</span>
      <template v-if="resp.status">
        <span>·</span>
        <span class="sb-num">{{ formatDuration(resp.timeMs) }}</span>
        <span>·</span>
        <span class="sb-num">{{ formatBytes(resp.size) }}</span>
      </template>
    </span>

    <span class="sb-item right" @click="app.consoleOpen = !app.consoleOpen">
      <Terminal :size="11" />
      控制台
      <span v-if="app.consoleLogs.length" class="sb-badge">{{ app.consoleLogs.length }}</span>
    </span>
    <span class="sb-item" style="cursor: default" title="无需登录，请求集合与设置均保存在本机">
      <HardDrive :size="11" />
      本地存储
    </span>
  </div>
</template>
