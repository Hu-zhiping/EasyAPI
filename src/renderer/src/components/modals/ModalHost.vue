<script setup lang="ts">
import { useAppStore } from '../../stores/app'
import SaveRequestModal from './SaveRequestModal.vue'
import TextInputModal from './TextInputModal.vue'
import EnvModal from './EnvModal.vue'
import ImportModal from './ImportModal.vue'
import CodeGenModal from './CodeGenModal.vue'
import SettingsModal from './SettingsModal.vue'
import ConfirmModal from './ConfirmModal.vue'
import CookieModal from './CookieModal.vue'

const app = useAppStore()
</script>

<template>
  <SaveRequestModal v-if="app.modal?.type === 'save-request'" />
  <TextInputModal v-else-if="app.modal?.type === 'input'" />
  <EnvModal v-else-if="app.modal?.type === 'env'" />
  <ImportModal v-else-if="app.modal?.type === 'import'" />
  <CodeGenModal v-else-if="app.modal?.type === 'codegen'" />
  <SettingsModal v-else-if="app.modal?.type === 'settings'" />
  <CookieModal v-else-if="app.modal?.type === 'cookies'" />
  <ConfirmModal v-else-if="app.modal?.type === 'confirm'" />
</template>
