<script setup lang="ts">
import { computed, ref } from 'vue'
import { CheckCircle2, PanelRightClose, PanelRightOpen, XCircle, Zap } from 'lucide-vue-next'
import MonacoScriptEditor from './MonacoScriptEditor.vue'
import { useTabsStore } from '../stores/tabs'
import { SNIPPETS_TEST } from '../lib/scriptSnippets'

const tabs = useTabsStore()

const code = computed({
  get: () => tabs.activeTab?.request.tests ?? '',
  set: (v: string) => {
    if (tabs.activeTab) tabs.activeTab.request.tests = v
  }
})

const results = computed(() => tabs.activeTab?.testResults ?? null)
const passedCount = computed(() => results.value?.filter((r) => r.passed).length ?? 0)

const editorRef = ref<InstanceType<typeof MonacoScriptEditor> | null>(null)
const snippetsOpen = ref(true)

function insertSnippet(snippetCode: string): void {
  editorRef.value?.insertAtCursor(snippetCode)
}
</script>

<template>
  <div v-if="tabs.activeTab" class="tests-wrap">
    <div class="script-toolbar">
      <span class="script-badge">JS</span>
      <button class="icon-btn script-sn-toggle" :title="snippetsOpen ? '收起代码片段' : '展开代码片段'" @click="snippetsOpen = !snippetsOpen">
        <PanelRightClose v-if="snippetsOpen" :size="14" />
        <PanelRightOpen v-else :size="14" />
      </button>
    </div>
    <div class="script-body">
      <div class="tests-editor">
        <MonacoScriptEditor
          ref="editorRef"
          v-model="code"
        />
      </div>
      <aside v-if="snippetsOpen" class="snippets">
        <div class="snippets-head">
          <Zap :size="11" />
          代码片段
        </div>
        <div class="snippets-scroll">
          <button v-for="s in SNIPPETS_TEST" :key="s.title" class="snippet-item" :title="s.code" @click="insertSnippet(s.code)">
            {{ s.title }}
          </button>
        </div>
      </aside>
    </div>
    <div v-if="results?.length" class="test-results selectable">
      <div class="tr-summary" :class="passedCount === results.length ? 'ok' : 'fail'">
        {{ passedCount }} / {{ results.length }} 项通过
      </div>
      <div v-for="(r, i) in results" :key="i" class="tr-row">
        <CheckCircle2 v-if="r.passed" :size="14" class="tr-icon ok" />
        <XCircle v-else :size="14" class="tr-icon fail" />
        <span class="tr-name">{{ r.name }}</span>
        <span v-if="r.error" class="tr-error mono">{{ r.error }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.script-sn-toggle {
  flex: none;
  margin-left: auto;
}
</style>
