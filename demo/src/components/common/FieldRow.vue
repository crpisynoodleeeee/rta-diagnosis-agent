<script setup lang="ts">
import { computed } from 'vue'

defineProps<{
  label: string
  value: string | number
  tone?: 'default' | 'warn' | 'critical' | 'positive'
  mono?: boolean
}>()
</script>

<template>
  <div class="flex items-baseline gap-2 min-w-0">
    <span class="text-xs text-ink-500 shrink-0">{{ label }}</span>
    <span
      class="text-sm font-medium truncate"
      :class="[
        mono ? 'num' : '',
        tone === 'warn' ? 'text-amber-600' : '',
        tone === 'critical' ? 'text-rose-500' : '',
        tone === 'positive' ? 'text-emerald-500' : '',
        !tone || tone === 'default' ? 'text-ink-800' : ''
      ]"
    >
      {{ value }}
    </span>
  </div>
</template>
