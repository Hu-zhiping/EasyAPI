<script setup lang="ts">
import { Globe, Terminal, Zap } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { useEnvsStore } from '../stores/envs'

const app = useAppStore()
const envs = useEnvsStore()
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
    <span class="sb-item right" @click="app.consoleOpen = !app.consoleOpen">
      <Terminal :size="11" />
      控制台
      <span v-if="app.consoleLogs.length" class="sb-badge">{{ app.consoleLogs.length }}</span>
    </span>
    <span class="sb-item" style="cursor: default" title="EasyAPI · 本地优先，数据保存在本机">
      <Zap :size="11" />
      v{{ app.version }}
    </span>
  </div>
</template>
