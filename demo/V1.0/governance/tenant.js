(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.V10Tenant = factory();
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TENANT_A = 'tenant-a', TENANT_B = 'tenant-b';
  function createTenantContext(o) {
    o = o || {};
    return { tenantId: o.tenantId, operator: o.operator, role: o.role,
      scope: 'current_rta_only', requestId: o.requestId || 'req-' + Math.random().toString(36).slice(2) };
  }
  function assertTenant(context, resourceTenantId) {
    return context && context.tenantId === resourceTenantId ? { ok: true } :
      { ok: false, error: 'CROSS_TENANT_DENIED', auditAction: 'cross_tenant_access' };
  }
  return { TENANT_A: TENANT_A, TENANT_B: TENANT_B, createTenantContext: createTenantContext, assertTenant: assertTenant };
}));
