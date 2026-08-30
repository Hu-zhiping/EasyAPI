<script setup lang="ts">
import { Database, Globe, History } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'

const app = useAppStore()

const NAVS = [
  { value: 'collections', label: '集合', icon: Database },
  { value: 'envs', label: '环境变量', icon: Globe },
  { value: 'history', label: '历史记录', icon: History }
] as const
</script>

<template>
  <div class="activity-bar">
    <button
      v-for="n in NAVS"
      :key="n.value"
      class="ab-btn"
      :class="{ active: app.sidebarNav === n.value }"
      :title="n.label"
      @click="app.sidebarNav = n.value"
    >
      <component :is="n.icon" :size="19" :stroke-width="1.8" />
    </button>
  </div>
</template>
