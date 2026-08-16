<script setup lang="ts">
import { computed } from 'vue'
import type { DiagnosisStatus } from '@/types'

const props = defineProps<{ status: DiagnosisStatus; size?: 'sm' | 'md' }>()

const map: Record<DiagnosisStatus, { label: string; bg: string; text: string; dot: string }> = {
  idle: { label: '未发起', bg: 'bg-ink-100', text: 'text-ink-600', dot: 'bg-ink-400' },
  reading: { label: '读取数据中', bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400' },
  diagnosing: { label: '诊断中', bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400' },
  completed: { label: '待人工确认', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  pending_execute: { label: '等待人工执行', bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400' },
  waiting_data: { label: '等待数据回流', bg: 'bg-sky-50', text: 'text-sky-600', dot: 'bg-sky-400' },
  reviewed: { label: '复盘完成', bg: 'bg-emerald-50', text: 'text-emerald-500', dot: 'bg-emerald-400' },
  insufficient: { label: '数据不足', bg: 'bg-ink-100', text: 'text-ink-600', dot: 'bg-ink-400' },
  failed: { label: '诊断失败', bg: 'bg-rose-50', text: 'text-rose-500', dot: 'bg-rose-400' }
}

const info = computed(() => map[props.status])
const showPulse = computed(() => props.status === 'reading' || props.status === 'diagnosing')
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 px-2 h-6 text-xs font-medium rounded',
      info.bg,
      info.text,
      size === 'sm' ? 'h-5 text-2xs' : ''
    ]"
  >
    <span
      :class="[
        'inline-block w-1.5 h-1.5 rounded-full',
        info.dot,
        showPulse ? 'pulse-dot' : ''
      ]"
    />
    {{ info.label }}
  </span>
</template>
