<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

export interface PopOption {
  value: string
  label: string
  color?: string
  desc?: string
}

const props = withDefaults(
  defineProps<{
    options: PopOption[]
    modelValue: string
    align?: 'left' | 'right'
    width?: number
  }>(),
  { align: 'left' }
)

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'select', v: string): void }>()

const open = ref(false)
const x = ref(0)
const y = ref(0)
const trigger = ref<HTMLElement | null>(null)
const menu = ref<HTMLElement | null>(null)

const current = computed(() => props.options.find((o) => o.value === props.modelValue))

function toggle(): void {
  if (open.value) close()
  else void show()
}

async function show(): Promise<void> {
  const r = trigger.value?.getBoundingClientRect()
  if (!r) return
  open.value = true
  await nextTick()
  const mw = menu.value?.offsetWidth ?? 160
  const mh = menu.value?.offsetHeight ?? 200
  x.value = props.align === 'right' ? Math.max(8, r.right - mw) : r.left
  if (x.value + mw > window.innerWidth - 8) x.value = window.innerWidth - 8 - mw
  y.value = r.bottom + 6
  if (y.value + mh > window.innerHeight - 8) y.value = Math.max(8, r.top - mh - 6)
}

function close(): void {
  open.value = false
}

function pick(v: string): void {
  emit('update:modelValue', v)
  emit('select', v)
  close()
}

function onDocMousedown(e: MouseEvent): void {
  if (!open.value) return
  const t = e.target as Node
  if (trigger.value?.contains(t) || menu.value?.contains(t)) return
  close()
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && open.value) close()
}

onMounted(() => {
  document.addEventListener('mousedown', onDocMousedown, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('mousedown', onDocMousedown, true)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div ref="trigger" class="pop-trigger" @click.stop="toggle">
    <slot name="trigger" :option="current">
      <span>{{ current?.label ?? '请选择' }}</span>
      <ChevronDown :size="13" class="op-6" />
    </slot>
  </div>
  <Teleport to="body">
    <div
      v-if="open"
      ref="menu"
      class="pop-menu"
      :style="{ left: x + 'px', top: y + 'px', width: width ? width + 'px' : undefined }"
    >
      <template v-for="o in options" :key="o.value">
        <div v-if="o.value.startsWith('__sep')" class="pop-sep" />
        <div v-else-if="o.value === '__label'" class="pop-label">{{ o.label }}</div>
        <div v-else class="pop-item" :class="{ selected: o.value === modelValue }" @click="pick(o.value)">
          <span v-if="o.color" class="dot" :style="{ background: o.color }" />
          <span>{{ o.label }}</span>
          <span v-if="o.desc" class="pop-desc">{{ o.desc }}</span>
          <span class="grow" />
          <Check v-if="o.value === modelValue" :size="14" />
        </div>
      </template>
    </div>
  </Teleport>
</template>

<style scoped>
.op-6 {
  opacity: 0.6;
}
</style>
