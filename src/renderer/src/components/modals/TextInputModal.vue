<script setup lang="ts">
import { onMounted, ref } from 'vue'
import ModalShell from '../ModalShell.vue'
import { useAppStore } from '../../stores/app'

const app = useAppStore()
const modal = app.modal as {
  type: 'input'
  title: string
  label: string
  initial: string
  confirmText: string
  danger?: boolean
  onOk: (v: string) => void
}

const value = ref(modal.initial)
const inputEl = ref<HTMLInputElement | null>(null)

onMounted(() => {
  inputEl.value?.focus()
  inputEl.value?.select()
})

function ok(): void {
  const v = value.value.trim()
  if (!v) return
  modal.onOk(v)
  app.modal = null
}
</script>

<template>
  <ModalShell :title="modal.title" :width="420" @close="app.modal = null">
    <div class="form-row" style="margin-bottom: 0">
      <label>{{ modal.label }}</label>
      <input ref="inputEl" v-model="value" class="input" spellcheck="false" @keydown.enter="ok" />
    </div>
    <template #footer>
      <button class="btn btn-ghost" @click="app.modal = null">取消</button>
      <button class="btn" :class="modal.danger ? 'btn-danger' : 'btn-primary'" @click="ok">
        {{ modal.confirmText }}
      </button>
    </template>
  </ModalShell>
</template>
