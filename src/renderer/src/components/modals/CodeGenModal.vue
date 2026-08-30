<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy } from 'lucide-vue-next'
import ModalShell from '../ModalShell.vue'
import CodeEditor from '../CodeEditor.vue'
import PopSelect from '../PopSelect.vue'
import { useAppStore } from '../../stores/app'
import { useTabsStore } from '../../stores/tabs'
import { useEnvsStore } from '../../stores/envs'
import { CODE_TARGETS, generateCode, type CodeTarget } from '../../lib/codegen'
import type { RequestDef } from '../../../../shared/types'

const app = useAppStore()
const tabs = useTabsStore()
const envs = useEnvsStore()

const modal = app.modal as { type: 'codegen'; tabId?: string; request?: RequestDef }
const tab = modal.tabId ? tabs.tabs.find((t) => t.id === modal.tabId) : null
const reqDef = modal.request ?? tab?.request

const target = ref<CodeTarget>('curl')

const code = computed(() => {
  if (!reqDef) return ''
  return generateCode(target.value, reqDef, {
    env: envs.activeEnv?.variables ?? [],
    globals: envs.globals
  })
})

const lang = computed(() => (target.value === 'fetch' || target.value === 'axios' ? 'javascript' : 'text'))

async function copy(): Promise<void> {
  await navigator.clipboard.writeText(code.value)
  app.toast('代码已复制到剪贴板', 'success')
}
</script>

<template>
  <ModalShell title="生成代码" :width="640" @close="app.modal = null">
    <div class="form-row">
      <label>目标语言</label>
      <PopSelect v-model="target" :options="CODE_TARGETS.map((t) => ({ value: t.value, label: t.label }))" />
      <span style="flex: 1" />
      <button class="btn btn-outline btn-sm" @click="copy">
        <Copy :size="13" />
        复制
      </button>
    </div>
    <div class="code-host" style="height: 320px; border: 1px solid var(--border); border-radius: 8px; overflow: hidden">
      <CodeEditor :model-value="code" :language="lang" readonly />
    </div>
    <p style="margin: 10px 0 0; font-size: 11.5px; color: var(--text-3)">
      代码基于当前请求生成，变量已按当前环境解析为实际值。
    </p>
  </ModalShell>
</template>
