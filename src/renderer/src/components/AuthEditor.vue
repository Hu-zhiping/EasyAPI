<script setup lang="ts">
import type { AuthType } from '../../../shared/types'
import { useTabsStore } from '../stores/tabs'
import PopSelect from './PopSelect.vue'

const tabs = useTabsStore()

const TYPES = [
  { value: 'none', label: '无鉴权' },
  { value: 'bearer', label: 'Bearer Token' },
  { value: 'basic', label: 'Basic Auth' },
  { value: 'apikey', label: 'API Key' }
]

const IN_OPTIONS = [
  { value: 'header', label: '添加到请求头' },
  { value: 'query', label: '添加到查询参数' }
]
</script>

<template>
  <div v-if="tabs.activeTab" style="padding: 12px 14px; max-width: 560px">
    <div class="form-row">
      <label>鉴权类型</label>
      <PopSelect v-model="tabs.activeTab.request.auth.type" :options="TYPES" />
    </div>

    <div v-if="tabs.activeTab.request.auth.type === 'bearer'">
      <div class="form-row">
        <label>Token</label>
        <input
          v-model="tabs.activeTab.request.auth.bearerToken"
          class="input mono"
          spellcheck="false"
          placeholder="支持 {{token}} 变量"
        />
      </div>
      <p class="auth-hint">发送时自动添加请求头 <code>Authorization: Bearer &lt;token&gt;</code></p>
    </div>

    <div v-else-if="tabs.activeTab.request.auth.type === 'basic'">
      <div class="form-row">
        <label>用户名</label>
        <input v-model="tabs.activeTab.request.auth.basicUsername" class="input mono" spellcheck="false" />
      </div>
      <div class="form-row">
        <label>密码</label>
        <input v-model="tabs.activeTab.request.auth.basicPassword" class="input mono" type="password" spellcheck="false" />
      </div>
      <p class="auth-hint">发送时自动添加请求头 <code>Authorization: Basic &lt;base64&gt;</code></p>
    </div>

    <div v-else-if="tabs.activeTab.request.auth.type === 'apikey'">
      <div class="form-row">
        <label>键名</label>
        <input v-model="tabs.activeTab.request.auth.apiKeyKey" class="input mono" spellcheck="false" placeholder="如 X-API-Key" />
      </div>
      <div class="form-row">
        <label>键值</label>
        <input v-model="tabs.activeTab.request.auth.apiKeyValue" class="input mono" spellcheck="false" />
      </div>
      <div class="form-row">
        <label>添加位置</label>
        <PopSelect v-model="tabs.activeTab.request.auth.apiKeyIn" :options="IN_OPTIONS" />
      </div>
    </div>

    <p v-else class="auth-hint">当前未启用鉴权。可在请求头中手动添加，或选择上方类型由 EasyAPI 代为生成。</p>
  </div>
</template>

<style scoped>
.auth-hint {
  margin: 2px 0 0 98px;
  font-size: 11.5px;
  color: var(--text-3);
}
.auth-hint code {
  font-family: Consolas, monospace;
  color: var(--accent);
  background: var(--accent-soft);
  border-radius: 3px;
  padding: 0 4px;
}
</style>
