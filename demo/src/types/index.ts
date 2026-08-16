/**
 * 业务类型定义
 * --------------------------
 * 所有字段命名遵守"业务可读"原则：
 * - 媒体内部 ID：mediaXxxId（如 mediaAccountId）
 * - 媒体侧 ID：mediaSideXxxId（带厂商前缀，标注为待核验字段）
 * - 平台内部 ID：xxxId（如 projectId）
 *
 * 真实 RTAID/分桶字段与媒体侧映射规则受限于各家媒体不同字段口径，
 * 因此将不确定的口径（媒体侧 RTAID、bucket 字段、合同字段值）标记为【待核验】。
 */

export type Media = 'juliang' // 巨量（本 mock 单一媒体）
export type ExperimentType = 'AB' | 'NORMAL'

export interface MediaAccount {
  /** 平台内部账户 ID */
  accountId: string
  /** 媒体侧账户 ID（待核验：实际字段为 ADVERTISER_ID / __ADVERTISER_ID__） */
  mediaSideAccountId: string
  name: string
  /** 主体/代理商（脱敏） */
  owner: string
}

export interface Creative {
  creativeId: string
  /** 媒体侧素材 ID（中文字段标 bid，待核验：mid1/mid2/mid3） */
  mediaSideMaterialId: string
  title: string
  status: 'online' | 'paused'
}

export interface DeliveryUnit {
  unitId: string
  /** 媒体侧单元 ID（待核验：campaign_id / adgroup_id 实际映射） */
  mediaSideUnitId: string
  name: string
  creativeIds: string[]
  /** 当前是否在 RTA 实验内 */
  experimentRef?: {
    experimentId: string
    groupId: string // 对照组 / 实验组 A
    groupLabel: string
    /** 分桶号 1-10 */
    buckets: number[]
  }
}

export interface Project {
  projectId: string
  /** 媒体侧项目 ID（待核验：projectid / smart_project_id / unit_id） */
  mediaSideProjectId: string
  name: string
  accountId: string
  dailyBudget: number // 元
  actualCost: number // 元
  /** 预算达成率：0-1 */
  achievementRate: number
  abnormal: boolean
  diagnoseDate: string // YYYY-MM-DD
  unitIds: string[]
}

export interface RTABinding {
  /** 媒体侧 RTAID（标注【待核验】，实际形态需联调确认） */
  rtaId: string
  /** 内部 RTA 资源 ID */
  internalRtaId: string
  /** 绑定账户 */
  boundAccountIds: string[]
  /** 配置 QPS */
  qpsConfig: number
  /** 实验已占用 QPS */
  qpsUsed: number
  /** 状态 */
  status: 'online' | 'offline'
}

export interface ExperimentGroup {
  groupId: string
  label: string // 对照组 / 实验组 A
  /** 分桶集合 */
  buckets: number[]
  /** 策略组 */
  strategyGroupName: string
  /** 出价方式 */
  biddingMode: 'priceWeight' | 'cpa' | 'cpc'
  /** 当前配置的关键参数快照 */
  snapshot: Record<string, string | number>
}

export interface Experiment {
  experimentId: string
  name: string
  type: ExperimentType
  rtaId: string
  status: 'running' | 'paused' | 'finished'
  /** 对照组（基线） */
  controlGroup: ExperimentGroup
  /** 实验组（可能有多个，本 mock 取 1 个） */
  treatmentGroups: ExperimentGroup[]
}

export interface DeliveryListRow {
  project: Project
  account: MediaAccount
  unitCount: number
  creativeCount: number
}

export type DiagnosisStatus =
  | 'idle' // 未发起
  | 'reading' // 读取数据中
  | 'diagnosing' // 诊断中
  | 'completed' // 诊断完成（待人工确认）
  | 'pending_execute' // 等待人工执行
  | 'waiting_data' // 等待数据回流
  | 'reviewed' // 复盘完成
  | 'insufficient' // 数据不足
  | 'failed' // 诊断失败

export interface TimelineEvent {
  time: string // HH:mm
  label: string
  category: 'config' | 'metric' | 'impression' | 'cost'
  detail?: string
  value?: string
}

export type CauseCategory =
  | 'budget'
  | 'binding'
  | 'traffic'
  | 'service'
  | 'experiment'
  | 'strategy'
  | 'bidding'
  | 'attribution'

export interface CauseNode {
  id: string
  category: CauseCategory
  label: string
  /** 检查结论：正常 / 异常 / 已排除 */
  result: 'normal' | 'abnormal' | 'excluded'
  confidence: number // 0-100
  impact: 'high' | 'medium' | 'low'
  evidence: string
  metrics?: { name: string; value: string }[]
}

export interface Recommendation {
  id: string
  action: string
  before: string
  after: string
  /** 影响范围（流量占比 / 实验组） */
  impact: string
  /** 观察指标 */
  observeMetrics: string[]
  /** 成功标准 */
  successCriteria: string
  /** 回滚条件 */
  rollbackCondition: string
}

export interface DiagnosisReport {
  /** 一句话结论 */
  oneLiner: string
  /** 管理摘要 */
  managerSummary: string
  /** 影响概览 */
  impact: {
    budget: number
    cost: number
    gap: number
    achievementRate: number
    affectedScope: string
  }
  /** 原因排序：主因 / 次因 / 已排除 */
  causes: {
    primary: string
    secondary: string
    excluded: string[]
  }
  /** 证据时间线 */
  timeline: TimelineEvent[]
  /** 原因树 */
  causeTree: CauseNode[]
  /** 建议方案 */
  recommendations: Recommendation[]
  /** 技术字段（默认折叠） */
  technical: {
    rtaId: string
    experimentId: string
    controlGroupId: string
    treatmentGroupId: string
    bucketIds: number[]
    requestId: string
    logFieldPath: string
    configBefore: Record<string, string | number>
    configAfter?: Record<string, string | number>
    dataSource: string
    dataUpdatedAt: string
  }
}
