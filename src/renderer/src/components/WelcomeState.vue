<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Import, Zap, Play } from 'lucide-vue-next'
import { useTabsStore } from '../stores/tabs'
import { useAppStore } from '../stores/app'
import { useCollectionsStore } from '../stores/collections'

const tabs = useTabsStore()
const app = useAppStore()
const cols = useCollectionsStore()

const sampleRequest = computed(() => {
  for (const c of cols.collections) {
    const stack = [...c.children]
    while (stack.length) {
      const n = stack.pop()
      if (!n) continue
      if (n.type === 'request') return { collection: c, node: n }
      if (n.type === 'folder') stack.push(...n.children)
    }
  }
  return null
})

function openSample(): void {
  if (!sampleRequest.value) return
  const { collection, node } = sampleRequest.value
  tabs.openRequest(node.name, node, { collectionId: collection.id, nodeId: node.id, name: node.name })
  app.sidebarNav = 'collections'
}
</script>

<template>
  <div class="welcome">
    <div class="welcome-logo">
      <Zap :size="30" />
    </div>
    <h1>欢迎使用 EasyAPI</h1>
    <span class="sub">轻量、精致的接口调试工作台 · 无需登录 · 数据保存在本机</span>

    <div class="welcome-actions">
      <button class="btn btn-primary" @click="tabs.newTab()">
        <Plus :size="15" />
        新建请求
      </button>
      <button v-if="sampleRequest" class="btn btn-outline" @click="openSample">
        <Play :size="14" />
        打开示例接口
      </button>
      <button class="btn btn-outline" @click="app.modal = { type: 'import' }">
        <Import :size="14" />
        导入 cURL / 集合
      </button>
    </div>

    <div class="welcome-tips">
      <span class="kbd">Ctrl</span><span>+</span><span class="kbd">Enter</span>
      <span>发送请求</span>
      <span class="divider-v" />
      <span class="kbd">Ctrl</span><span>+</span><span class="kbd">T</span>
      <span>新建标签页</span>
      <span class="divider-v" />
      <span>左侧「集合」中已内置示例接口，点击即可体验</span>
    </div>
  </div>
</template>
