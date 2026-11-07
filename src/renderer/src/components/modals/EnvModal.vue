<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { Check, Copy, Globe, Plus, Trash2, Upload } from 'lucide-vue-next'
import ModalShell from '../ModalShell.vue'
import KvTable from '../KvTable.vue'
import { useAppStore } from '../../stores/app'
import { useEnvsStore } from '../../stores/envs'
import type { EnvVariable } from '../../../../shared/types'

const app = useAppStore()
const envs = useEnvsStore()
const api = window.api

const modal = app.modal as { type: 'env'; envId: string | null }
const GLOBALS = '__globals__'

/** 当前编辑的目标：__globals__ 或环境 id */
const selectedId = ref<string>(GLOBALS)
const nameInput = ref<HTMLInputElement | null>(null)
const deleting = ref(false)

const isGlobals = computed(() => selectedId.value === GLOBALS)
const current = computed(() => envs.environments.find((e) => e.id === selectedId.value) ?? null)
/** 直接绑定 store：所有修改即时写入并自动持久化，无「保存/取消」负担 */
const rows = computed<EnvVariable[]>(() => (isGlobals.value ? envs.globals : current.value?.variables ?? []))

const countOf = (list: EnvVariable[]): number => list.filter((v) => v.enabled && v.key).length

function select(id: string): void {
  selectedId.value = id
  deleting.value = false
}

/** 新建环境：立即创建并选中，聚焦名称框全选，免「先起名」步骤 */
async function createEnv(): Promise<void> {
  let n = envs.environments.length + 1
  while (envs.environments.some((e) => e.name === `环境 ${n}`)) n++
  const id = crypto.randomUUID()
  envs.upsertEnv({ id, name: `环境 ${n}`, variables: [] })
  select(id)
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

function duplicate(): void {
  if (!current.value) return
  const copy = envs.duplicateEnv(current.value.id)
  if (copy) {
    select(copy.id)
    app.toast('环境已复制', 'success')
  }
}

function doDelete(): void {
  if (!current.value) return
  const id = current.value.id
  envs.deleteEnv(id)
  deleting.value = false
  select(envs.environments[0]?.id ?? GLOBALS)
  app.toast('环境已删除', 'success')
}

/** 从 {"key":"value"} JSON 文件导入到当前作用域 */
async function importJson(): Promise<void> {
  const p = await api.pickFile({ title: '选择环境变量 JSON 文件', filters: [{ name: 'JSON', extensions: ['json'] }] })
  if (!p) return
  try {
    const raw = JSON.parse(await api.readFile(p)) as Record<string, string>
    const imported: EnvVariable[] = Object.entries(raw).map(([key, value]) => ({
      id: crypto.randomUUID(),
      key,
      value: String(value),
      enabled: true,
      desc: ''
    }))
    if (!imported.length) {
      app.toast('文件中没有可导入的变量', 'info')
      return
    }
    if (isGlobals.value) envs.globals = imported
    else if (current.value) current.value.variables = imported
    app.toast(`已导入 ${imported.length} 个变量`, 'success')
  } catch {
    app.toast('文件解析失败，需要 {"key": "value"} 形式的 JSON', 'error')
  }
}

onMounted(() => {
  const initial = modal.envId
  if (initial === GLOBALS) {
    selectedId.value = GLOBALS
  } else if (initial === '__new__') {
    // 侧栏「+ 新建环境」入口：打开即创建并聚焦命名
    void createEnv()
  } else if (initial && envs.environments.some((e) => e.id === initial)) {
    selectedId.value = initial
  } else if (envs.environments.length) {
    selectedId.value = envs.environments[0].id
  } else {
    selectedId.value = GLOBALS
  }
})
</script>

<template>
  <ModalShell title="环境管理" :width="780" @close="app.modal = null">
    <div class="env-manager">
      <!-- 左栏：作用域列表 -->
      <aside class="em-left">
        <div class="em-left-scroll">
          <div class="em-group-label">作用域</div>
          <div class="em-item" :class="{ sel: isGlobals }" @click="select(GLOBALS)">
            <span class="em-icon"><Globe :size="14" /></span>
            <span class="em-name">全局变量</span>
            <span class="em-count">{{ countOf(envs.globals) }}</span>
          </div>

          <div class="em-group-label">环境<span class="em-group-hint">优先级高于全局</span></div>
          <div
            v-for="e in envs.environments"
            :key="e.id"
            class="em-item"
            :class="{ sel: e.id === selectedId }"
            @click="select(e.id)"
          >
            <span class="radio-dot" :class="{ checked: envs.activeEnvId === e.id }" title="设为当前使用的环境" @click.stop="envs.activeEnvId = e.id" />
            <span class="em-name" :title="e.name">{{ e.name }}</span>
            <span class="em-count">{{ countOf(e.variables) }}</span>
          </div>
          <div v-if="!envs.environments.length" class="em-empty">还没有环境</div>
        </div>
        <button class="em-add" @click="createEnv">
          <Plus :size="14" />
          新建环境
        </button>
      </aside>

      <!-- 右栏：编辑区（自动保存） -->
      <section class="em-right">
        <template v-if="isGlobals">
          <div class="em-head">
            <div class="em-title-row">
              <span class="em-title"><Globe :size="15" /> 全局变量</span>
            </div>
            <p class="em-scope-hint">所有环境共享；同名变量会被当前环境覆盖</p>
          </div>
          <div class="em-table">
            <KvTable :rows="envs.globals" key-ph="变量名" val-ph="变量值" desc-ph="备注" />
          </div>
          <div class="em-tools">
            <button class="btn btn-ghost btn-sm" @click="importJson">
              <Upload :size="13" />
              从 JSON 导入
            </button>
            <span class="em-save-hint">{{ countOf(envs.globals) }} 个变量 · 修改自动保存</span>
          </div>
        </template>

        <template v-else-if="current">
          <div class="em-head">
            <div class="em-title-row">
              <input
                ref="nameInput"
                v-model="current.name"
                class="input em-name-input"
                spellcheck="false"
                placeholder="环境名称"
              />
              <span v-if="envs.activeEnvId === current.id" class="em-active-chip">
                <Check :size="11" /> 使用中
              </span>
              <button v-else class="btn btn-outline btn-sm" @click="envs.activeEnvId = current.id">设为使用中</button>
            </div>
            <p class="em-scope-hint">该环境启用时，其中的变量优先于全局变量</p>
          </div>
          <div class="em-table">
            <KvTable :rows="current.variables" key-ph="变量名" val-ph="变量值" desc-ph="备注" />
          </div>
          <div class="em-tools">
            <button class="btn btn-ghost btn-sm" @click="importJson">
              <Upload :size="13" />
              从 JSON 导入
            </button>
            <button class="btn btn-ghost btn-sm" @click="duplicate">
              <Copy :size="13" />
              复制环境
            </button>
            <button class="btn btn-ghost btn-sm em-danger" @click="deleting = true">
              <Trash2 :size="13" />
              删除环境
            </button>
            <span class="em-save-hint">{{ countOf(current.variables) }} 个变量 · 修改自动保存</span>
          </div>
          <div v-if="deleting" class="em-delete-confirm">
            <span>确定删除环境「{{ current.name }}」吗？其中的变量会一并删除。</span>
            <button class="btn btn-danger btn-sm" @click="doDelete">删除</button>
            <button class="btn btn-ghost btn-sm" @click="deleting = false">取消</button>
          </div>
        </template>
      </section>
    </div>
  </ModalShell>
</template>

<style scoped>
.env-manager {
  display: flex;
  height: 480px;
  margin: -14px -16px;
  /* 占满 modal-body，左右两栏各自滚动 */
}

/* ---- 左栏 ---- */
.em-left {
  width: 208px;
  flex: none;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  background: var(--bg-panel);
  border-radius: 9px 0 0 9px;
  overflow: hidden;
}
.em-left-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px;
}
.em-group-label {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 8px 4px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-3);
  text-transform: uppercase;
}
.em-group-hint {
  font-weight: 400;
  letter-spacing: 0;
  text-transform: none;
  color: var(--text-3);
  opacity: 0.8;
}
.em-item {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 30px;
  padding: 0 8px;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-2);
  transition: background 0.12s var(--ease), color 0.12s var(--ease);
}
.em-item:hover {
  background: var(--bg-hover);
  color: var(--text);
}
.em-item.sel {
  background: var(--bg-active);
  color: var(--text);
}
.em-icon {
  display: flex;
  color: var(--text-3);
  flex: none;
}
.em-item.sel .em-icon {
  color: var(--text-2);
}
.em-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12.5px;
}
.em-item.sel .em-name {
  font-weight: 600;
}
.em-count {
  font-size: 10.5px;
  color: var(--text-3);
  background: var(--bg-active);
  border-radius: 8px;
  padding: 0 6px;
  line-height: 15px;
  flex: none;
}
.em-item.sel .em-count {
  background: var(--accent-soft);
  color: var(--accent);
}
.em-empty {
  padding: 14px 10px;
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}
.em-add {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  margin: 8px;
  border: 1px dashed var(--border-strong);
  border-radius: 7px;
  background: transparent;
  color: var(--text-2);
  font-size: 12.5px;
  cursor: pointer;
  transition: color 0.12s, border-color 0.12s, background 0.12s;
}
.em-add:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-soft);
}

/* ---- 右栏 ---- */
.em-right {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  padding: 14px 16px;
}
.em-head {
  flex: none;
}
.em-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.em-title {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 700;
}
.em-name-input {
  flex: 1;
  min-width: 0;
  max-width: 320px;
  height: 32px;
  font-size: 13.5px;
  font-weight: 600;
}
.em-active-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 10px;
  border-radius: 6px;
  background: var(--green-soft);
  color: var(--green);
  font-size: 12px;
  font-weight: 600;
  flex: none;
}
.em-scope-hint {
  margin: 6px 0 0;
  font-size: 11.5px;
  color: var(--text-3);
}
.em-table {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  margin-top: 12px;
  padding-right: 2px;
}
/* KvTable 自带 14px 内边距，归零后与上方名称输入框对齐 */
.em-table :deep(.kv-area) {
  padding: 0;
}
.em-tools {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 10px;
}
.em-tools .btn {
  color: var(--text-2);
}
.em-danger:hover {
  color: var(--danger) !important;
  background: var(--danger-soft) !important;
}
.em-save-hint {
  margin-left: auto;
  font-size: 11.5px;
  color: var(--text-3);
}
.em-delete-confirm {
  flex: none;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--danger);
  border-radius: 8px;
  background: var(--danger-soft);
  font-size: 12.5px;
  color: var(--text);
}
.em-delete-confirm span {
  flex: 1;
}
</style>
