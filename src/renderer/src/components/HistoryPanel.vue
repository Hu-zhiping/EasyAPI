<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search, Trash2, Clock } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'
import { useHistoryStore } from '../stores/history'
import { useTabsStore } from '../stores/tabs'
import { dateGroup, formatDuration, formatTime, methodClass, statusClass, shortUrl } from '../lib/format'

const app = useAppStore()
const history = useHistoryStore()
const tabs = useTabsStore()
const kw = ref('')

const groups = computed(() => {
  const k = kw.value.trim().toLowerCase()
  const list = k
    ? history.entries.filter((e) => e.url.toLowerCase().includes(k) || e.method.toLowerCase().includes(k))
    : history.entries
  const out: Array<{ label: string; items: typeof list }> = []
  let lastLabel = ''
  for (const e of list) {
    const label = dateGroup(e.at)
    if (label !== lastLabel) {
      out.push({ label, items: [] })
      lastLabel = label
    }
    out[out.length - 1].items.push(e)
  }
  return out
})

function replayEntry(id: string): void {
  const entry = history.entries.find((e) => e.id === id)
  if (!entry) return
  tabs.newTab(JSON.parse(JSON.stringify(entry.request)), shortUrl(entry.url))
}

function rowMenu(e: MouseEvent, id: string, url: string): void {
  e.preventDefault()
  app.openContextMenu(e.clientX, e.clientY, [
    { label: '打开为新标签页', icon: 'open', action: () => replayEntry(id) },
    {
      label: '复制 URL',
      icon: 'copy',
      action: () => {
        void navigator.clipboard.writeText(url)
        app.toast('已复制 URL', 'success')
      }
    },
    { label: '__sep' },
    { label: '删除该记录', icon: 'trash', danger: true, action: () => history.remove(id) }
  ])
}

function clearAll(): void {
  if (!history.entries.length) return
  app.modal = {
    type: 'confirm',
    title: '清空历史记录',
    message: `确定要清空全部 ${history.entries.length} 条历史记录吗？`,
    confirmText: '清空',
    danger: true,
    onOk: () => history.clear()
  }
}
</script>

<template>
  <div class="sidebar-top">
    <div class="sidebar-top-row">
      <span class="panel-title">历史记录</span>
      <button class="icon-btn" title="清空历史" aria-label="清空历史" @click="clearAll">
        <Trash2 :size="15" />
      </button>
    </div>
    <div class="search-box">
      <Search :size="13" />
      <input v-model="kw" aria-label="搜索历史请求" placeholder="搜索历史请求" spellcheck="false" />
    </div>
  </div>

  <div class="sidebar-scroll">
    <template v-if="groups.length">
      <div v-for="g in groups" :key="g.label">
        <div class="hist-group">{{ g.label }}</div>
        <div
          v-for="e in g.items"
          :key="e.id"
          class="hist-row"
          :title="`${e.method} ${e.url}\n${e.status || '请求失败'} · ${formatDuration(e.durationMs)} · ${formatTime(e.at)}`"
          role="button"
          tabindex="0"
          :aria-label="`重新发送 ${e.method} ${e.url}`"
          @click="replayEntry(e.id)"
          @keydown.enter.prevent="replayEntry(e.id)"
          @keydown.space.prevent="replayEntry(e.id)"
          @contextmenu="rowMenu($event, e.id, e.url)"
        >
          <span class="chip method-chip" :class="methodClass(e.method)">
            {{ e.method }}
          </span>
          <span class="hist-main">
            <span class="hist-line">
              <span class="hist-meta">
                <span class="dot" :class="e.ok ? 'ok' : e.status ? 'warn' : 'err'" />
                <span class="hist-status" :class="statusClass(e.status)">{{ e.status || '失败' }}</span>
                <span class="hist-duration">{{ formatDuration(e.durationMs) }}</span>
              </span>
              <time class="hist-time" :datetime="e.at">{{ formatTime(e.at) }}</time>
            </span>
            <span class="hist-url">{{ shortUrl(e.url) }}</span>
          </span>
          <button
            class="icon-btn tree-kebab hist-delete"
            title="删除该记录"
            aria-label="删除该记录"
            @click.stop="history.remove(e.id)"
          >
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </template>
    <div v-else-if="history.entries.length" class="empty-center" style="padding: 30px 10px">
      <Search :size="20" style="opacity: 0.4" />
      <span>没有匹配的记录</span>
    </div>
    <div v-else class="empty-center" style="padding: 40px 14px">
      <Clock :size="26" style="opacity: 0.4" />
      <span class="big">暂无历史记录</span>
      <span>发送的请求会自动记录在这里</span>
    </div>
  </div>
</template>
