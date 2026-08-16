import type {
  Creative,
  DeliveryListRow,
  DiagnosisReport,
  Experiment,
  MediaAccount,
  Project,
  RTABinding,
  DeliveryUnit
} from '@/types'

/**
 * Mock 数据全部为模拟数据，已脱敏、无真实客户/账户标识。
 * 所有不确定的"媒体侧"字段均标注【待核验】，真实接入前必须经联调确认。
 */

// ─── 媒体账户 ────────────────────────────────────────
export const account: MediaAccount = {
  accountId: 'M-2001',
  mediaSideAccountId: '__ADVERTISER_ID__【待核验】',
  name: '夏日电商品牌主账户',
  owner: '北京 XX 电商代理'
}

// ─── 项目（Golden Case：日预算 1000，实际消耗 300，达成率 30%）───
export const project: Project = {
  projectId: 'P-2026-SUMMER',
  mediaSideProjectId: '__PROJECT_ID__【待核验】',
  name: '夏季大促项目',
  accountId: account.accountId,
  dailyBudget: 1000,
  actualCost: 300,
  achievementRate: 0.3,
  abnormal: true,
  diagnoseDate: '2026-08-14',
  unitIds: ['U-C-001', 'U-T-001']
}

// ─── 创意 ────────────────────────────────────────────
export const creatives: Creative[] = [
  {
    creativeId: 'CR-001',
    mediaSideMaterialId: 'mid1【待核验】',
    title: '夏季大促-清凉家电组 A',
    status: 'online'
  },
  {
    creativeId: 'CR-002',
    mediaSideMaterialId: 'mid2【待核验】',
    title: '夏季大促-清凉家电组 B（新策略）',
    status: 'online'
  }
]

// ─── 投放单元 ────────────────────────────────────────
const controlStrategyBefore = {
  准入门槛: '40%',
  流量分配: '5 / 10 桶'
}
const controlStrategyAfter = { ...controlStrategyBefore }
const treatmentStrategyBefore = {
  准入门槛: '40%',
  流量分配: '5 / 10 桶'
}
const treatmentStrategyAfter = {
  准入门槛: '80%',
  流量分配: '5 / 10 桶'
}

export const units: DeliveryUnit[] = [
  {
    unitId: 'U-C-001',
    mediaSideUnitId: 'campaign_id【待核验】',
    name: '对照组：清凉家电旧策略',
    creativeIds: ['CR-001'],
    experimentRef: {
      experimentId: 'EXP-2026-08',
      groupId: 'G-CONTROL',
      groupLabel: '对照组',
      buckets: [1, 2, 5, 6, 9]
    }
  },
  {
    unitId: 'U-T-001',
    mediaSideUnitId: 'campaign_id【待核验】',
    name: '实验组：清凉家电新策略',
    creativeIds: ['CR-002'],
    experimentRef: {
      experimentId: 'EXP-2026-08',
      groupId: 'G-TREAT-A',
      groupLabel: '实验组 A',
      buckets: [3, 4, 7, 8, 10]
    }
  }
]

// ─── RTA 绑定 ────────────────────────────────────────
export const rtaBinding: RTABinding = {
  rtaId: 'juliang-rta-2086',
  internalRtaId: 'RTA-RES-2086',
  boundAccountIds: [account.accountId],
  qpsConfig: 300000,
  qpsUsed: 42800,
  status: 'online'
}

// ─── 实验（Golden Case：实验组门槛 40→80%）─────────────
export const experiment: Experiment = {
  experimentId: 'EXP-2026-08',
  name: '夏季大促清凉家电-准入门槛抬高对照实验',
  type: 'AB',
  rtaId: rtaBinding.rtaId,
  status: 'running',
  controlGroup: {
    groupId: 'G-CONTROL',
    label: '对照组（基线）',
    buckets: [1, 2, 5, 6, 9],
    strategyGroupName: '策略组 1：清凉家电旧策略',
    biddingMode: 'cpa',
    snapshot: controlStrategyAfter
  },
  treatmentGroups: [
    {
      groupId: 'G-TREAT-A',
      label: '实验组 A',
      buckets: [3, 4, 7, 8, 10],
      strategyGroupName: '策略组 1：清凉家电新策略（实验）',
      biddingMode: 'cpa',
      snapshot: treatmentStrategyAfter
    }
  ]
}

// ─── 投放管理列表 ─────────────────────────────────────
export const deliveryList: DeliveryListRow[] = [
  {
    project,
    account,
    unitCount: 2,
    creativeCount: 2
  },
  // 同行示例项（正常 vs 异常对照，便于视觉验证）
  {
    project: {
      projectId: 'P-2026-AUTUMN',
      mediaSideProjectId: '__PROJECT_ID__【待核验】',
      name: '秋季预售种草项目',
      accountId: 'M-2002',
      dailyBudget: 800,
      actualCost: 760,
      achievementRate: 0.95,
      abnormal: false,
      diagnoseDate: '2026-08-14',
      unitIds: ['U-A-001', 'U-A-002']
    },
    account: {
      accountId: 'M-2002',
      mediaSideAccountId: '__ADVERTISER_ID__【待核验】',
      name: '秋季预售主账户',
      owner: '上海 XX 数字代理'
    },
    unitCount: 2,
    creativeCount: 4
  },
  {
    project: {
      projectId: 'P-2026-MEMBER',
      mediaSideProjectId: '__PROJECT_ID__【待核验】',
      name: '会员活跃维系项目',
      accountId: 'M-2003',
      dailyBudget: 500,
      actualCost: 165,
      achievementRate: 0.33,
      abnormal: true,
      diagnoseDate: '2026-08-14',
      unitIds: ['U-M-001']
    },
    account: {
      accountId: 'M-2003',
      mediaSideAccountId: '__ADVERTISER_ID__【待核验】',
      name: '会员 CRM 主账户',
      owner: '深圳 XX 直营'
    },
    unitCount: 1,
    creativeCount: 2
  }
]

// ─── 术语表：行业黑话 → 业务解释（用于运营解释层）────────
export const glossary: Record<string, string> = {
  参竞率: '平台同意参与竞价的请求占比',
  RTA超时: '媒体没有在规定时间内收到本次决策结果',
  分桶: '按固定规则把流量分配到不同实验组',
  准入门槛: '只有模型打分高于此阈值的请求才允许参与竞价',
  RTAID: '媒体侧给广告主的 RTA 资源标识，对应一组策略和实验',
  兜底: '请求异常时执行的默认策略，防止流量完全丢失',
  命中率: '请求用户中被广告主策略命中的比例',
  放行率: '命中用户中最终被允许参与竞价的比例',
  实验组: '应用新策略或新出价规则的流量组，用于验证策略效果',
  对照组: '实验中的基线组，用于和实验组对比效果'
}

// ─── Golden Case 诊断报告 ─────────────────────────────────────
export const goldenReport: DiagnosisReport = {
  // 1. 一句话结论
  oneLiner:
    '实验组把准入门槛从 40% 调到 80%，导致参竞率从 60% 跌到 10%，实验组消耗骤降，对照组无法补量，项目日预算只跑到 30%。',

  // 2. 管理摘要（默认展示，老板/管理者视角）
  managerSummary:
    '夏季大促项目今天日预算 1000 元，目前只消耗 300 元（达成率 30%）。Agent 排查后发现：实验组在 11:50 把准入门槛从 40% 调高到 80%，12:00 生效后，实验组的参竞率从 60% 直接掉到 10%，实验单元只花了 50 元，对照单元只花了 250 元。请求量、RTA 接口和创意状态都正常，问题不在渠道流量，而在实验策略本身。建议：把实验组门槛先恢复到 60%，只在小部分流量上验证，盯住参竞率、曝光、消耗和 CPA 四个指标。',

  // 3. 影响概览
  impact: {
    budget: 1000,
    cost: 300,
    gap: 700,
    achievementRate: 0.3,
    affectedScope: '实验组 A · 5 / 10 个分桶（约 50% 项目流量）'
  },

  // 4. 原因排序
  causes: {
    primary: '实验组 A 准入门槛从 40% 上调到 80%，导致模型打分难以命中，参竞率骤降',
    secondary: '对照组维持旧策略但未跟进门槛调整，无法弥补实验组的流量损失',
    excluded: [
      'RTAID 不可用 / 媒体账户未绑定',
      'QPS 上限 / 接口超时',
      '请求量不足',
      '实验未生效 / 分桶计算失败',
      '创意下架 / 出价系数过低'
    ]
  },

  // 5. 证据时间线
  timeline: [
    { time: '00:00', label: '当日 00:00 启动', category: 'config', value: '实验组门槛 = 40%' },
    { time: '11:48', label: '实验组参竞率观察', category: 'metric', detail: '参竞率稳定在 60%' },
    {
      time: '11:50',
      label: '实验组配置变更',
      category: 'config',
      detail: '操作人：lina · 实验组 A 准入门槛 40% → 80%'
    },
    { time: '12:00', label: '新配置生效', category: 'config', detail: '实验组 A 新门槛 80% 生效' },
    {
      time: '12:05',
      label: '实验组参竞率骤降',
      category: 'metric',
      detail: '从 60% 下降至 10%',
      value: '−50pp'
    },
    {
      time: '12:30',
      label: '实验组曝光同步下滑',
      category: 'impression',
      detail: '曝光量较 11:30 下降约 80%'
    },
    {
      time: '12:00 - 18:00',
      label: '实验单元累计消耗',
      category: 'cost',
      detail: '对照单元 250 元 · 实验单元 50 元',
      value: '50 / 800 元'
    }
  ],

  // 6. 原因树（8 大节点，展示检查结果 / 是否排除 / 关键证据）
  causeTree: [
    {
      id: 'c-budget',
      category: 'budget',
      label: '预算与投放状态',
      result: 'normal',
      confidence: 95,
      impact: 'low',
      evidence: '日预算 1000 元、状态「投放中」，未触发预算耗尽停投',
      metrics: [
        { name: '日预算', value: '¥1000' },
        { name: '实际消耗', value: '¥300' },
        { name: '达成率', value: '30%' }
      ]
    },
    {
      id: 'c-binding',
      category: 'binding',
      label: '对象与 RTA 绑定',
      result: 'normal',
      confidence: 98,
      impact: 'low',
      evidence: 'RTAID 上线、媒体账户已绑定、绑定单元 2 个；RTAID 与实验一一对应',
      metrics: [
        { name: 'RTAID 状态', value: '上线' },
        { name: '绑定账户', value: '1 个' },
        { name: '已用 QPS', value: '42.8k / 300k' }
      ]
    },
    {
      id: 'c-traffic',
      category: 'traffic',
      label: '流量与请求',
      result: 'normal',
      confidence: 90,
      impact: 'low',
      evidence: '请求量平稳略升，未出现空流量；设备 ID 命中率 96%',
      metrics: [
        { name: '请求量', value: '约 1.2M' },
        { name: '设备 ID 命中率', value: '96%' }
      ]
    },
    {
      id: 'c-service',
      category: 'service',
      label: 'RTA 服务与容量',
      result: 'normal',
      confidence: 92,
      impact: 'low',
      evidence: 'P95 响应 18ms、超时率 0.4%、错误率 0.6%，均在健康范围',
      metrics: [
        { name: 'P95 耗时', value: '18ms' },
        { name: '超时率', value: '0.4%' }
      ]
    },
    {
      id: 'c-experiment',
      category: 'experiment',
      label: '实验与分桶',
      result: 'normal',
      confidence: 90,
      impact: 'low',
      evidence: '实验中、分桶 1-10 全部生效、对照组与实验组流量各占 50%',
      metrics: [
        { name: '实验状态', value: '运行中' },
        { name: '分桶生效', value: '10 / 10' }
      ]
    },
    {
      id: 'c-strategy',
      category: 'strategy',
      label: '策略与参竞',
      result: 'abnormal',
      confidence: 92,
      impact: 'high',
      evidence:
        '实验组门槛 80% 把大量请求挡在外面，参竞率从 60% 跌至 10%；对照组门槛 40% 未变，未能补量',
      metrics: [
        { name: '实验组参竞率', value: '60% → 10%' },
        { name: '对照组参竞率', value: '60%' },
        { name: '实验组命中率', value: '12%' }
      ]
    },
    {
      id: 'c-bidding',
      category: 'bidding',
      label: '媒体竞价与投放',
      result: 'abnormal',
      confidence: 80,
      impact: 'medium',
      evidence: '实验组曝光同步下滑约 80%；出价系数未调整，CPA 出价仍为 28 元',
      metrics: [
        { name: '实验组曝光', value: '−80%' },
        { name: 'CPA 出价', value: '¥28' }
      ]
    },
    {
      id: 'c-attribution',
      category: 'attribution',
      label: '归因与回传',
      result: 'normal',
      confidence: 85,
      impact: 'low',
      evidence: '回传成功率 99.2%、归因口径无变化；不影响本次诊断结论',
      metrics: [
        { name: '回传成功率', value: '99.2%' }
      ]
    }
  ],

  // 7. 建议方案
  recommendations: [
    {
      id: 'rec-1',
      action: '把实验组 A 准入门槛从 80% 下调到 60%',
      before: '实验组 A 准入门槛 = 80%（11:50 生效）',
      after: '实验组 A 准入门槛 = 60%',
      impact: '实验组 A（5 / 10 个分桶，约 50% 项目流量）',
      observeMetrics: [
        '实验组参竞率（应回升至 50%+）',
        '实验组曝光与消耗',
        '实验组 CPA（目标 ≤ ¥30）',
        '对照组表现（确认未被拉走预算）'
      ],
      successCriteria: '2 小时内参竞率回到 50% 以上、消耗较当前 +50%、CPA 不恶化超过 10%',
      rollbackCondition:
        '若 2 小时内参竞率仍 < 30% 或 CPA 较当前恶化超过 20%，立刻把门槛恢复到 80% 并停止放量'
    },
    {
      id: 'rec-2',
      action: '仅对 30% 实验组流量试跑，观察 2 小时',
      before: '实验组全量 50% 项目流量',
      after: '实验组仅保留 30% 项目流量（分桶 3、7、10）',
      impact: '降低策略异常对整体预算达成的影响',
      observeMetrics: [
        '30% 子桶的参竞率',
        '子桶曝光曲线',
        '项目总消耗与达成率'
      ],
      successCriteria: '子桶参竞率 ≥ 40% 且项目总消耗较当前 +30%',
      rollbackCondition: '子桶参竞率 < 25% 持续 1 小时，立刻恢复原分桶'
    }
  ],

  // 8. 技术详情（默认折叠）
  technical: {
    rtaId: rtaBinding.rtaId,
    experimentId: experiment.experimentId,
    controlGroupId: experiment.controlGroup.groupId,
    treatmentGroupId: experiment.treatmentGroups[0].groupId,
    bucketIds: experiment.treatmentGroups[0].buckets,
    requestId: 'req-20260814T120530Z-b0d7a2',
    logFieldPath: 'rta.execution_log → strategy_group[0] → treatment_A',
    configBefore: treatmentStrategyBefore,
    configAfter: treatmentStrategyAfter,
    dataSource: 'rta-execution-log + media-report-2026-08-14',
    dataUpdatedAt: '2026-08-14 18:42:11'
  }
}
