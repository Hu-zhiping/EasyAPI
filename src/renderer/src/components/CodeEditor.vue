<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import { EditorView, placeholder as cmPlaceholder } from '@codemirror/view'
import { oneDark } from '@codemirror/theme-one-dark'
import { json } from '@codemirror/lang-json'
import { javascript, javascriptLanguage } from '@codemirror/lang-javascript'
import { html } from '@codemirror/lang-html'
import { xml } from '@codemirror/lang-xml'
import { pmCompletionSource } from '../lib/pmCompletions'
import { useAppStore } from '../stores/app'

export type CodeLang = 'json' | 'javascript' | 'html' | 'xml' | 'text'

const props = withDefaults(
  defineProps<{
    modelValue: string
    language?: CodeLang
    readonly?: boolean
    placeholder?: string
  }>(),
  { language: 'text', readonly: false }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

const app = useAppStore()
const host = ref<HTMLElement | null>(null)
let view: EditorView | null = null

const langComp = new Compartment()
const roComp = new Compartment()
const themeComp = new Compartment()

function langExt(l?: string): Extension {
  switch (l) {
    case 'json':
      return json()
    case 'javascript':
      // 附带 pm.* 上下文补全源（随 basicSetup 的自动补全生效）
      return [javascript(), javascriptLanguage.data.of({ autocomplete: pmCompletionSource })]
    case 'html':
      return html()
    case 'xml':
      return xml()
    default:
      return []
  }
}

function roExt(ro: boolean): Extension[] {
  return [EditorState.readOnly.of(ro), EditorView.editable.of(!ro)]
}

function themeExt(): Extension {
  return app.settings.theme === 'dark' ? oneDark : []
}

onMounted(() => {
  const updateListener = EditorView.updateListener.of((u) => {
    if (u.docChanged && !props.readonly) emit('update:modelValue', u.state.doc.toString())
  })
  const extensions: Extension[] = [
    basicSetup,
    langComp.of(langExt(props.language)),
    roComp.of(roExt(props.readonly)),
    themeComp.of(themeExt()),
    EditorView.lineWrapping,
    updateListener
  ]
  if (props.placeholder) extensions.push(cmPlaceholder(props.placeholder))
  view = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions }),
    parent: host.value ?? undefined
  })
})

watch(
  () => props.modelValue,
  (v) => {
    if (!view) return
    const cur = view.state.doc.toString()
    if (v !== cur) view.dispatch({ changes: { from: 0, to: cur.length, insert: v } })
  }
)

watch(
  () => props.language,
  (l) => {
    view?.dispatch({ effects: langComp.reconfigure(langExt(l)) })
  }
)

watch(
  () => props.readonly,
  (ro) => {
    view?.dispatch({ effects: roComp.reconfigure(roExt(ro)) })
  }
)

watch(
  () => app.settings.theme,
  () => {
    view?.dispatch({ effects: themeComp.reconfigure(themeExt()) })
  }
)

onBeforeUnmount(() => {
  view?.destroy()
  view = null
})
</script>

<template>
  <div ref="host" class="cm-host" />
</template>

<style scoped>
.cm-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.cm-host :deep(.cm-editor) {
  flex: 1;
  min-height: 0;
}
</style>
