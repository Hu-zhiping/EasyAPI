<script setup lang="ts">
import { Database, Globe, History } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'

const app = useAppStore()

const NAVS = [
  { value: 'collections', label: '集合', icon: Database },
  { value: 'envs', label: '环境', icon: Globe },
  { value: 'history', label: '历史', icon: History }
] as const
</script>

<template>
  <div class="activity-bar">
    <button
      v-for="n in NAVS"
      :key="n.value"
      class="ab-btn"
      :class="{ active: app.sidebarNav === n.value }"
      :title="n.label === '集合' ? '请求集合' : n.label === '环境' ? '环境变量' : '历史记录'"
      @click="app.sidebarNav = n.value"
    >
      <component :is="n.icon" :size="18" :stroke-width="1.8" />
      <span class="ab-label">{{ n.label }}</span>
    </button>
  </div>
</template>
