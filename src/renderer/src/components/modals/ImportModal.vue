<script setup lang="ts">
import { computed, ref } from 'vue'
import { Upload } from 'lucide-vue-next'
import ModalShell from '../ModalShell.vue'
import { useAppStore } from '../../stores/app'
import { useCollectionsStore } from '../../stores/collections'
import { useEnvsStore } from '../../stores/envs'
import { importPostmanCollection } from '../../lib/postman'
import { parseCurl, curlToRequestDef } from '../../lib/curl'
import { countRequests } from '../../lib/tree'
import { expandedIds } from '../../stores/uiState'
import type { Collection, CollectionNode, Environment, EnvVariable } from '../../../../shared/types'

const app = useAppStore()
const cols = useCollectionsStore()
const envs = useEnvsStore()

const mode = ref<'file' | 'curl'>('file')
const filePath = ref('')
const curlText = ref('')
const parseError = ref('')
const preview = ref<Collection | null>(null)
const fileJson = ref<unknown>(null)
const envPreview = ref<Environment | null>(null)

async function pickFile(): Promise<void> {
  parseError.value = ''
  preview.value = null
  envPreview.value = null
  const api = window.api
  const p = await api.pickFile({
    title: '选择 Postman 集合文件',
    filters: [{ name: 'Postman 集合 / JSON', extensions: ['json'] }]
  })
  if (!p) return
  filePath.value = p
  try {
    const json = JSON.parse(await api.readFile(p))
    fileJson.value = json
    if (json?.info?.name !== undefined || Array.isArray(json?.item)) {
      preview.value = importPostmanCollection(json)
      // 集合级变量自动转为环境，避免变量丢失
      const vars = Array.isArray(json?.variable) ? json.variable : []
      const rows: EnvVariable[] = vars
        .filter((v: { key?: unknown }) => v && typeof v.key === 'string' && v.key)
        .map((v: { key: unknown; value?: unknown }) => ({
          id: crypto.randomUUID(),
          key: String(v.key),
          value: String(v.value ?? ''),
          enabled: true,
          desc: ''
        }))
      if (rows.length) {
        envPreview.value = {
          id: crypto.randomUUID(),
          name: `${preview.value.name} 变量`,
          variables: rows
        }
      }
    } else {
      parseError.value = '文件格式不符合 Postman Collection v2.x 规范'
    }
  } catch (e) {
    parseError.value = '解析失败：' + (e instanceof Error ? e.message : String(e))
  }
}

function parseCurlInput(): void {
  parseError.value = ''
  preview.value = null
  const text = curlText.value.trim()
  if (!text) return
  try {
    const c = parseCurl(text)
    if (!c.url) {
      parseError.value = '未找到请求 URL'
      return
    }
    const { name, def } = curlToRequestDef(c)
    preview.value = {
      id: crypto.randomUUID(),
      type: 'collection',
      name: 'cURL 导入',
      children: [
        {
          ...JSON.parse(JSON.stringify(def)),
          id: crypto.randomUUID(),
          type: 'request',
          name,
          createdAt: Date.now(),
          updatedAt: Date.now()
        } as CollectionNode
      ],
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  } catch (e) {
    parseError.value = '解析失败：' + (e instanceof Error ? e.message : String(e))
  }
}

const summary = computed(() => {
  if (!preview.value) return ''
  const reqs = countRequests(preview.value)
  const folders = countFolders(preview.value)
  const parts = [`${reqs} 个请求`]
  if (folders) parts.push(`${folders} 个文件夹`)
  if (envPreview.value) parts.push(`${envPreview.value.variables.length} 个集合变量（将创建环境「${envPreview.value.name}」）`)
  return `「${preview.value.name}」，包含 ${parts.join(' 和 ')}`
})

function countFolders(c: Collection): number {
  let n = 0
  const walk = (nodes: CollectionNode[]): void => {
    for (const x of nodes) {
      if (x.type === 'folder') {
        n++
        walk(x.children)
      }
    }
  }
  walk(c.children)
  return n
}

function doImport(): void {
  if (!preview.value) return
  cols.importCollections([preview.value])
  if (envPreview.value) {
    envs.upsertEnv(envPreview.value)
    envs.activeEnvId = envPreview.value.id
  }
  expandedIds.add(preview.value.id)
  app.sidebarNav = 'collections'
  app.toast(envPreview.value ? '导入成功，并已创建对应环境' : '导入成功', 'success')
  app.modal = null
}
</script>

<template>
  <ModalShell title="导入" :width="560" @close="app.modal = null">
    <div class="body-mode-seg" style="margin-bottom: 14px; width: fit-content">
      <button :class="{ active: mode === 'file' }" @click="mode = 'file'">Postman 集合文件</button>
      <button :class="{ active: mode === 'curl' }" @click="mode = 'curl'">cURL 命令</button>
    </div>

    <div v-if="mode === 'file'">
      <button class="upload-btn" @click="pickFile">
        <Upload :size="18" />
        <span v-if="!filePath">点击选择 .json 集合文件<br /><small>支持 Postman Collection v2.x 导出格式</small></span>
        <span v-else class="mono" style="font-size: 12px">{{ filePath }}</span>
      </button>
    </div>

    <div v-else>
      <textarea
        v-model="curlText"
        class="kv-bulk"
        style="min-height: 140px"
        placeholder="粘贴完整的 cURL 命令，例如：&#10;curl -X POST 'https://api.example.com/users' -H 'Content-Type: application/json' -d '{&quot;name&quot;:&quot;test&quot;}'"
        @input="parseCurlInput"
      />
    </div>

    <p v-if="parseError" class="parse-err">{{ parseError }}</p>
    <p v-else-if="preview" class="parse-ok">识别成功：{{ summary }}</p>

    <template #footer>
      <button class="btn btn-ghost" @click="app.modal = null">取消</button>
      <button class="btn btn-primary" :disabled="!preview" @click="doImport">导入</button>
    </template>
  </ModalShell>
</template>

<style scoped>
.upload-btn {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 26px 16px;
  border: 1.5px dashed var(--border-strong);
  border-radius: 10px;
  background: var(--bg);
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
}
.upload-btn:hover {
  border-color: var(--accent);
  color: var(--text);
}
.upload-btn small {
  color: var(--text-3);
  font-size: 11px;
}
.parse-err {
  margin: 12px 0 0;
  color: var(--danger);
  font-size: 12px;
}
.parse-ok {
  margin: 12px 0 0;
  color: var(--green);
  font-size: 12px;
}
</style>
