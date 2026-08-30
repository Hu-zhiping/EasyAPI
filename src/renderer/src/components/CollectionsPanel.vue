<script setup lang="ts">
import { computed, ref } from 'vue'
import { Plus, Search, Import, FolderOpen } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { useCollectionsStore } from '../stores/collections'
import TreeItem from './TreeItem.vue'
import { filterTree } from '../lib/tree'

const app = useAppStore()
const cols = useCollectionsStore()
const kw = ref('')

const visible = computed(() => {
  if (!kw.value.trim()) return cols.collections
  return cols.collections
    .map((c) => {
      const children = filterTree(c.children, kw.value.trim())
      if (children) return { ...c, children }
      if (c.name.toLowerCase().includes(kw.value.trim().toLowerCase())) return c
      return null
    })
    .filter((c): c is (typeof cols.collections)[number] => !!c)
})

function newCollection(): void {
  app.modal = {
    type: 'input',
    title: '新建集合',
    label: '集合名称',
    initial: '新建集合',
    confirmText: '创建',
    onOk: (name) => cols.addCollection(name)
  }
}
</script>

<template>
  <div class="sidebar-top">
    <div class="sidebar-top-row">
      <span class="panel-title">集合</span>
      <button class="icon-btn" title="导入" @click="app.modal = { type: 'import' }">
        <Import :size="16" />
      </button>
      <button class="icon-btn" title="新建集合" @click="newCollection">
        <Plus :size="17" />
      </button>
    </div>
    <div class="search-box">
      <Search :size="13" />
      <input v-model="kw" placeholder="搜索请求或集合" spellcheck="false" />
    </div>
  </div>

  <div class="sidebar-scroll">
    <template v-if="visible.length">
      <TreeItem
        v-for="c in visible"
        :key="c.id"
        :node="c"
        :collection="c"
        :depth="0"
        :force-open="!!kw.trim()"
      />
    </template>
    <div v-else-if="cols.collections.length" class="empty-center" style="padding: 30px 10px">
      <Search :size="20" style="opacity: 0.4" />
      <span>没有匹配的结果</span>
    </div>
    <div v-else class="empty-center" style="padding: 40px 14px">
      <FolderOpen :size="26" style="opacity: 0.4" />
      <span class="big">还没有集合</span>
      <span style="text-align: center; line-height: 1.6">点击右上角 + 新建集合<br />或使用导入功能</span>
    </div>
  </div>
</template>
