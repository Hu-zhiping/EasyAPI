<script setup lang="ts">
import { computed } from 'vue'
import { CheckCircle2, XCircle } from 'lucide-vue-next'
import CodeEditor from './CodeEditor.vue'
import { useTabsStore } from '../stores/tabs'

const tabs = useTabsStore()

const code = computed({
  get: () => tabs.activeTab?.request.tests ?? '',
  set: (v: string) => {
    if (tabs.activeTab) tabs.activeTab.request.tests = v
  }
})

const results = computed(() => tabs.activeTab?.testResults ?? null)
const passedCount = computed(() => results.value?.filter((r) => r.passed).length ?? 0)
</script>

<template>
  <div v-if="tabs.activeTab" class="tests-wrap">
    <div class="script-toolbar">
      <span class="script-badge">JS</span>
      <span class="script-hint">
        响应返回后执行。用
        <code>pm.test('名称', () => { ... })</code>
        注册断言；
        <code>pm.response.code / json() / headers.get()</code>
        读取响应，
        <code>pm.expect(x).to.eql(y)</code>
        校验值。失败项会标红展示。
      </span>
    </div>
    <div class="tests-editor">
      <CodeEditor
        v-model="code"
        language="javascript"
        placeholder="// 例如：&#10;pm.test('状态码为 200', () => {&#10;  pm.response.to.have.status(200)&#10;})&#10;pm.test('返回了用户名', () => {&#10;  const data = pm.response.json()&#10;  pm.expect(data.name).to.eql('EasyAPI')&#10;})"
      />
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
