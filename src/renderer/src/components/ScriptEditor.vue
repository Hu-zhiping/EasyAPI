<script setup lang="ts">
import { computed, ref } from 'vue'
import { PanelRightClose, PanelRightOpen, Zap } from 'lucide-vue-next'
import MonacoScriptEditor from './MonacoScriptEditor.vue'
import { useTabsStore } from '../stores/tabs'
import { SNIPPETS_PRE } from '../lib/scriptSnippets'

const tabs = useTabsStore()

const code = computed({
  get: () => tabs.activeTab?.request.preScript ?? '',
  set: (v: string) => {
    if (tabs.activeTab) tabs.activeTab.request.preScript = v
  }
})

const editorRef = ref<InstanceType<typeof MonacoScriptEditor> | null>(null)
const snippetsOpen = ref(true)

function insertSnippet(snippetCode: string): void {
  editorRef.value?.insertAtCursor(snippetCode)
}
</script>

<template>
  <div v-if="tabs.activeTab" class="script-wrap">
    <div class="script-toolbar">
      <span class="script-badge">JS</span>
      <button class="icon-btn script-sn-toggle" :title="snippetsOpen ? '收起代码片段' : '展开代码片段'" @click="snippetsOpen = !snippetsOpen">
        <PanelRightClose v-if="snippetsOpen" :size="14" />
        <PanelRightOpen v-else :size="14" />
      </button>
    </div>
    <div class="script-body">
      <div class="script-editor">
        <MonacoScriptEditor ref="editorRef" v-model="code" />
      </div>
      <aside v-if="snippetsOpen" class="snippets">
        <div class="snippets-head">
          <Zap :size="11" />
          代码片段
        </div>
        <div class="snippets-scroll">
          <button v-for="s in SNIPPETS_PRE" :key="s.title" class="snippet-item" :title="s.code" @click="insertSnippet(s.code)">
            {{ s.title }}
          </button>
        </div>
      </aside>
    </div>
  </div>
</template>

<style scoped>
.script-sn-toggle {
  flex: none;
  margin-left: auto;
}
</style>
