<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  value: number // 0-1
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}>()

const percent = computed(() => Math.round(Math.max(0, Math.min(1, props.value)) * 100))
const color = computed(() => {
  if (percent.value >= 90) return { bar: 'bg-emerald-500', text: 'text-emerald-600' }
  if (percent.value >= 60) return { bar: 'bg-teal-500', text: 'text-teal-600' }
  if (percent.value >= 30) return { bar: 'bg-amber-400', text: 'text-amber-600' }
  return { bar: 'bg-rose-500', text: 'text-rose-500' }
})
const height = computed(() => {
  switch (props.size) {
    case 'sm':
      return 'h-1'
    case 'lg':
      return 'h-2.5'
    default:
      return 'h-1.5'
  }
})
</script>

<template>
  <div class="flex items-center gap-2">
    <div :class="['flex-1 bg-ink-100 rounded-full overflow-hidden', height]">
      <div
        class="h-full rounded-full transition-all duration-500 ease-out"
        :class="color.bar"
        :style="{ width: percent + '%' }"
      />
    </div>
    <span v-if="showLabel" class="num text-xs font-medium" :class="color.text">
      {{ percent }}%
    </span>
  </div>
</template>
