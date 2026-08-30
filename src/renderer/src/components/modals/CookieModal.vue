<script setup lang="ts">
import { computed } from 'vue'
import { Cookie as CookieIcon, Trash2 } from 'lucide-vue-next'
import ModalShell from '../ModalShell.vue'
import { useAppStore } from '../../stores/app'

const app = useAppStore()

const groups = computed(() => {
  const map = new Map<string, typeof app.cookies>()
  for (const c of app.cookies) {
    if (!map.has(c.domain)) map.set(c.domain, [])
    map.get(c.domain)?.push(c)
  }
  return [...map.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([domain, items]) => ({ domain, items }))
})

function clearAll(): void {
  app.modal = {
    type: 'confirm',
    title: '清空 Cookie',
    message: `确定要清空全部 ${app.cookies.length} 条 Cookie 吗？`,
    confirmText: '清空',
    danger: true,
    onOk: () => app.clearCookies()
  }
}
</script>

<template>
  <ModalShell title="Cookie 管理" :width="580" @close="app.modal = null">
    <p class="tip">
      EasyAPI 会自动保存响应中的 Set-Cookie，并在后续请求时自动附带对应域名的 Cookie
      （若你手动添加了 Cookie 请求头则不覆盖）。过期 Cookie 会自动清理。
    </p>

    <template v-if="groups.length">
      <div v-for="g in groups" :key="g.domain" class="ck-group">
        <div class="ck-domain mono">
          {{ g.domain }}
          <span class="ck-count">{{ g.items.length }}</span>
        </div>
        <div v-for="c in g.items" :key="c.id" class="ck-row">
          <span class="mono ck-pair">{{ c.name }} = {{ c.value }}</span>
          <span v-if="c.expiresAt" class="ck-exp">{{ new Date(c.expiresAt).toLocaleString() }} 过期</span>
          <button class="icon-btn" title="删除" @click="app.removeCookie(c.id)">
            <Trash2 :size="13" />
          </button>
        </div>
      </div>
    </template>
    <div v-else class="empty-center" style="padding: 30px">
      <CookieIcon :size="26" style="opacity: 0.4" />
      <span style="text-align: center; line-height: 1.7">
        暂无 Cookie<br />发送返回 Set-Cookie 的请求后会自动保存到这里
      </span>
    </div>

    <template #footer>
      <button
        class="btn btn-ghost"
        style="color: var(--danger); margin-right: auto"
        :disabled="!app.cookies.length"
        @click="clearAll"
      >
        清空全部
      </button>
      <button class="btn btn-primary" @click="app.modal = null">完成</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.tip {
  margin: 0 0 14px;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-3);
}
.ck-group {
  margin-bottom: 14px;
}
.ck-domain {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  margin-bottom: 6px;
}
.ck-count {
  font-size: 10px;
  color: var(--text-3);
  background: var(--bg-active);
  border-radius: 8px;
  padding: 0 6px;
}
.ck-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}
.ck-pair {
  flex: 1;
  min-width: 0;
  word-break: break-all;
  color: var(--text);
}
.ck-exp {
  flex: none;
  font-size: 11px;
  color: var(--text-3);
}
</style>
