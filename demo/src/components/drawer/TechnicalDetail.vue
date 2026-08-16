<script setup lang="ts">
import { ChevronDown, ChevronRight } from 'lucide-vue-next'
import { ref } from 'vue'
import type { DiagnosisReport } from '@/types'

defineProps<{ technical: DiagnosisReport['technical'] }>()

const sections = [
  {
    title: 'RTA 资源与实验',
    rows: [
      { label: '媒体侧 RTAID', value: 'rtaId', kind: 'code' },
      { label: '内部 RTA 资源 ID', value: 'internalRtaId', kind: 'code' },
      { label: '实验 ID', value: 'experimentId', kind: 'code' }
    ]
  },
  {
    title: '实验组与分桶',
    rows: [
      { label: '对照组 ID', value: 'controlGroupId', kind: 'code' },
      { label: '实验组 A ID', value: 'treatmentGroupId', kind: 'code' },
      { label: '实验组 A 分桶', value: 'bucketIds', kind: 'array' }
    ]
  },
  {
    title: '请求与日志',
    rows: [
      { label: '代表请求 ID', value: 'requestId', kind: 'code' },
      { label: '日志字段路径', value: 'logFieldPath', kind: 'code' }
    ]
  },
  {
    title: '配置变更前 / 后',
    rows: [
      { label: '变更前快照', value: 'configBefore', kind: 'kv' },
      { label: '变更后快照', value: 'configAfter', kind: 'kv' }
    ]
  },
  {
    title: '数据来源与更新时间',
    rows: [
      { label: '数据来源', value: 'dataSource', kind: 'plain' },
      { label: '数据更新时间', value: 'dataUpdatedAt', kind: 'plain' }
    ]
  }
] as const

const openSections = ref<Record<string, boolean>>({
  RTA资源与实验: true,
  实验组与分桶: true,
  请求与日志: false,
  配置变更前后: true,
  数据来源与更新时间: false
})

function toggle(key: string) {
  openSections.value[key] = !openSections.value[key]
}

function fmt(value: unknown, kind: string): string {
  if (value === undefined || value === null) return '—'
  if (kind === 'array' && Array.isArray(value)) return '[' + value.join(', ') + ']'
  if (kind === 'kv' && typeof value === 'object') {
    return Object.entries(value)
      .map(([k, v]) => `${k} = ${v}`)
      .join(' · ')
  }
  return String(value)
}
</script>

<template>
  <div class="space-y-1.5">
    <div
      v-for="sec in sections"
      :key="sec.title"
      class="border border-ink-200 rounded-lg overflow-hidden"
    >
      <button
        type="button"
        class="w-full flex items-center justify-between px-3 py-2 text-xs font-medium text-ink-700 hover:bg-ink-50 transition-colors"
        @click="toggle(sec.title)"
      >
        <span class="flex items-center gap-1.5">
          <component
            :is="openSections[sec.title] ? ChevronDown : ChevronRight"
            :size="12"
            class="text-ink-400"
          />
          {{ sec.title }}
        </span>
        <span class="num text-2xs text-ink-400">{{ sec.rows.length }} 项</span>
      </button>
      <div v-if="openSections[sec.title]" class="px-3 pb-3 pt-1 space-y-1.5">
        <div
          v-for="row in sec.rows"
          :key="row.label"
          class="flex items-baseline gap-3 text-xs"
        >
          <span class="text-ink-500 w-32 shrink-0">{{ row.label }}</span>
          <span
            class="num text-ink-800 font-medium break-all"
            :class="row.kind === 'code' ? 'bg-ink-50 px-1.5 py-0.5 rounded' : ''"
          >
            {{ fmt((technical as any)[row.value], row.kind) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
