<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { monaco, monacoTheme, SCRIPT_FONT } from '../lib/monacoSetup'
import { useAppStore } from '../stores/app'

const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const app = useAppStore()
const host = ref<HTMLElement | null>(null)
let editor: monaco.editor.IStandaloneCodeEditor | null = null

onMounted(() => {
  editor = monaco.editor.create(host.value!, {
    value: props.modelValue,
    language: 'javascript',
    theme: monacoTheme(app.settings.theme),
    automaticLayout: true,
    fontSize: 13,
    lineHeight: 21,
    fontFamily: SCRIPT_FONT,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    wordWrap: 'on',
    lineNumbersMinChars: 3,
    glyphMargin: false,
    renderLineHighlight: 'line',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    overviewRulerBorder: false,
    padding: { top: 8, bottom: 8 },
    tabSize: 2,
    smoothScrolling: true,
    cursorBlinking: 'smooth',
    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10, useShadows: false },
    suggest: { showWords: false }
  })

  editor.onDidChangeModelContent(() => {
    if (!editor) return
    const v = editor.getModel()!.getValue()
    if (v !== props.modelValue) emit('update:modelValue', v)
  })
  // 挂到宿主元素上，便于自动化测试与外部调用
  ;(host.value as HTMLElement & { __monaco?: monaco.editor.IStandaloneCodeEditor }).__monaco = editor
})

watch(
  () => props.modelValue,
  (v) => {
    const model = editor?.getModel()
    if (!model || v === model.getValue()) return
    editor!.executeEdits('v-model', [{ range: model.getFullModelRange(), text: v }])
  }
)

watch(
  () => app.settings.theme,
  () => {
    monaco.editor.setTheme(monacoTheme(app.settings.theme))
  }
)

onBeforeUnmount(() => {
  editor?.getModel()?.dispose()
  editor?.dispose()
  editor = null
})

/** 在光标处插入文本（供代码片段面板等外部调用），插入后聚焦 */
function insertAtCursor(text: string): void {
  if (!editor) return
  const model = editor.getModel()!
  const sel = editor.getSelection() ?? new monaco.Selection(1, 1, 1, 1)
  // 光标在非空行尾时先换行，保持脚本整洁
  const lineText = model.getLineContent(sel.endLineNumber)
  const atLineEnd = sel.endColumn === lineText.length + 1
  const prefix = model.getValueLength() === 0 ? '' : lineText.trim() && atLineEnd ? '\n' : ''
  const suffix = '\n'
  editor.executeEdits('insert', [{ range: sel, text: prefix + text + suffix, forceMoveMarkers: true }])
  editor.pushUndoStop()
  editor.focus()
}

defineExpose({ insertAtCursor })
</script>

<template>
  <div ref="host" class="monaco-host" />
</template>

<style scoped>
.monaco-host {
  flex: 1;
  min-height: 0;
  min-width: 0;
  overflow: hidden;
}
</style>
