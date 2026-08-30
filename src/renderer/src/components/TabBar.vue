<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, X, Globe } from 'lucide-vue-next'
import { useTabsStore } from '../stores/tabs'
import { useEnvsStore } from '../stores/envs'
import { useAppStore } from '../stores/app'
import { useCollectionsStore } from '../stores/collections'
import PopSelect from './PopSelect.vue'
import { methodClass } from '../lib/format'

const tabs = useTabsStore()
const envs = useEnvsStore()
const app = useAppStore()
const cols = useCollectionsStore()

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

function onTabContext(e: MouseEvent, id: string): void {
  e.preventDefault()
  app.openContextMenu(e.clientX, e.clientY, [
    { label: '重命名', icon: 'pencil', action: () => startRename(id) },
    { label: '另存为…', icon: 'copy', action: () => tabs.saveActive(true) },
    { label: '__sep' },
    { label: '关闭标签页', icon: 'close', action: () => tabs.closeTab(id) },
    { label: '关闭其他标签页', action: () => tabs.closeOthers(id) },
    { label: '关闭右侧标签页', action: () => tabs.closeRight(id) }
  ])
}

/* ---- 行内重命名（双击标题触发） ---- */
const editingId = ref<string | null>(null)
const editingName = ref('')

function startRename(id: string): void {
  const t = tabs.tabs.find((x) => x.id === id)
  if (!t) return
  editingId.value = id
  editingName.value = t.title
}

function focusInput(el: unknown): void {
  const input = el as HTMLInputElement | null
  if (input) {
    input.focus()
    input.select()
  }
}

function commitRename(): void {
  const id = editingId.value
  editingId.value = null
  if (!id) return
  const name = editingName.value.trim()
  if (!name) return
  const t = tabs.tabs.find((x) => x.id === id)
  if (!t || t.title === name) return
  t.title = name
  if (t.savedRef) {
    t.savedRef = { ...t.savedRef, name }
    cols.renameNode(t.savedRef.nodeId, name)
  }
}
</script>

<template>
  <div class="tabbar">
    <div class="tabbar-tabs">
      <div
        v-for="t in tabs.tabs"
        :key="t.id"
        class="tab"
        :class="{ active: t.id === tabs.activeId }"
        @click="tabs.activeId = t.id"
        @auxclick.middle.prevent="tabs.closeTab(t.id)"
        @contextmenu="onTabContext($event, t.id)"
      >
        <span class="chip method-chip tab-method" :class="methodClass(t.request.method)">{{ t.request.method }}</span>
        <input
          v-if="editingId === t.id"
          v-model="editingName"
          class="tab-edit"
          spellcheck="false"
          :ref="focusInput"
          @click.stop
          @dblclick.stop
          @keydown.enter.prevent="commitRename"
          @keydown.esc.prevent="editingId = null"
          @blur="commitRename"
        />
        <span v-else class="tab-title" title="双击重命名" @dblclick.stop="startRename(t.id)">{{ t.title }}</span>
        <span
          class="tab-close"
          :class="{ 'has-dirty': tabs.isDirty(t) }"
          :title="tabs.isDirty(t) ? '有未保存的修改，点击关闭（悬停显示 ×）' : '关闭 (Ctrl+W)'"
          @click.stop="tabs.closeTab(t.id)"
        >
          <span v-if="tabs.isDirty(t)" class="tab-dirty-dot" />
          <X v-else :size="13" />
        </span>
      </div>
      <button class="icon-btn tab-add" title="新建标签页 (Ctrl+T)" @click="tabs.newTab()">
        <Plus :size="16" />
      </button>
    </div>
    <div class="tabbar-right">
      <PopSelect
        :model-value="envs.activeEnvId ?? ''"
        :options="envOptions"
        align="right"
        @select="onEnvPick"
      >
        <template #trigger>
          <span class="env-trigger">
            <Globe :size="13" />
            <span>{{ envs.activeEnv?.name ?? '无环境' }}</span>
          </span>
        </template>
      </PopSelect>
    </div>
  </div>
</template>

<style scoped>
.env-trigger {
  display: flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: 6px;
  color: var(--text-2);
  font-size: 12px;
  border: 1px solid var(--border);
  background: var(--bg-panel);
  transition: color 0.12s, border-color 0.12s;
}
.env-trigger:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.tab-edit {
  flex: 1;
  min-width: 0;
  height: 22px;
  padding: 0 6px;
  border: 1px solid var(--accent);
  border-radius: 4px;
  background: var(--bg);
  color: var(--text);
  font-size: 12px;
}
</style>
