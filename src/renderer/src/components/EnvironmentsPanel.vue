<script setup lang="ts">
import { Plus, Globe, Pencil, MoreHorizontal, Check } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { useEnvsStore } from '../stores/envs'

const app = useAppStore()
const envs = useEnvsStore()

function editGlobals(): void {
  app.modal = { type: 'env', envId: '__globals__' }
}

function editEnv(id: string | null): void {
  app.modal = { type: 'env', envId: id }
}

function deleteEnv(id: string, name: string): void {
  app.modal = {
    type: 'confirm',
    title: '删除环境',
    message: `确定要删除环境「${name}」吗？`,
    confirmText: '删除',
    danger: true,
    onOk: () => envs.deleteEnv(id)
  }
}

function menu(e: MouseEvent, id: string, name: string): void {
  e.preventDefault()
  e.stopPropagation()
  app.openContextMenu(e.clientX, e.clientY, [
    { label: '编辑', icon: 'pencil', action: () => editEnv(id) },
    { label: '复制环境', icon: 'copy', action: () => envs.duplicateEnv(id) },
    { label: '设为使用中', icon: 'radio', action: () => (envs.activeEnvId = id) },
    { label: '__sep' },
    { label: '删除环境', icon: 'trash', danger: true, action: () => deleteEnv(id, name) }
  ])
}

function globalsMenu(e: MouseEvent): void {
  e.preventDefault()
  e.stopPropagation()
  app.openContextMenu(e.clientX, e.clientY, [
    { label: '编辑全局变量', icon: 'pencil', action: editGlobals },
    { label: '__sep' },
    {
      label: '清空全部全局变量',
      icon: 'trash',
      danger: true,
      action: () => {
        app.modal = {
          type: 'confirm',
          title: '清空全局变量',
          message: '确定要清空全部全局变量吗？',
          confirmText: '清空',
          danger: true,
          onOk: () => (envs.globals = [])
        }
      }
    }
  ])
}
</script>

<template>
  <div class="sidebar-top">
    <div class="sidebar-top-row">
      <span class="panel-title">环境变量</span>
      <button class="icon-btn" title="新建环境" @click="editEnv(null)">
        <Plus :size="17" />
      </button>
    </div>
  </div>

  <div class="sidebar-scroll">
    <!-- 全局变量 -->
    <div class="env-row" @click="editGlobals" @contextmenu="globalsMenu">
      <span class="tree-icon"><Globe :size="14" /></span>
      <span class="env-name">全局变量</span>
      <span class="tree-count">{{ envs.globals.length }}</span>
      <button class="icon-btn tree-kebab" title="编辑全局变量" @click.stop="editGlobals">
        <Pencil :size="13" />
      </button>
    </div>

    <div style="padding: 10px 8px 4px; font-size: 11px; font-weight: 600; color: var(--text-3)">环境</div>

    <div
      v-for="e in envs.environments"
      :key="e.id"
      class="env-row"
      :title="envs.activeEnvId === e.id ? '当前使用的环境' : '点击设为当前环境'"
      @click="envs.activeEnvId = e.id"
      @contextmenu="menu($event, e.id, e.name)"
    >
      <span class="radio-dot" :class="{ checked: envs.activeEnvId === e.id }" />
      <span class="env-name">{{ e.name }}</span>
      <span v-if="envs.activeEnvId === e.id" class="env-badge">
        <Check :size="10" style="vertical-align: -1px" /> 使用中
      </span>
      <span class="tree-count">{{ e.variables.filter((v) => v.enabled && v.key).length }}</span>
      <button class="icon-btn tree-kebab" title="更多操作" @click="menu($event, e.id, e.name)">
        <MoreHorizontal :size="15" />
      </button>
    </div>

    <div v-if="!envs.environments.length" class="empty-center" style="padding: 26px 14px">
      <Globe :size="24" style="opacity: 0.4" />
      <span class="big">还没有环境</span>
      <span style="text-align: center; line-height: 1.6">创建环境来管理不同场景下的<br />接口地址、密钥等变量</span>
    </div>
  </div>

  <div class="hint-line">
    在 URL、参数、请求头和请求体中都可以使用
    <code v-pre>{{变量名}}</code> 引用变量，例如
    <code v-pre>{{baseUrl}}/api/users</code>；
    内置动态变量 <code v-pre>{{$timestamp}}</code>、<code v-pre>{{$uuid}}</code>、<code v-pre>{{$randomInt}}</code>。
  </div>
</template>
