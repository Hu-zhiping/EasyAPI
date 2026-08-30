<script setup lang="ts">
import ModalShell from '../ModalShell.vue'
import { useAppStore } from '../../stores/app'

const app = useAppStore()
const modal = app.modal as {
  type: 'confirm'
  title: string
  message: string
  confirmText: string
  danger?: boolean
  onOk: () => void
}

function ok(): void {
  modal.onOk()
  app.modal = null
}
</script>

<template>
  <ModalShell :title="modal.title" :width="420" @close="app.modal = null">
    <p class="msg">{{ modal.message }}</p>
    <template #footer>
      <button class="btn btn-ghost" @click="app.modal = null">取消</button>
      <button class="btn" :class="modal.danger ? 'btn-danger' : 'btn-primary'" @click="ok">
        {{ modal.confirmText }}
      </button>
    </template>
  </ModalShell>
</template>

<style scoped>
.msg {
  margin: 4px 0 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: var(--text-2);
  white-space: pre-line;
}
</style>
