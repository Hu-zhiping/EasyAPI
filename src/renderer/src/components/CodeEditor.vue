<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { basicSetup } from 'codemirror'
import { acceptCompletion } from '@codemirror/autocomplete'
import { EditorState, Compartment, Prec, type Extension } from '@codemirror/state'
import { EditorView, drawSelection, keymap, placeholder as cmPlaceholder } from '@codemirror/view'
import { search, searchKeymap } from '@codemirror/search'
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language'
import { tags } from '@lezer/highlight'
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
  return app.settings.theme === 'dark' ? oneDark : lightHighlight
}

/**
 * 浅色主题语法高亮（Postman light 风格）：
 * 属性名红棕、字符串绿、数字/布尔橙紫、注释灰——深色主题由 oneDark 提供。
 */
const lightHighlight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: tags.propertyName, color: '#e45649' },
    { tag: tags.string, color: '#35a04b' },
    { tag: tags.number, color: '#b76b01' },
    { tag: tags.bool, color: '#a626a4' },
    { tag: [tags.keyword, tags.moduleKeyword], color: '#a626a4' },
    { tag: [tags.null, tags.atom], color: '#a626a4' },
    { tag: tags.comment, color: '#a0a1a7', fontStyle: 'italic' },
    { tag: [tags.bracket, tags.punctuation], color: '#6b7280' },
    { tag: tags.variableName, color: '#383a42' },
    { tag: tags.function(tags.variableName), color: '#0a6cf1' },
    { tag: tags.tagName, color: '#e45649' },
    { tag: tags.attributeName, color: '#b76b01' }
  ])
)

onMounted(() => {
  const updateListener = EditorView.updateListener.of((u) => {
    if (u.docChanged && !props.readonly) emit('update:modelValue', u.state.doc.toString())
  })
  const extensions: Extension[] = [
    basicSetup,
    // 自绘选区层：basicSetup 不含 drawSelection，原生 ::selection 高亮
    // 在主题叠加下经常不可见（双击选词看不到选中效果）
    drawSelection(),
    // 正文搜索面板（Ctrl+F 打开，Esc 关闭）
    search({ top: true }),
    keymap.of(searchKeymap),
    langComp.of(langExt(props.language)),
    roComp.of(roExt(props.readonly)),
    themeComp.of(themeExt()),
    // 自动换行：一行写满编辑器宽度后折行
    EditorView.lineWrapping,
    // Tab 接受当前补全项（Postman/VSCode 习惯）；无补全时回落给缩进等其它 Tab 绑定
    Prec.highest(keymap.of([{ key: 'Tab', run: acceptCompletion }])),
    updateListener
  ]
  if (props.placeholder) extensions.push(cmPlaceholder(props.placeholder))
  view = new EditorView({
    state: EditorState.create({ doc: props.modelValue, extensions }),
    parent: host.value ?? undefined
  })
  // 挂到宿主元素上，便于自动化测试与外部命令调用（如打开搜索面板）
  ;(host.value as HTMLElement & { __cmView?: EditorView }).__cmView = view
  // CM 在挂载瞬间测量行高并写进行号列的内联高度；若此时样式（scoped CSS / 自定义字体）
  // 尚未生效，测量值会偏小导致行号逐行漂移。下一帧与字体就绪后各强制重测一次。
  requestAnimationFrame(() => view?.requestMeasure())
  document.fonts?.ready.then(() => view?.requestMeasure()).catch(() => {})
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

/** 在光标处插入文本（供代码片段面板等外部调用），插入后聚焦并滚动到可视区 */
function insertAtCursor(text: string): void {
  if (!view) return
  const doc = view.state.doc.toString()
  const { from, to } = view.state.selection.main
  // 光标在非空行尾时先换行，保持脚本整洁
  const lineText = view.state.doc.lineAt(to).text
  const prefix = doc.length === 0 ? '' : lineText.trim() && to === lineText.length + view.state.doc.lineAt(to).from ? '\n' : ''
  const suffix = '\n'
  view.dispatch({
    changes: { from, to, insert: prefix + text + suffix },
    selection: { anchor: from + prefix.length + text.length + suffix.length },
    scrollIntoView: true
  })
  view.focus()
}

defineExpose({ insertAtCursor })
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
/* 正文排版基准：字号/行高/字体统一挂在 .cm-scroller（CM 的度量基准），
   .cm-content 同步声明以防 CM 基础主题的 monospace 字体覆盖。
   行高必须用整数像素（20.8px 这类小数会让正文与行号列取整不一致，产生逐行漂移）；
   .cm-content 禁止加纵向 padding（行号列不随之偏移） */
.cm-host :deep(.cm-scroller),
.cm-host :deep(.cm-content),
.cm-host :deep(.cm-gutters) {
  font-family: 'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace;
  font-size: 13px;
  line-height: 21px;
}
/* 长无断点 token(URL / 签名 / ID)允许行尾任意断行：
   pre-wrap 默认把整词挪到下一行，会在行尾留下大段空白（URL 场景尤其明显） */
.cm-host :deep(.cm-content) {
  word-break: break-all;
}
/* 折叠标记：默认 CM 用裸文本字符（⌄/›），改为 VSCode 式 CSS 折叠箭头——
   平时隐藏，悬停行号区时淡入；朝向区分可折叠（下）/已折叠（右）。
   状态借助 title 属性选择器区分（CM 默认英文短语） */
.cm-host :deep(.cm-foldGutter span) {
  font-size: 0;
  cursor: pointer;
  position: relative;
  width: 14px;
  opacity: 0;
  transition: opacity 0.12s;
}
.cm-host :deep(.cm-gutters:hover .cm-foldGutter span) {
  opacity: 0.55;
}
.cm-host :deep(.cm-foldGutter span:hover) {
  opacity: 1;
}
.cm-host :deep(.cm-foldGutter span::after) {
  content: '';
  position: absolute;
  left: 4px;
  top: 50%;
  width: 5px;
  height: 5px;
  border-right: 1.5px solid var(--text-2);
  border-bottom: 1.5px solid var(--text-2);
}
/* 可折叠：朝下箭头 */
.cm-host :deep(.cm-foldGutter span[title='Fold line']::after) {
  transform: translateY(-70%) rotate(45deg);
}
/* 已折叠：朝右箭头 */
.cm-host :deep(.cm-foldGutter span[title='Unfold line']::after) {
  transform: translateY(-70%) rotate(-45deg);
}
.cm-host :deep(.cm-foldGutter span:hover::after) {
  border-color: var(--accent);
}
/* 折叠后的占位符（…） */
.cm-host :deep(.cm-foldPlaceholder) {
  background: var(--bg-hover);
  border: 1px solid var(--border);
  color: var(--text-3);
  border-radius: 4px;
  padding: 0 6px;
  margin: 0 4px;
  cursor: pointer;
  font-size: 11px;
}
/* 选区高亮（drawSelection 层）：主题蓝半透明，深浅色均可辨 */
.cm-host :deep(.cm-selectionBackground) {
  background: color-mix(in srgb, var(--blue) 30%, transparent) !important;
}
.cm-host :deep(.cm-focused .cm-selectionBackground) {
  background: color-mix(in srgb, var(--blue) 40%, transparent) !important;
}
/* 光标颜色跟随主题 */
.cm-host :deep(.cm-cursor) {
  border-left-color: var(--text);
}
</style>
