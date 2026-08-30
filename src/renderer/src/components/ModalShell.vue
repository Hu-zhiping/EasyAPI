<script setup lang="ts">
import { X } from 'lucide-vue-next'

defineProps<{ title: string; width?: number }>()
const emit = defineEmits<{ (e: 'close'): void }>()
</script>

<template>
  <Teleport to="body">
    <div class="modal-overlay" @mousedown.self="emit('close')">
      <div class="modal-card" :style="width ? { width: width + 'px' } : undefined">
        <div class="modal-head">
          <span class="modal-title">{{ title }}</span>
          <button class="icon-btn" @click="emit('close')"><X :size="15" /></button>
        </div>
        <div class="modal-body">
          <slot />
        </div>
        <div v-if="$slots.footer" class="modal-foot">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
