<script setup lang="ts">
import {
  CheckCheck,
  Pencil,
  X,
  AlertCircle,
  RefreshCw,
  Loader2,
  Hourglass,
  Database,
  CheckCircle2,
  PlayCircle,
  BarChart3,
  ChevronRight
} from 'lucide-vue-next'
import { computed, ref } from 'vue'
import type { DiagnosisReport, DiagnosisStatus, Project } from '@/types'
import ProgressBar from '@/components/common/ProgressBar.vue'
import StatusBadge from '@/components/common/StatusBadge.vue'
import FieldRow from '@/components/common/FieldRow.vue'
import ExpandToggle from '@/components/common/ExpandToggle.vue'
import EvidenceTimeline from './EvidenceTimeline.vue'
import CauseTree from './CauseTree.vue'
import TechnicalDetail from './TechnicalDetail.vue'
import { glossary } from '@/data/mock'

const props = defineProps<{
  open: boolean
  status: DiagnosisStatus
  project: Project | null
  report: DiagnosisReport
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'approve'): void
  (e: 'modify'): void
  (e: 'reject'): void
  (e: 'retry'): void
  (e: 'markExecuted'): void
  (e: 'markReviewed'): void
}>()

const showOperational = ref(true)
const showTechnical = ref(false)
const expandedCauseIds = ref<Set<string>>(new Set())
const activeRecId = ref(props.report.recommendations[0]?.id ?? '')

function toggleCause(id: string) {
  // 这里我们让它"展开/收起"，但实现细节在 CauseTree 内部展开态不维护；
  // 简单做法：点击无副作用，告诉用户已展示
  if (expandedCauseIds.value.has(id)) expandedCauseIds.value.delete(id)
  else expandedCauseIds.value.add(id)
}

const activeRec = computed(() =>
  props.report.recommendations.find((r) => r.id === activeRecId.value) ?? props.report.recommendations[0]
)

const canApprove = computed(() => props.status === 'completed')
const canModify = computed(() => props.status === 'completed')
const canReject = computed(() => props.status === 'completed')
const canMarkExecuted = computed(() => props.status === 'pending_execute')
const canMarkReviewed = computed(() => props.status === 'waiting_data')

const isProcessing = computed(
  () => props.status === 'reading' || props.status === 'diagnosing'
)

function formatYuan(n: number): string {
  return '¥' + n.toLocaleString('zh-CN')
}
function formatPp(...vals: (string | number)[]): string {
  return vals.join('')
}
</script>

<template>
  <Transition name="fade">
    <div
      v-if="open"
      class="fixed inset-0 z-40 bg-ink-900/30"
      @click.self="emit('close')"
    />
  </Transition>

  <Transition name="drawer-slide">
    <aside
      v-if="open"
      class="fixed top-0 right-0 bottom-0 z-50 bg-white shadow-drawer flex flex-col"
      style="width: 720px"
      role="dialog"
      aria-label="RTA 诊断面板"
    >
      <!-- ============ 抽屉头部 ============ -->
      <header class="px-5 py-3 border-b border-ink-200 bg-white shrink-0">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div class="flex items-center gap-2 text-xs text-ink-500 mb-1">
              <span>巨量</span>
              <ChevronRight :size="12" />
              <span>夏季大促项目</span>
              <ChevronRight :size="12" />
              <span>实验组 A · 投放单元 U-T-001</span>
            </div>
            <h2 class="text-base font-semibold text-ink-800 tracking-tight flex items-center gap-2">
              <span class="inline-flex items-center justify-center w-6 h-6 rounded bg-teal-50 text-teal-600">
                <PlayCircle :size="14" />
              </span>
              RTA 诊断
              <StatusBadge v-if="status" :status="status" size="sm" />
            </h2>
          </div>
          <button
            class="btn-ghost"
            aria-label="关闭"
            @click="emit('close')"
          >
            <X :size="14" />
          </button>
        </div>

        <!-- 上下文字段条 -->
        <div
          v-if="!isProcessing && status !== 'idle' && status !== 'failed'"
          class="grid grid-cols-4 gap-x-3 gap-y-1.5 mt-3 px-3 py-2 bg-ink-50 rounded-md border border-ink-200"
        >
          <FieldRow label="诊断日期" value="2026-08-14" />
          <FieldRow label="RTAID" value="2086（巨量）" />
          <FieldRow label="实验 ID" value="EXP-2026-08" />
          <FieldRow label="活动类型" value="AB 实验" />
        </div>
      </header>

      <!-- ============ 处理进度（诊断中态） ============ -->
      <div
        v-if="isProcessing"
        class="flex-1 flex flex-col items-center justify-center px-10 py-12 text-center"
      >
        <div class="relative w-16 h-16 mb-5">
          <span class="absolute inset-0 rounded-full bg-sky-50"></span>
          <span class="absolute inset-2 rounded-full bg-sky-100"></span>
          <span
            class="absolute inset-0 rounded-full border-2 border-sky-200 border-t-sky-500"
            style="animation: spin 1s linear infinite"
          ></span>
          <span class="absolute inset-0 flex items-center justify-center text-sky-600">
            <Loader2 :size="22" class="animate-spin" />
          </span>
        </div>
        <h3 class="text-base font-semibold text-ink-800 mb-1.5">
          {{
            status === 'reading'
              ? '正在读取策略、实验、QPS 与执行日志…'
              : 'Agent 正在综合多信号判断跑量根因…'
          }}
        </h3>
        <p class="text-sm text-ink-500 max-w-sm leading-relaxed">
          {{
            status === 'reading'
              ? '已确认项目、媒体账户、RTAID、实验配置，正在拉取近 24 小时请求、命中、参竞和消耗数据。'
              : '正在交叉比对实验组 / 对照组参竞率、曝光与消耗曲线，逐步收缩可疑根因。'
          }}
        </p>
        <div class="w-64 mt-6">
          <div class="h-1 bg-ink-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-sky-500 rounded-full"
              :class="status === 'reading' ? 'w-1/3' : 'w-2/3'"
              :style="{ transition: 'width 1.2s ease-in-out' }"
            ></div>
          </div>
          <div class="flex justify-between mt-1.5 text-2xs text-ink-400 num">
            <span>读取数据</span>
            <span>综合诊断</span>
            <span>输出方案</span>
          </div>
        </div>
      </div>

      <!-- ============ 数据不足 ============ -->
      <div
        v-else-if="status === 'insufficient'"
        class="flex-1 flex flex-col items-center justify-center px-10 py-12 text-center"
      >
        <AlertCircle :size="36" class="text-ink-300 mb-4" />
        <h3 class="text-base font-semibold text-ink-800 mb-2">当前数据不足以判断根因</h3>
        <p class="text-sm text-ink-500 max-w-sm mb-6 leading-relaxed">
          实验组近 1 小时请求量较低，且执行日志缺失；建议等待 30 分钟或补充监控后重新诊断。
        </p>
        <button class="btn-default" @click="emit('retry')">
          <RefreshCw :size="14" />
          30 分钟后重新诊断
        </button>
      </div>

      <!-- ============ 诊断失败 ============ -->
      <div
        v-else-if="status === 'failed'"
        class="flex-1 flex flex-col items-center justify-center px-10 py-12 text-center"
      >
        <X :size="36" class="text-rose-400 mb-4" />
        <h3 class="text-base font-semibold text-ink-800 mb-2">诊断未通过</h3>
        <p class="text-sm text-ink-500 max-w-sm mb-6 leading-relaxed">
          信号冲突或被人工拒绝；可以查看上下文或重新发起诊断。
        </p>
        <div class="flex items-center gap-2">
          <button class="btn-default" @click="emit('close')">查看历史</button>
          <button class="btn-primary" @click="emit('retry')">
            <RefreshCw :size="14" />
            重新诊断
          </button>
        </div>
      </div>

      <!-- ============ 未发起 ============ -->
      <div
        v-else-if="status === 'idle'"
        class="flex-1 flex flex-col items-center justify-center px-10 py-12 text-center"
      >
        <PlayCircle :size="36" class="text-ink-300 mb-4" />
        <h3 class="text-base font-semibold text-ink-800 mb-2">诊断尚未发起</h3>
        <p class="text-sm text-ink-500 max-w-sm leading-relaxed">
          请回到投放列表选择项目，点击「发起诊断」开始一次新的诊断。
        </p>
      </div>

      <!-- ============ 等待人工执行 ============ -->
      <div
        v-else-if="status === 'pending_execute'"
        class="flex-1 flex items-center justify-center px-10"
      >
        <div class="text-center max-w-md">
          <Hourglass :size="36" class="text-amber-500 mx-auto mb-4" />
          <h3 class="text-base font-semibold text-ink-800 mb-2">已生成配置草稿，等待人工执行</h3>
          <p class="text-sm text-ink-500 mb-5 leading-relaxed">
            本次诊断仅生成策略草稿，<strong class="text-amber-600">未修改任何真实预算或出价</strong>。
            请到 策略工厂 / RTA 实验页面审批通过该变更。
          </p>
          <div class="rounded-md border border-ink-200 bg-ink-50 p-3 text-left mb-5">
            <p class="text-xs text-ink-700 leading-relaxed">
              <span class="font-medium text-ink-800">草稿摘要：</span>
              实验组 A 准入门槛 80% → 60%（先小流量试跑），观察参竞率、曝光、消耗、CPA 四项指标。
            </p>
          </div>
          <button class="btn-primary" @click="emit('markExecuted')">
            <CheckCircle2 :size="14" />
            我已执行，等待数据回流
          </button>
        </div>
      </div>

      <!-- ============ 等待数据回流 ============ -->
      <div
        v-else-if="status === 'waiting_data'"
        class="flex-1 flex items-center justify-center px-10"
      >
        <div class="text-center max-w-md">
          <Database :size="36" class="text-sky-500 mx-auto mb-4" />
          <h3 class="text-base font-semibold text-ink-800 mb-2">策略已生效，正在等待数据回流</h3>
          <p class="text-sm text-ink-500 mb-5 leading-relaxed">
            期望 2 小时内观察到实验组参竞率回升、消耗增长。回流数据齐全后将自动进入复盘。
          </p>
          <div class="grid grid-cols-3 gap-2 text-left mb-5">
            <div class="rounded-md border border-ink-200 p-2.5 bg-white">
              <p class="text-2xs text-ink-500">实验组参竞率</p>
              <p class="num text-base font-medium text-emerald-500 mt-0.5">10% → 48%</p>
            </div>
            <div class="rounded-md border border-ink-200 p-2.5 bg-white">
              <p class="text-2xs text-ink-500">实验组消耗</p>
              <p class="num text-base font-medium text-emerald-500 mt-0.5">+62%</p>
            </div>
            <div class="rounded-md border border-ink-200 p-2.5 bg-white">
              <p class="text-2xs text-ink-500">实验组 CPA</p>
              <p class="num text-base font-medium text-ink-700 mt-0.5">¥31</p>
            </div>
          </div>
          <div class="flex items-center justify-center gap-2">
            <button class="btn-default" @click="emit('markReviewed')">手动完成复盘</button>
          </div>
        </div>
      </div>

      <!-- ============ 复盘完成 ============ -->
      <div
        v-else-if="status === 'reviewed'"
        class="flex-1 flex items-center justify-center px-10"
      >
        <div class="text-center max-w-md">
          <CheckCircle2 :size="36" class="text-emerald-500 mx-auto mb-4" />
          <h3 class="text-base font-semibold text-ink-800 mb-2">复盘完成 · 实验已归档</h3>
          <p class="text-sm text-ink-500 mb-5 leading-relaxed">
            实验组 A 准入门槛调整有效，预计 24 小时内项目预算达成率回升至 80%+。
            本次诊断结果已沉淀到历史案例。
          </p>
          <div class="grid grid-cols-2 gap-2 text-left mb-5">
            <div class="rounded-md border border-ink-200 p-3 bg-white">
              <p class="text-2xs text-ink-500 mb-1">实验组最终参竞率</p>
              <p class="num text-lg font-medium text-emerald-500">62%</p>
            </div>
            <div class="rounded-md border border-ink-200 p-3 bg-white">
              <p class="text-2xs text-ink-500 mb-1">项目预算达成率</p>
              <p class="num text-lg font-medium text-emerald-500">84%</p>
            </div>
          </div>
          <div class="flex items-center justify-center gap-2">
            <button class="btn-default" @click="emit('close')">关闭</button>
            <button class="btn-default">
              <BarChart3 :size="14" />
              查看实验复盘详情
            </button>
          </div>
        </div>
      </div>

      <!-- ============ 诊断完成主区（completed） ============ -->
      <div v-else-if="status === 'completed' && report" class="flex-1 min-h-0 flex">
        <!-- 左侧：诊断正文 -->
        <div class="flex-1 min-w-0 overflow-y-auto px-5 py-5 space-y-6">
          <!-- §1 一句话结论 + 管理摘要 -->
          <section>
            <h3 class="section-title mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-teal-500 rounded-sm"></span>
              一句话结论
            </h3>
            <p class="text-sm font-medium text-ink-800 leading-relaxed bg-teal-50/60 border-l-2 border-teal-500 px-3 py-2.5 rounded">
              {{ report.oneLiner }}
            </p>
          </section>

          <!-- §2 影响概览 -->
          <section>
            <h3 class="section-title mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-teal-500 rounded-sm"></span>
              影响概览
            </h3>
            <div class="grid grid-cols-4 gap-2">
              <div class="border border-ink-200 rounded-md p-2.5">
                <p class="text-2xs text-ink-500">日预算</p>
                <p class="num text-base font-medium text-ink-800 mt-0.5">
                  {{ formatYuan(report.impact.budget) }}
                </p>
              </div>
              <div class="border border-ink-200 rounded-md p-2.5">
                <p class="text-2xs text-ink-500">实际消耗</p>
                <p class="num text-base font-medium text-ink-800 mt-0.5">
                  {{ formatYuan(report.impact.cost) }}
                </p>
              </div>
              <div class="border border-amber-200 rounded-md p-2.5 bg-amber-50/50">
                <p class="text-2xs text-amber-600">预算差额</p>
                <p class="num text-base font-medium text-amber-600 mt-0.5">
                  {{ formatYuan(report.impact.gap) }}
                </p>
              </div>
              <div class="border border-amber-200 rounded-md p-2.5 bg-amber-50/50">
                <p class="text-2xs text-amber-600">达成率</p>
                <p class="num text-base font-medium text-amber-600 mt-0.5">
                  {{ Math.round(report.impact.achievementRate * 100) }}%
                </p>
              </div>
            </div>
            <p class="text-xs text-ink-500 mt-2">
              影响范围：<span class="text-ink-700">{{ report.impact.affectedScope }}</span>
            </p>
          </section>

          <!-- §3 原因排序 -->
          <section>
            <h3 class="section-title mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-teal-500 rounded-sm"></span>
              原因排序
            </h3>
            <div class="space-y-1.5">
              <div class="flex items-baseline gap-2 text-sm leading-relaxed">
                <span class="badge bg-rose-50 text-rose-500 shrink-0">主因</span>
                <span class="text-ink-800">{{ report.causes.primary }}</span>
              </div>
              <div class="flex items-baseline gap-2 text-sm leading-relaxed">
                <span class="badge bg-amber-50 text-amber-600 shrink-0">次因</span>
                <span class="text-ink-700">{{ report.causes.secondary }}</span>
              </div>
              <div class="rounded-md bg-ink-50 border border-ink-200 px-3 py-2">
                <p class="text-xs text-ink-500 mb-1">已排除</p>
                <ul class="space-y-0.5 text-xs text-ink-500">
                  <li
                    v-for="(ex, i) in report.causes.excluded"
                    :key="i"
                    class="flex gap-1.5 items-start"
                  >
                    <span class="text-ink-400 mt-0.5">·</span>
                    <span>{{ ex }}</span>
                  </li>
                </ul>
              </div>
            </div>
          </section>

          <!-- §4 证据时间线 -->
          <section>
            <h3 class="section-title mb-3 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-teal-500 rounded-sm"></span>
              证据时间线
            </h3>
            <EvidenceTimeline :events="report.timeline" />
          </section>

          <!-- §5 原因树 -->
          <section>
            <h3 class="section-title mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-teal-500 rounded-sm"></span>
              原因树详情
            </h3>
            <p class="text-xs text-ink-500 mb-2.5">
              检查 8 个常见根因层。当前结果：<span class="text-rose-500 font-medium">2 项异常</span>，6 项正常。
            </p>
            <CauseTree
              :nodes="report.causeTree"
              @toggle="toggleCause"
            />
          </section>

          <!-- §6 建议方案 -->
          <section>
            <h3 class="section-title mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-teal-500 rounded-sm"></span>
              实验方案草稿
            </h3>
            <div class="flex gap-1.5 mb-2.5">
              <button
                v-for="rec in report.recommendations"
                :key="rec.id"
                :class="[
                  'px-2.5 h-7 text-xs font-medium rounded-md border transition-colors',
                  rec.id === activeRecId
                    ? 'border-teal-500 text-teal-700 bg-teal-50'
                    : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:text-ink-800'
                ]"
                @click="activeRecId = rec.id"
              >
                方案 #{{ rec.id.split('-')[1] }}
              </button>
            </div>
            <div v-if="activeRec" class="border border-ink-200 rounded-lg bg-white p-3 space-y-2">
              <p class="text-sm font-medium text-ink-800">{{ activeRec.action }}</p>
              <div class="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p class="text-2xs text-ink-500 mb-0.5">调整前</p>
                  <p class="num text-ink-700 leading-relaxed">{{ activeRec.before }}</p>
                </div>
                <div>
                  <p class="text-2xs text-ink-500 mb-0.5">调整后</p>
                  <p class="num text-teal-700 font-medium leading-relaxed">{{ activeRec.after }}</p>
                </div>
              </div>
              <div class="grid grid-cols-3 gap-3 text-xs pt-1.5 border-t border-ink-100">
                <div>
                  <p class="text-2xs text-ink-500 mb-0.5">影响范围</p>
                  <p class="text-ink-700 leading-relaxed">{{ activeRec.impact }}</p>
                </div>
                <div>
                  <p class="text-2xs text-ink-500 mb-0.5">成功标准</p>
                  <p class="text-ink-700 leading-relaxed">{{ activeRec.successCriteria }}</p>
                </div>
                <div>
                  <p class="text-2xs text-ink-500 mb-0.5">回滚条件</p>
                  <p class="text-ink-700 leading-relaxed">{{ activeRec.rollbackCondition }}</p>
                </div>
              </div>
              <div class="text-xs pt-1.5 border-t border-ink-100">
                <p class="text-2xs text-ink-500 mb-1">观察指标</p>
                <div class="flex flex-wrap gap-1">
                  <span
                    v-for="m in activeRec.observeMetrics"
                    :key="m"
                    class="badge bg-ink-50 text-ink-600"
                  >
                    {{ m }}
                  </span>
                </div>
              </div>
            </div>
            <p class="text-xs text-ink-500 mt-2 leading-relaxed bg-amber-50 border-l-2 border-amber-400 px-2.5 py-1.5 rounded">
              <strong class="text-amber-600">人工边界：</strong>
              该方案不会修改任何真实预算或出价。批准后仅生成待执行草稿，仍需到 策略工厂 / RTA 实验 页面人工审批。
            </p>
          </section>

          <!-- §7 技术详情（默认折叠） -->
          <section>
            <h3 class="section-title mb-2 flex items-center gap-1.5">
              <span class="w-1 h-3 bg-teal-500 rounded-sm"></span>
              人工确认与技术详情
            </h3>
            <ExpandToggle :expanded="showTechnical" @toggle="showTechnical = !showTechnical">
              {{ showTechnical ? '收起' : '展开' }}技术证据（RTAID / 实验组 / 请求 ID / 数据来源…）
            </ExpandToggle>
            <div v-if="showTechnical" class="mt-2">
              <TechnicalDetail :technical="report.technical" />
            </div>
          </section>

          <!-- 术语表（运营解释的"小抄"） -->
          <section class="border-t border-ink-200 pt-4">
            <p class="text-2xs text-ink-400 mb-2">术语对照（运营解释 ↔ 业务语言）</p>
            <div class="grid grid-cols-2 gap-x-4 gap-y-1">
              <div
                v-for="(desc, term) in glossary"
                :key="term"
                class="flex items-baseline gap-2 text-2xs leading-relaxed"
              >
                <span class="text-ink-700 font-medium shrink-0">{{ term }}</span>
                <span class="text-ink-400">— {{ desc }}</span>
              </div>
            </div>
          </section>
        </div>

        <!-- 右侧：导航锚点（帮用户快速跳转） -->
        <nav
          class="w-12 shrink-0 border-l border-ink-200 bg-ink-50/40 py-5 px-2"
          aria-label="诊断区块导航"
        >
          <ol class="space-y-3 text-2xs text-ink-500 sticky top-0">
            <li
              v-for="(label, idx) in [
                '结论',
                '影响',
                '原因',
                '时间线',
                '原因树',
                '方案',
                '技术'
              ]"
              :key="label"
              class="writing-vertical flex items-center gap-1 text-ink-500 hover:text-ink-800 cursor-pointer"
              :style="{ writingMode: 'vertical-rl' }"
            >
              <span class="num text-ink-300">{{ String(idx + 1).padStart(2, '0') }}</span>
              <span class="font-medium">{{ label }}</span>
            </li>
          </ol>
        </nav>
      </div>

      <!-- ============ 抽屉底部 ============ -->
      <footer
        v-if="
          status === 'completed' ||
          status === 'pending_execute' ||
          status === 'waiting_data'
        "
        class="px-5 py-3 border-t border-ink-200 bg-white shrink-0 flex items-center gap-2"
      >
        <div class="flex-1 text-xs text-ink-500">
          <template v-if="status === 'completed'">
            请审阅方案草稿。批准后仅生成待执行草稿，不会自动修改真实配置。
          </template>
          <template v-else-if="status === 'pending_execute'">
            等待运营人员执行配置变更。批准后系统不会自动改写任何线上数据。
          </template>
          <template v-else>
            预期 2 小时后系统将自动拉取数据并生成复盘报告。
          </template>
        </div>
        <button
          v-if="canModify"
          class="btn-default"
          @click="emit('modify')"
        >
          <Pencil :size="14" />
          修改方案
        </button>
        <button
          v-if="canReject"
          class="btn-danger"
          @click="emit('reject')"
        >
          <X :size="14" />
          拒绝
        </button>
        <button
          v-if="canApprove"
          class="btn-primary"
          @click="emit('approve')"
        >
          <CheckCheck :size="14" />
          批准方案
        </button>
        <button
          v-if="canMarkExecuted"
          class="btn-primary"
          @click="emit('markExecuted')"
        >
          <CheckCircle2 :size="14" />
          确认已执行，等待数据回流
        </button>
        <button
          v-if="canMarkReviewed"
          class="btn-primary"
          @click="emit('markReviewed')"
        >
          <CheckCircle2 :size="14" />
          手动完成复盘
        </button>
      </footer>
    </aside>
  </Transition>
</template>

<style scoped>
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.animate-spin {
  animation: spin 1s linear infinite;
}
</style>
