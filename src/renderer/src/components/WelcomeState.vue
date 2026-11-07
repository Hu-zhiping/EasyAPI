<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Import, Zap, Play, ArrowUpRight, Braces, ShieldCheck } from 'lucide-vue-next'
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
    <div class="welcome-inner">
      <div class="welcome-brand">
        <div class="welcome-logo"><Zap :size="24" /></div>
        <span>EasyAPI</span>
        <span class="welcome-version">开源 · 本地优先</span>
      </div>

      <div class="welcome-heading">
        <h1>API 调试，简单直接。</h1>
        <p>从一次请求开始，到集合、环境与自动化测试。</p>
      </div>

      <div class="welcome-cards">
        <button class="welcome-card primary" @click="tabs.newTab()">
          <span class="welcome-card-icon"><Plus :size="19" /></span>
          <span class="welcome-card-copy">
            <strong>新建请求</strong>
            <small>从空白标签开始调试接口</small>
          </span>
          <ArrowUpRight :size="16" class="welcome-card-arrow" />
        </button>
        <button v-if="sampleRequest" class="welcome-card" @click="openSample">
          <span class="welcome-card-icon"><Play :size="18" /></span>
          <span class="welcome-card-copy">
            <strong>体验示例</strong>
            <small>打开可直接发送的演示接口</small>
          </span>
          <ArrowUpRight :size="16" class="welcome-card-arrow" />
        </button>
        <button class="welcome-card" @click="app.modal = { type: 'import' }">
          <span class="welcome-card-icon"><Import :size="18" /></span>
          <span class="welcome-card-copy">
            <strong>导入现有工作</strong>
            <small>支持 Postman 集合与 cURL</small>
          </span>
          <ArrowUpRight :size="16" class="welcome-card-arrow" />
        </button>
      </div>

      <div class="welcome-features">
        <span><Braces :size="13" /> 前置脚本与测试</span>
        <span><ShieldCheck :size="13" /> 无需登录，数据仅保存在本机</span>
      </div>

      <div class="welcome-shortcuts">
        <span><span class="kbd">Ctrl</span> + <span class="kbd">Enter</span> 发送请求</span>
        <span><span class="kbd">Ctrl</span> + <span class="kbd">T</span> 新建标签</span>
        <span><span class="kbd">Ctrl</span> + <span class="kbd">S</span> 保存请求</span>
      </div>
    </div>
  </div>
</template>
