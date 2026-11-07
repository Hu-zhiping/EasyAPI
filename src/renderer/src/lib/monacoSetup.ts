/**
 * Monaco 编辑器初始化（仅脚本编辑器使用）：
 * - 按需引入 core + JS 语言服务（ts worker），不打包其余语言，控制产物体积
 * - 注入 pm API 类型声明，让脚本获得真实语言服务的补全/悬停/参数提示
 * - 定义与主题变量同源的明暗两套编辑器主题
 */
import * as monaco from 'monaco-editor/editor/editor.api.js'
// editor.main = 全部编辑器特性 + 各语言 tokenizer（0.57 起 editor.all 已移除）
import 'monaco-editor/editor/editor.main.js'
// TS/JS 语言服务（基于 worker）需单独引入
import 'monaco-editor/language/typescript/monaco.contribution.js'
import {
  javascriptDefaults as tsJsDefaults,
  ScriptTarget as tsScriptTarget
} from 'monaco-editor/languages/features/typescript/register.js'
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker'
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker'
import { PM_DTS } from './pmTypes'

self.MonacoEnvironment = {
  getWorker(_workerId: string, label: string): Worker {
    return label === 'javascript' || label === 'typescript' ? new TsWorker() : new EditorWorker()
  }
}

const jsDefaults = tsJsDefaults
// checkJs 关闭：脚本允许顶层 await（沙箱按 AsyncFunction 执行），不显示类型红浪线，
// 但补全、参数提示、悬停文档仍由语言服务完整提供
jsDefaults.setCompilerOptions({
  target: tsScriptTarget.ES2020,
  allowNonTsExtensions: true,
  allowJs: true,
  checkJs: false,
  lib: ['es2022']
})
jsDefaults.setEagerModelSync(true)
jsDefaults.addExtraLib(PM_DTS, 'file:///pm.api.d.ts')

monaco.editor.defineTheme('easyapi-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '6f6f7a', fontStyle: 'italic' },
    { token: 'string', foreground: '98c379' },
    { token: 'constant.numeric', foreground: 'd19a66' },
    { token: 'constant.language', foreground: 'c678dd' },
    { token: 'keyword', foreground: 'c678dd' },
    { token: 'variable', foreground: 'e9e9ec' },
    { token: 'variable.predefined', foreground: 'e06c75' },
    { token: 'entity.name.function', foreground: '61afef' },
    { token: 'type.identifier', foreground: 'e5c07b' },
    { token: 'operator', foreground: '56b6c2' },
    { token: 'delimiter', foreground: 'a3a3ad' }
  ],
  colors: {
    'editor.background': '#1d1d20',
    'editor.foreground': '#e9e9ec',
    'editorLineNumber.foreground': '#55555e',
    'editorLineNumber.activeForeground': '#a3a3ad',
    'editor.selectionBackground': '#4c9ffe40',
    'editor.inactiveSelectionBackground': '#4c9ffe26',
    'editor.lineHighlightBackground': '#2a2a2f66',
    'editorCursor.foreground': '#e9e9ec',
    'editorIndentGuide.background1': '#2b2b30',
    'editorWidget.background': '#252529',
    'editorWidget.border': '#3a3a41',
    'editorSuggestWidget.background': '#252529',
    'editorSuggestWidget.border': '#3a3a41',
    'editorSuggestWidget.selectedBackground': '#3a3a4180',
    'editorHoverWidget.background': '#252529',
    'editorHoverWidget.border': '#3a3a41',
    'scrollbarSlider.background': '#3a3a4160',
    'scrollbarSlider.hoverBackground': '#3a3a4190',
    'scrollbarSlider.activeBackground': '#4c9ffe60'
  }
})

monaco.editor.defineTheme('easyapi-light', {
  base: 'vs',
  inherit: true,
  rules: [
    { token: 'comment', foreground: 'a0a1a7', fontStyle: 'italic' },
    { token: 'string', foreground: '35a04b' },
    { token: 'constant.numeric', foreground: 'b76b01' },
    { token: 'constant.language', foreground: 'a626a4' },
    { token: 'keyword', foreground: 'a626a4' },
    { token: 'variable', foreground: '383a42' },
    { token: 'variable.predefined', foreground: 'e45649' },
    { token: 'entity.name.function', foreground: '0a6cf1' },
    { token: 'type.identifier', foreground: '0184bc' },
    { token: 'operator', foreground: '6b7280' },
    { token: 'delimiter', foreground: '6b7280' }
  ],
  colors: {
    'editor.background': '#ffffff',
    'editor.foreground': '#383a42',
    'editorLineNumber.foreground': '#c0c4cc',
    'editorLineNumber.activeForeground': '#4e5969',
    'editor.selectionBackground': '#0a6cf133',
    'editor.inactiveSelectionBackground': '#0a6cf11f',
    'editor.lineHighlightBackground': '#f0f2f580',
    'editorCursor.foreground': '#1f2329',
    'editorIndentGuide.background1': '#e4e7ec',
    'editorWidget.background': '#ffffff',
    'editorWidget.border': '#e4e7ec',
    'editorSuggestWidget.background': '#ffffff',
    'editorSuggestWidget.border': '#e4e7ec',
    'editorSuggestWidget.selectedBackground': '#f0f2f5',
    'editorHoverWidget.background': '#ffffff',
    'editorHoverWidget.border': '#e4e7ec',
    'scrollbarSlider.background': '#d0d5dd60',
    'scrollbarSlider.hoverBackground': '#d0d5dd90',
    'scrollbarSlider.activeBackground': '#0a6cf160'
  }
})

/** 由 app store 的主题值得到 Monaco 主题名 */
export function monacoTheme(theme: string): string {
  return theme === 'dark' ? 'easyapi-dark' : 'easyapi-light'
}

/** 脚本编辑器统一字体（与 CodeEditor 保持一致） */
export const SCRIPT_FONT =
  "'Cascadia Code', 'JetBrains Mono', Consolas, 'Courier New', monospace"

export { monaco }
