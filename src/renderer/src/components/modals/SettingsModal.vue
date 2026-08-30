<script setup lang="ts">
import { ref } from 'vue'
import ModalShell from '../ModalShell.vue'
import PopSelect from '../PopSelect.vue'
import { useAppStore } from '../../stores/app'
import { useEnvsStore } from '../../stores/envs'
import { useCollectionsStore } from '../../stores/collections'
import { useHistoryStore } from '../../stores/history'

const app = useAppStore()
const envs = useEnvsStore()
const cols = useCollectionsStore()
const history = useHistoryStore()
const api = window.api

const themeOptions = [
  { value: 'dark', label: '深色' },
  { value: 'light', label: '浅色' }
]

const resetting = ref(false)

async function exportData(): Promise<void> {
  const path = await api.pickSavePath({
    title: '导出全部数据',
    defaultName: 'easyapi-backup.json',
    filters: [{ name: 'JSON', extensions: ['json'] }]
  })
  if (!path) return
  const data = {
    exportedAt: new Date().toISOString(),
    collections: JSON.parse(JSON.stringify(cols.collections)),
    environments: JSON.parse(JSON.stringify(envs.environments)),
    globals: JSON.parse(JSON.stringify(envs.globals)),
    activeEnvId: envs.activeEnvId,
    settings: app.settings
  }
  await api.writeFile({ path, content: JSON.stringify(data, null, 2) })
  app.toast('数据已导出', 'success')
}

function doReset(): void {
  cols.collections.splice(0, cols.collections.length)
  envs.environments.splice(0, envs.environments.length)
  envs.globals.splice(0, envs.globals.length)
  envs.activeEnvId = null
  history.clear()
  resetting.value = false
  app.toast('已恢复出厂设置', 'success')
}
</script>

<template>
  <ModalShell title="设置" :width="520" @close="app.modal = null">
    <h3 class="sec">外观</h3>
    <div class="form-row">
      <label>界面主题</label>
      <PopSelect
        :model-value="app.settings.theme"
        :options="themeOptions"
        @select="(v: string) => app.updateSettings({ theme: v as 'dark' | 'light' })"
      />
    </div>

    <h3 class="sec">请求</h3>
    <div class="form-row">
      <label>请求超时</label>
      <input
        class="input"
        style="max-width: 120px"
        type="number"
        :value="app.settings.timeoutMs"
        min="0"
        step="1000"
        @change="app.updateSettings({ timeoutMs: Number(($event.target as HTMLInputElement).value) || 0 })"
      />
      <span class="unit">毫秒，0 表示不限制</span>
    </div>
    <div class="form-row">
      <label>重定向</label>
      <span
        class="switch"
        :class="{ on: app.settings.followRedirects }"
        @click="app.updateSettings({ followRedirects: !app.settings.followRedirects })"
      />
      <span class="unit">自动跟随 3xx 重定向</span>
    </div>
    <div class="form-row">
      <label>SSL 验证</label>
      <span
        class="switch"
        :class="{ on: app.settings.sslVerify }"
        @click="app.updateSettings({ sslVerify: !app.settings.sslVerify })"
      />
      <span class="unit">验证 HTTPS 证书（自签名证书可关闭）</span>
    </div>

    <h3 class="sec">历史记录</h3>
    <div class="form-row">
      <label>记录历史</label>
      <span
        class="switch"
        :class="{ on: app.settings.saveHistory }"
        @click="app.updateSettings({ saveHistory: !app.settings.saveHistory })"
      />
      <span class="unit">发送请求时自动保存到历史</span>
    </div>
    <div class="form-row">
      <label>历史上限</label>
      <input
        class="input"
        style="max-width: 120px"
        type="number"
        :value="app.settings.historyLimit"
        min="10"
        step="10"
        @change="app.updateSettings({ historyLimit: Math.max(10, Number(($event.target as HTMLInputElement).value) || 100) })"
      />
      <span class="unit">条</span>
    </div>

    <h3 class="sec">数据</h3>
    <div class="data-row">
      <button class="btn btn-outline btn-sm" @click="exportData">导出全部数据…</button>
      <button class="btn btn-ghost btn-sm" style="color: var(--danger)" @click="resetting = true">
        恢复出厂设置…
      </button>
    </div>
    <p class="note">所有数据保存在本机（应用数据目录），不会上传到任何服务器。</p>

    <div v-if="resetting" class="reset-confirm">
      <p style="font-weight: 600; color: var(--danger); margin: 0 0 6px">确定要清除全部本地数据吗？</p>
      <p style="font-size: 12px; color: var(--text-2); margin: 0 0 12px">
        将删除所有集合、环境变量与历史记录，应用会恢复到初始状态。此操作不可撤销。
      </p>
      <div style="display: flex; gap: 8px">
        <button class="btn btn-danger btn-sm" @click="doReset">确认清除</button>
        <button class="btn btn-ghost btn-sm" @click="resetting = false">取消</button>
      </div>
    </div>

    <template #footer>
      <button class="btn btn-primary" @click="app.modal = null">完成</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.sec {
  margin: 4px 0 12px;
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
}
.sec:not(:first-child) {
  margin-top: 20px;
}
.unit {
  font-size: 11.5px;
  color: var(--text-3);
}
.data-row {
  display: flex;
  gap: 8px;
  padding-left: 98px;
}
.note {
  margin: 10px 0 0 98px;
  font-size: 11.5px;
  color: var(--text-3);
}
.reset-confirm {
  margin: 12px 0 0 98px;
  padding: 12px 14px;
  border: 1px solid var(--danger);
  border-radius: 8px;
  background: var(--danger-soft);
}
</style>
