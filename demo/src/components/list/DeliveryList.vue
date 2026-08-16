<script setup lang="ts">
import { computed } from 'vue'
import { Search, Filter, RefreshCw, Stethoscope, ListChecks } from 'lucide-vue-next'
import StatusBadge from '@/components/common/StatusBadge.vue'
import ProgressBar from '@/components/common/ProgressBar.vue'
import type { DeliveryListRow, Project } from '@/types'

const props = defineProps<{
  rows: DeliveryListRow[]
  currentDiagnosingProjectId?: string | null
}>()

const emit = defineEmits<{
  (e: 'diagnose', project: Project): void
}>()

function abnormalProjects(rows: DeliveryListRow[]): number {
  return rows.filter((r) => r.project.abnormal).length
}

const abnormalCount = computed(() => abnormalProjects(props.rows))

function formatBudget(n: number): string {
  return '¥' + n.toLocaleString('zh-CN')
}
function formatRate(r: number): string {
  return (r * 100).toFixed(0) + '%'
}
</script>

<template>
  <main class="flex-1 min-w-0 px-8 py-6">
    <!-- 顶部面包屑 + 标题 -->
    <header class="mb-5">
      <nav class="flex items-center gap-1.5 text-xs text-ink-500 mb-2">
        <span>投放管理</span>
        <span class="text-ink-300">/</span>
        <span class="text-ink-700">投放项目列表</span>
      </nav>
      <div class="flex items-center justify-between gap-4">
        <div>
          <h1 class="text-xl font-semibold text-ink-800 tracking-tight">
            RTA 投放项目
          </h1>
          <p class="text-sm text-ink-500 mt-0.5">
            按项目查看日预算和实际消耗，对异常项目发起 RTA 诊断
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs text-ink-500">
          <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-1.5 h-1.5 rounded-full bg-rose-400"></span>
            异常项目
            <span class="num text-ink-800 font-medium">{{ abnormalCount }}</span>
          </span>
          <span class="text-ink-300">·</span>
          <span>本页共 <span class="num text-ink-800 font-medium">{{ rows.length }}</span> 个项目</span>
        </div>
      </div>
    </header>

    <!-- 筛选条 -->
    <div class="bg-white rounded-lg shadow-panel border border-ink-200 mb-4">
      <div class="flex items-center gap-2 px-3 h-12">
        <div
          class="flex items-center gap-2 h-8 px-2.5 bg-ink-50 border border-ink-200 rounded text-sm flex-1 max-w-xs focus-within:border-teal-400 focus-within:bg-white"
        >
          <Search :size="14" class="text-ink-400" />
          <input
            type="text"
            placeholder="搜索项目名称 / ID"
            class="flex-1 bg-transparent outline-none placeholder-ink-400 text-ink-800"
          />
        </div>
        <button class="btn-default">
          <Filter :size="14" />
          筛选
        </button>
        <div class="ml-auto flex items-center gap-2 text-xs text-ink-500">
          <span>媒体：</span>
          <button class="btn-default">巨量</button>
          <span>日期：</span>
          <button class="btn-default">
            <span class="num">2026-08-14</span>
          </button>
          <button class="btn-ghost">
            <RefreshCw :size="14" />
            刷新
          </button>
        </div>
      </div>
    </div>

    <!-- 列表卡片 -->
    <div class="bg-white rounded-lg shadow-panel border border-ink-200 overflow-hidden">
      <table class="w-full table-fixed">
        <colgroup>
          <col class="w-[160px]" />
          <col class="w-[180px]" />
          <col />
          <col class="w-[120px]" />
          <col class="w-[110px]" />
          <col class="w-[110px]" />
          <col class="w-[180px]" />
          <col class="w-[120px]" />
          <col class="w-[140px]" />
        </colgroup>
        <thead>
          <tr>
            <th class="t-th">媒体</th>
            <th class="t-th">账户</th>
            <th class="t-th">项目</th>
            <th class="t-th">诊断日期</th>
            <th class="t-th text-right">日预算</th>
            <th class="t-th text-right">实际消耗</th>
            <th class="t-th">预算达成率</th>
            <th class="t-th">异常状态</th>
            <th class="t-th text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in rows"
            :key="row.project.projectId"
            class="hover:bg-ink-50/50 transition-colors"
          >
            <!-- 媒体 -->
            <td class="t-td">
              <div class="flex items-center gap-1.5">
                <span
                  class="inline-block w-1.5 h-1.5 rounded-full"
                  :class="row.project.abnormal ? 'bg-rose-400' : 'bg-emerald-400'"
                ></span>
                <span class="text-sm text-ink-800">巨量</span>
              </div>
            </td>

            <!-- 账户 -->
            <td class="t-td">
              <div class="flex flex-col">
                <span class="text-sm text-ink-800 truncate">{{ row.account.name }}</span>
                <span class="text-2xs text-ink-400 num">
                  {{ row.account.mediaSideAccountId }}
                </span>
              </div>
            </td>

            <!-- 项目 -->
            <td class="t-td">
              <div class="flex flex-col min-w-0">
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-sm font-medium text-ink-800 truncate">{{ row.project.name }}</span>
                  <span class="text-2xs text-ink-400 num shrink-0">
                    {{ row.project.projectId }}
                  </span>
                </div>
                <span class="text-2xs text-ink-400 mt-0.5">
                  {{ row.unitCount }} 投放单元 · {{ row.creativeCount }} 创意
                </span>
              </div>
            </td>

            <!-- 日期 -->
            <td class="t-td">
              <span class="num text-sm text-ink-700">{{ row.project.diagnoseDate }}</span>
            </td>

            <!-- 日预算 -->
            <td class="t-td text-right">
              <span class="num text-sm font-medium text-ink-800">
                {{ formatBudget(row.project.dailyBudget) }}
              </span>
            </td>

            <!-- 实际消耗 -->
            <td class="t-td text-right">
              <span class="num text-sm font-medium text-ink-800">
                {{ formatBudget(row.project.actualCost) }}
              </span>
            </td>

            <!-- 预算达成率 -->
            <td class="t-td">
              <div class="flex items-center gap-2">
                <ProgressBar :value="row.project.achievementRate" size="sm" class="flex-1" />
                <span class="num text-xs text-ink-700 w-9 text-right">
                  {{ formatRate(row.project.achievementRate) }}
                </span>
              </div>
            </td>

            <!-- 异常状态 -->
            <td class="t-td">
              <span
                v-if="row.project.abnormal"
                class="badge bg-rose-50 text-rose-500"
              >
                <span class="inline-block w-1 h-1 rounded-full bg-rose-400"></span>
                预算未达标
              </span>
              <span v-else class="badge bg-emerald-50 text-emerald-500">
                <span class="inline-block w-1 h-1 rounded-full bg-emerald-400"></span>
                正常
              </span>
            </td>

            <!-- 操作 -->
            <td class="t-td text-right">
              <div class="flex items-center justify-end gap-2">
                <button class="btn-ghost text-xs">查看</button>
                <button
                  v-if="row.project.abnormal"
                  class="btn-primary text-xs"
                  @click="emit('diagnose', row.project)"
                >
                  <Stethoscope :size="14" />
                  发起诊断
                </button>
                <button
                  v-else
                  class="btn-default text-xs"
                  @click="emit('diagnose', row.project)"
                >
                  <Stethoscope :size="14" />
                  复盘
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- 列表底注 -->
      <div class="flex items-center justify-between px-3 h-10 text-xs text-ink-500 border-t border-ink-100">
        <div class="flex items-center gap-2">
          <ListChecks :size="12" />
          <span>仅展示选中的媒体和日期范围</span>
        </div>
        <div class="flex items-center gap-3">
          <span>共 <span class="num font-medium text-ink-700">{{ rows.length }}</span> 项</span>
        </div>
      </div>
    </div>
  </main>
</template>
