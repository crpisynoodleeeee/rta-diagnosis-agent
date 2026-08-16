<script setup lang="ts">
import { computed } from 'vue'
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  MinusCircle,
  FlaskConical,
  TrendingDown,
  TrendingUp,
  Settings2,
  Layers,
  ArrowDownUp,
  CircleDot,
  Boxes
} from 'lucide-vue-next'
import type { CauseNode } from '@/types'
import ExpandToggle from '@/components/common/ExpandToggle.vue'

defineProps<{
  nodes: CauseNode[]
}>()

defineEmits<{
  (e: 'toggle', id: string): void
}>()

const categoryIcon: Record<string, typeof FlaskConical> = {
  budget: Boxes,
  binding: Layers,
  traffic: ArrowDownUp,
  service: Settings2,
  experiment: FlaskConical,
  strategy: TrendingDown,
  bidding: TrendingUp,
  attribution: CircleDot
}

function resultMeta(node: CauseNode) {
  if (node.result === 'normal') {
    return {
      icon: CheckCircle2,
      label: '正常',
      cls: 'text-emerald-500',
      bg: 'bg-emerald-50',
      stripe: 'border-emerald-200'
    }
  }
  if (node.result === 'abnormal') {
    return {
      icon: AlertTriangle,
      label: '异常',
      cls: 'text-amber-600',
      bg: 'bg-amber-50',
      stripe: 'border-amber-300'
    }
  }
  return {
    icon: MinusCircle,
    label: '已排除',
    cls: 'text-ink-400',
    bg: 'bg-ink-100',
    stripe: 'border-ink-200'
  }
}

function impactLabel(impact: 'high' | 'medium' | 'low'): string {
  return { high: '高影响', medium: '中影响', low: '低影响' }[impact]
}
function impactTone(impact: 'high' | 'medium' | 'low'): string {
  return {
    high: 'bg-rose-50 text-rose-500',
    medium: 'bg-amber-50 text-amber-600',
    low: 'bg-ink-100 text-ink-500'
  }[impact]
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="node in nodes"
      :key="node.id"
      class="rounded-lg border bg-white overflow-hidden"
      :class="resultMeta(node).stripe"
    >
      <!-- 节点头 -->
      <div class="flex items-center gap-3 px-3 py-2.5">
        <component
          :is="categoryIcon[node.category]"
          :size="16"
          class="text-ink-400 shrink-0"
        />
        <span class="text-sm font-medium text-ink-800 flex-1 min-w-0 truncate">
          {{ node.label }}
        </span>
        <span
          class="badge"
          :class="[resultMeta(node).bg, resultMeta(node).cls]"
        >
          <component :is="resultMeta(node).icon" :size="11" />
          {{ resultMeta(node).label }}
        </span>
        <span
          v-if="node.result !== 'excluded'"
          class="badge"
          :class="impactTone(node.impact)"
        >
          {{ impactLabel(node.impact) }}
        </span>
        <span class="num text-2xs text-ink-400 px-1.5 shrink-0">
          {{ node.confidence }}%
        </span>
        <ExpandToggle
          :expanded="false"
          size="sm"
          @toggle="$emit('toggle', node.id)"
        >
          详情
        </ExpandToggle>
      </div>

      <!-- 关键证据（始终可见、一行内显示） -->
      <div class="px-3 pb-2.5 -mt-1">
        <p class="text-xs text-ink-500 leading-relaxed">
          <span class="text-ink-400 mr-1">证据：</span>{{ node.evidence }}
        </p>
        <div
          v-if="node.metrics && node.metrics.length"
          class="flex flex-wrap gap-x-4 gap-y-1 mt-1.5"
        >
          <div v-for="m in node.metrics" :key="m.name" class="flex items-baseline gap-1.5">
            <span class="text-2xs text-ink-400">{{ m.name }}</span>
            <span class="num text-xs font-medium text-ink-700">{{ m.value }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
