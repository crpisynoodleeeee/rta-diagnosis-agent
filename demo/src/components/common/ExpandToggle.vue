<script setup lang="ts">
import { ChevronRight, ChevronDown } from 'lucide-vue-next'

defineProps<{
  expanded: boolean
  size?: 'sm' | 'md'
}>()

defineEmits<{
  (e: 'toggle'): void
}>()
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-1 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
    @click="$emit('toggle')"
  >
    <component
      :is="expanded ? ChevronDown : ChevronRight"
      :size="size === 'sm' ? 12 : 14"
      class="transition-transform"
    />
    <slot />
  </button>
</template>
