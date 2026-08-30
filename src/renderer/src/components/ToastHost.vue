<script setup lang="ts">
import { AlertCircle, CheckCircle2, Info } from 'lucide-vue-next'
import { useAppStore } from '../stores/app'

const app = useAppStore()
</script>

<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="t in app.toasts" :key="t.id" class="toast" :class="t.type">
        <AlertCircle v-if="t.type === 'error'" :size="15" />
        <CheckCircle2 v-else-if="t.type === 'success'" :size="15" />
        <Info v-else :size="15" />
        <span>{{ t.text }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>
