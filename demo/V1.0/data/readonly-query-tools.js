(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.RTAReadOnlyTools = Object.freeze(api);
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TOOL_NAMES = Object.freeze([
    'metrics',
    'trend',
    'group_compare',
    'config_changes',
    'diagnosis_evidence'
  ]);

  const INTENT_TO_TOOL = Object.freeze({
    metric_query: 'metrics',
    trend_query: 'trend',
    group_compare: 'group_compare',
    config_query: 'config_changes',
    evidence: 'diagnosis_evidence'
  });

  function toolNameForIntent(intent) {
    return INTENT_TO_TOOL[intent] || null;
  }

  function isAllowedTool(toolName) {
    return TOOL_NAMES.indexOf(toolName) >= 0;
  }

  function refusal(status, reason, detail, providerMeta, toolName) {
    return {
      status,
      reason,
      detail: detail || '',
      evidenceIds: [],
      rows: [],
      toolName: toolName || null,
      providerMeta: providerMeta || null
    };
  }

  function createReadOnlyToolRunner(provider) {
    if (!provider || !provider.capabilities || provider.capabilities.readOnly !== true) {
      throw new Error('A read-only Provider is required');
    }

    return Object.freeze({
      run(toolName, request, execute) {
        if (!isAllowedTool(toolName)) {
          return refusal('refused', 'tool_not_allowed', '仅允许调用只读查询工具。', null, toolName);
        }
        if (typeof execute !== 'function') {
          return refusal('insufficient', 'tool_executor_missing', '只读工具没有可执行的查询函数。', null, toolName);
        }

        let envelope;
        try {
          envelope = provider.getDataEnvelope(request);
        } catch (error) {
          return refusal('insufficient', 'provider_error', error && error.message || 'Provider 查询失败。', null, toolName);
        }

        const meta = envelope && envelope.meta || null;
        const quality = meta && meta.qualityStatus;
        if (quality === 'conflict') {
          return refusal('conflict', 'provider_conflict', (meta.conflicts || []).join('；') || 'Provider 返回数据存在冲突。', meta, toolName);
        }
        if (quality === 'stale' || quality === 'partial' || quality === 'insufficient' || (meta && meta.missingFields && meta.missingFields.length)) {
          return refusal('insufficient', 'provider_data_insufficient', (meta.missingFields || []).join('、') || 'Provider 返回数据不足或已过期。', meta, toolName);
        }

        const result = execute(envelope);
        if (!result || typeof result !== 'object') {
          return refusal('insufficient', 'tool_result_missing', '只读工具没有返回结构化结果。', meta, toolName);
        }
        return Object.assign({}, result, {
          toolName,
          providerContractVersion: envelope.contractVersion,
          providerMeta: meta
        });
      }
    });
  }

  return Object.freeze({ TOOL_NAMES, INTENT_TO_TOOL, toolNameForIntent, isAllowedTool, createReadOnlyToolRunner });
});
