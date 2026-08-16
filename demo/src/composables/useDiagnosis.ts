import { ref } from 'vue'
import type { DiagnosisStatus } from '@/types'

/**
 * 诊断状态机
 * --------------------------
 * idle ─→ reading ─→ diagnosing ─→ completed ─→ pending_execute ─→ waiting_data ─→ reviewed
 *                                 ↘ insufficient / failed（任意节点）
 */
export const STATUS_FLOW: Record<DiagnosisStatus, { next?: DiagnosisStatus; label: string }> = {
  idle: { next: 'reading', label: '未发起' },
  reading: { next: 'diagnosing', label: '读取数据中' },
  diagnosing: { next: 'completed', label: '诊断中' },
  completed: { next: 'pending_execute', label: '待人工确认' },
  pending_execute: { next: 'waiting_data', label: '等待人工执行' },
  waiting_data: { next: 'reviewed', label: '等待数据回流' },
  reviewed: { label: '复盘完成' },
  insufficient: { label: '数据不足' },
  failed: { label: '诊断失败' }
}

export function useDiagnosis() {
  const status = ref<DiagnosisStatus>('idle')
  const drawerOpen = ref(false)
  const currentProjectId = ref<string | null>(null)

  function startDiagnosis(projectId: string) {
    currentProjectId.value = projectId
    status.value = 'reading'
    drawerOpen.value = true
    // 模拟读取数据 1.2s
    setTimeout(() => {
      if (status.value === 'reading') status.value = 'diagnosing'
    }, 1200)
    // 模拟诊断 2s
    setTimeout(() => {
      if (status.value === 'diagnosing') status.value = 'completed'
    }, 3200)
  }

  function approve() {
    if (status.value === 'completed') status.value = 'pending_execute'
  }
  function reject() {
    status.value = 'failed'
  }
  function modify() {
    status.value = 'pending_execute'
  }
  function markExecuted() {
    if (status.value === 'pending_execute') status.value = 'waiting_data'
  }
  function markReviewed() {
    if (status.value === 'waiting_data') status.value = 'reviewed'
  }
  function retry() {
    status.value = 'idle'
  }
  function closeDrawer() {
    drawerOpen.value = false
  }
  function reopen(projectId: string) {
    if (status.value === 'idle' || status.value === 'failed') {
      startDiagnosis(projectId)
    } else {
      drawerOpen.value = true
    }
  }

  return {
    status,
    drawerOpen,
    currentProjectId,
    startDiagnosis,
    approve,
    reject,
    modify,
    markExecuted,
    markReviewed,
    retry,
    closeDrawer,
    reopen
  }
}
