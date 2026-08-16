<script setup lang="ts">
import {
  PenSquare,
  Activity,
  Eye,
  Coins
} from 'lucide-vue-next'
import type { TimelineEvent } from '@/types'

defineProps<{ events: TimelineEvent[] }>()

const catMap: Record<TimelineEvent['category'], { icon: typeof PenSquare; color: string }> = {
  config: { icon: PenSquare, color: 'text-amber-600 bg-amber-50 border-amber-200' },
  metric: { icon: Activity, color: 'text-sky-500 bg-sky-50 border-sky-100' },
  impression: { icon: Eye, color: 'text-ink-500 bg-ink-50 border-ink-200' },
  cost: { icon: Coins, color: 'text-rose-500 bg-rose-50 border-rose-100' }
}
</script>

<template>
  <ol class="relative">
    <span
      class="absolute left-[15px] top-2 bottom-2 w-px bg-ink-200"
      aria-hidden="true"
    ></span>
    <li
      v-for="(e, i) in events"
      :key="i"
      class="relative flex gap-3 pb-3 last:pb-0 pl-0"
    >
      <span
        class="relative z-10 w-8 h-8 inline-flex items-center justify-center rounded-full border bg-white shrink-0"
        :class="catMap[e.category].color"
      >
        <component :is="catMap[e.category].icon" :size="14" />
      </span>
      <div class="flex-1 min-w-0 pt-1">
        <div class="flex items-baseline gap-2">
          <span class="num text-xs font-medium text-ink-700">{{ e.time }}</span>
          <span class="text-sm font-medium text-ink-800 truncate">{{ e.label }}</span>
          <span
            v-if="e.value"
            class="num text-xs font-medium text-amber-600 shrink-0"
          >
            {{ e.value }}
          </span>
        </div>
        <p v-if="e.detail" class="text-xs text-ink-500 mt-0.5 leading-relaxed">
          {{ e.detail }}
        </p>
      </div>
    </li>
  </ol>
</template>
