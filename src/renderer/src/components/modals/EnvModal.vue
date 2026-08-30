<script setup lang="ts">
import { ref } from 'vue'
import ModalShell from '../ModalShell.vue'
import KvTable from '../KvTable.vue'
import { useAppStore } from '../../stores/app'
import { useEnvsStore } from '../../stores/envs'
import type { EnvVariable, Environment } from '../../../../shared/types'

const app = useAppStore()
const envs = useEnvsStore()
const api = window.api

const modal = app.modal as { type: 'env'; envId: string | null }
const isGlobals = modal.envId === '__globals__'

const existing = !isGlobals && modal.envId ? envs.environments.find((e) => e.id === modal.envId) : null

const name = ref(existing?.name ?? '新环境')
const vars = ref<EnvVariable[]>(
  existing
    ? JSON.parse(JSON.stringify(existing.variables))
    : isGlobals
      ? JSON.parse(JSON.stringify(envs.globals))
      : [{ id: crypto.randomUUID(), key: '', value: '', enabled: true, desc: '' }]
)

if (!vars.value.length) vars.value.push({ id: crypto.randomUUID(), key: '', value: '', enabled: true, desc: '' })

function save(): void {
  const clean = vars.value.filter((v) => v.enabled && v.key)
  if (isGlobals) {
    envs.globals = clean
    app.toast('全局变量已更新', 'success')
  } else {
    const env: Environment = {
      id: existing?.id ?? crypto.randomUUID(),
      name: name.value.trim() || '未命名环境',
      variables: clean
    }
    envs.upsertEnv(env)
    if (!existing) envs.activeEnvId = env.id
    app.toast('环境已保存', 'success')
  }
  app.modal = null
}

async function importFromEnvFile(): Promise<void> {
  const p = await api.pickFile({ title: '选择环境变量 JSON 文件', filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!p) return
  try {
    const raw = JSON.parse(await api.readFile(p)) as Record<string, string>
    const rows: EnvVariable[] = Object.entries(raw).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value: String(value),
      enabled: true,
      desc: ''
    }))
    if (rows.length) vars.value = rows
    app.toast(`已从文件读取 ${rows.length} 个变量`, 'success')
  } catch {
    app.toast('文件解析失败，需要 {"key": "value"} 形式的 JSON', 'error')
  }
}
</script>

<template>
  <ModalShell :title="isGlobals ? '全局变量' : existing ? '编辑环境' : '新建环境'" :width="620" @close="app.modal = null">
    <div v-if="!isGlobals" class="form-row">
      <label>环境名称</label>
      <input v-model="name" class="input" spellcheck="false" @keydown.enter="save" />
    </div>

    <div style="display: flex; align-items: center; gap: 8px; margin: 0 0 6px 98px">
      <span style="font-size: 11.5px; color: var(--text-3)">
        勾选的变量才会生效；高优先级：环境变量 &gt; 全局变量
      </span>
      <span style="flex: 1" />
      <button class="link-btn" @click="importFromEnvFile">从 JSON 文件导入</button>
    </div>

    <div style="padding: 0 98px 0 0; margin-left: 0">
      <KvTable :rows="vars" key-ph="变量名" val-ph="变量值" desc-ph="备注" />
    </div>

    <template #footer>
      <button class="btn btn-ghost" @click="app.modal = null">取消</button>
      <button class="btn btn-primary" @click="save">保存</button>
    </template>
  </ModalShell>
</template>
