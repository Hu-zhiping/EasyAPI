<script setup lang="ts">
import { computed } from 'vue'
import CodeEditor from './CodeEditor.vue'
import { useTabsStore } from '../stores/tabs'

const tabs = useTabsStore()

const code = computed({
  get: () => tabs.activeTab?.request.preScript ?? '',
  set: (v: string) => {
    if (tabs.activeTab) tabs.activeTab.request.preScript = v
  }
})
</script>

<template>
  <div v-if="tabs.activeTab" class="script-wrap">
    <div class="script-toolbar">
      <span class="script-badge">JS</span>
      <span class="script-hint">
        发送前执行，支持 await。通过
        <code>pm.environment</code> / <code>pm.globals</code> / <code>pm.variables</code>
        存取变量，通过 <code>pm.request</code> 修改方法、URL 与请求头；<code>console.log</code>
        输出见网络控制台。脚本出错时请求不会发送。
      </span>
    </div>
    <div class="script-editor">
      <CodeEditor
        v-model="code"
        language="javascript"
        placeholder="// 例如：&#10;// pm.environment.set('token', 'xxx')&#10;// pm.request.headers.add({ key: 'X-Sign', value: 'abc123' })&#10;// pm.variables.set('ts', Date.now())"
      />
    </div>
  </div>
</template>

<style scoped>
.script-wrap {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.script-editor {
  flex: 1;
  min-height: 0;
  margin: 4px 14px 12px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
</style>
