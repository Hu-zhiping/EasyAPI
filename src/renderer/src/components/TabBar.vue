<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { Plus, X, ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { useTabsStore } from '../stores/tabs'
import { useAppStore } from '../stores/app'
import { useCollectionsStore } from '../stores/collections'
import { methodClass } from '../lib/format'

const tabs = useTabsStore()
const app = useAppStore()
const cols = useCollectionsStore()
const tabsEl = ref<HTMLElement | null>(null)

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

/**
 * 仅在输入框首次挂载时聚焦全选。
 * Vue 3 的函数式 :ref 每次组件更新都会被重新调用，若不区分会在每次输入后
 * 再次 select() 全选文字，导致输入法刚上屏的词被下一次输入覆盖。
 */
let renameFocusedEl: HTMLInputElement | null = null
function focusInput(el: unknown): void {
  const input = el as HTMLInputElement | null
  if (input && input !== renameFocusedEl) {
    renameFocusedEl = input
    input.focus()
    input.select()
  } else if (!input) {
    renameFocusedEl = null
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

/** 激活标签变化（新建 / 切换 / 关闭后补位）时，把它滚动进可视区，避免新标签藏在溢出区 */
async function revealActiveTab(): Promise<void> {
  await nextTick()
  updateOverflow()
  tabsEl.value
    ?.querySelector('.tab.active')
    ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
}

watch(() => [tabs.activeId, tabs.tabs.length] as const, revealActiveTab, { flush: 'post' })

/* ---- 溢出时的左右滚动箭头与滚轮横向滚动 ---- */
const tabOverflow = ref(false)
const canPrev = ref(false)
const canNext = ref(false)
let resizeObs: ResizeObserver | null = null

function updateOverflow(): void {
  const el = tabsEl.value
  if (!el) {
    tabOverflow.value = false
    return
  }
  tabOverflow.value = el.scrollWidth > el.clientWidth + 1
  canPrev.value = el.scrollLeft > 1
  canNext.value = tabOverflow.value && el.scrollLeft < el.scrollWidth - el.clientWidth - 1
}

function scrollTabs(dir: -1 | 1): void {
  tabsEl.value?.scrollBy({ left: dir * 220, behavior: 'smooth' })
}

/** 纵向滚轮转为标签栏横向滚动（仅溢出时接管） */
function onTabsWheel(e: WheelEvent): void {
  const el = tabsEl.value
  if (!el || el.scrollWidth <= el.clientWidth) return
  e.preventDefault()
  el.scrollLeft += e.deltaY + e.deltaX
}

onMounted(() => {
  updateOverflow()
  resizeObs = new ResizeObserver(updateOverflow)
  if (tabsEl.value) resizeObs.observe(tabsEl.value)
})

onBeforeUnmount(() => resizeObs?.disconnect())

/** 输入法组合中（选词的 Enter）不触发提交 */
function renameEnter(e: KeyboardEvent): void {
  if (e.isComposing || e.keyCode === 229) return
  e.preventDefault()
  commitRename()
}
</script>

<template>
  <div class="tabbar">
    <template v-if="tabOverflow">
      <span class="tab-fade prev" />
      <button class="tab-scroll prev" :disabled="!canPrev" title="向左滚动标签页" aria-label="向左滚动标签页" @click="scrollTabs(-1)">
        <ChevronLeft :size="14" />
      </button>
    </template>
    <div
      ref="tabsEl"
      class="tabbar-tabs"
      role="tablist"
      aria-label="请求标签页"
      @scroll.passive="updateOverflow"
      @wheel="onTabsWheel"
    >
      <div
        v-for="t in tabs.tabs"
        :key="t.id"
        class="tab"
        :class="{ active: t.id === tabs.activeId }"
        role="tab"
        :aria-selected="t.id === tabs.activeId"
        :tabindex="t.id === tabs.activeId ? 0 : -1"
        @click="tabs.activeId = t.id"
        @keydown.enter.prevent="tabs.activeId = t.id"
        @keydown.space.prevent="tabs.activeId = t.id"
        @auxclick.middle.prevent="tabs.closeTab(t.id)"
        @contextmenu="onTabContext($event, t.id)"
      >
        <span class="tab-method" :class="methodClass(t.request.method)">{{ t.request.method }}</span>
        <input
          v-if="editingId === t.id"
          v-model="editingName"
          class="tab-edit"
          spellcheck="false"
          :ref="focusInput"
          @click.stop
          @dblclick.stop
          @keydown.enter="renameEnter"
          @keydown.esc.prevent="editingId = null"
          @blur="commitRename"
        />
        <span v-else class="tab-title" title="双击重命名" @dblclick.stop="startRename(t.id)">{{ t.title }}</span>
        <span
          v-if="tabs.isDirty(t) && editingId !== t.id"
          class="tab-dirty-dot"
          title="有未保存的修改"
        />
        <button
          class="tab-close"
          :title="tabs.isDirty(t) ? '关闭未保存的标签页' : '关闭 (Ctrl+W)'"
          :aria-label="`关闭 ${t.title}`"
          @click.stop="tabs.closeTab(t.id)"
        >
          <X :size="13" />
        </button>
      </div>
    </div>
    <template v-if="tabOverflow">
      <span class="tab-fade next" />
      <button class="tab-scroll next" :disabled="!canNext" title="向右滚动标签页" aria-label="向右滚动标签页" @click="scrollTabs(1)">
        <ChevronRight :size="14" />
      </button>
    </template>
    <button class="icon-btn tab-add" title="新建标签页 (Ctrl+T)" aria-label="新建标签页" @click="tabs.newTab()">
      <Plus :size="16" />
    </button>
  </div>
</template>

<style scoped>
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
/* 重命名时输入框没有固有宽度，标签会塌缩到 min-width；给编辑态一个固定基准 */
.tab:has(.tab-edit) {
  flex-basis: 168px;
}
</style>
