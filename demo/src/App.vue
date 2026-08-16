<script setup lang="ts">
import { computed } from 'vue'
import { Bell, HelpCircle, Settings, Activity } from 'lucide-vue-next'
import DeliveryList from '@/components/list/DeliveryList.vue'
import DiagnosisDrawer from '@/components/drawer/DiagnosisDrawer.vue'
import { deliveryList, goldenReport, project } from '@/data/mock'
import { useDiagnosis } from '@/composables/useDiagnosis'
import type { Project } from '@/types'

const {
  status,
  drawerOpen,
  currentProjectId,
  startDiagnosis,
  approve,
  modify,
  reject,
  retry,
  closeDrawer,
  markExecuted,
  markReviewed
} = useDiagnosis()

const currentProject = computed<Project>(() => {
  if (!currentProjectId.value) return project
  return (
    deliveryList.find((r) => r.project.projectId === currentProjectId.value)?.project ??
    project
  )
})

const abnormalCount = computed(
  () => deliveryList.filter((r) => r.project.abnormal).length
)

function handleDiagnose(p: Project) {
  startDiagnosis(p.projectId)
}
</script>

<template>
  <div class="min-h-screen flex flex-col">
    <!-- 顶部导航条 -->
    <nav
      class="h-12 bg-white border-b border-ink-200 flex items-center px-4 gap-4 shrink-0"
    >
      <div class="flex items-center gap-2">
        <span
          class="w-6 h-6 rounded bg-teal-600 text-white inline-flex items-center justify-center"
        >
          <Activity :size="14" />
        </span>
        <span class="text-sm font-semibold text-ink-800">投放平台 · RTA</span>
        <span class="badge bg-ink-100 text-ink-500">Mock Demo</span>
      </div>
      <nav class="flex items-center gap-0.5 ml-6">
        <a class="px-2.5 h-8 inline-flex items-center text-sm font-medium text-ink-800 border-b-2 border-teal-500">
          投放项目
        </a>
        <a class="px-2.5 h-8 inline-flex items-center text-sm text-ink-500 hover:text-ink-800">
          策略工厂
        </a>
        <a class="px-2.5 h-8 inline-flex items-center text-sm text-ink-500 hover:text-ink-800">
          RTA 实验
        </a>
        <a class="px-2.5 h-8 inline-flex items-center text-sm text-ink-500 hover:text-ink-800">
          数据中心
        </a>
      </nav>
      <div class="ml-auto flex items-center gap-1">
        <button class="btn-ghost p-2" aria-label="通知">
          <Bell :size="14" />
          <span
            class="absolute -mt-3 ml-2.5 inline-flex items-center justify-center text-2xs bg-rose-500 text-white rounded-full w-4 h-4 num"
          >
            {{ abnormalCount }}
          </span>
        </button>
        <button class="btn-ghost p-2" aria-label="帮助">
          <HelpCircle :size="14" />
        </button>
        <button class="btn-ghost p-2" aria-label="设置">
          <Settings :size="14" />
        </button>
        <div class="ml-2 flex items-center gap-2">
          <div
            class="w-7 h-7 rounded-full bg-teal-100 text-teal-700 inline-flex items-center justify-center text-xs font-medium"
          >
            K
          </div>
          <span class="text-sm text-ink-700">Kiki</span>
        </div>
      </div>
    </nav>

    <DeliveryList
      :rows="deliveryList"
      :current-diagnosing-project-id="currentProjectId"
      @diagnose="handleDiagnose"
    />

    <DiagnosisDrawer
      :open="drawerOpen"
      :status="status"
      :project="currentProject"
      :report="goldenReport"
      @close="closeDrawer"
      @approve="approve"
      @modify="modify"
      @reject="reject"
      @retry="retry"
      @markExecuted="markExecuted"
      @markReviewed="markReviewed"
    />
  </div>
</template>
