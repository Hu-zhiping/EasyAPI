import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import './styles/base.css'
import './styles/ui.css'

// 渲染层异常兜底：输出到控制台（DevTools 可见），便于生产问题排查
window.addEventListener('error', (e) => {
  console.error('[EasyAPI] 渲染层错误:', e.error ?? e.message)
})
window.addEventListener('unhandledrejection', (e) => {
  console.error('[EasyAPI] 未处理的 Promise 拒绝:', e.reason)
})

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
