(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.V10Roles = factory(); }(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var ROLES = ['observer', 'optimizer', 'approver'];
  var all = ['view_task','view_diagnosis','view_evidence','view_audit','view_review'];
  var optimizer = ['confirm_diagnosis','create_draft','edit_draft','submit_draft','record_execution'];
  var approver = ['approve','reject','approve_draft_execution'];
  var PERMISSIONS = {}; ROLES.forEach(function (r) { PERMISSIONS[r] = {}; all.forEach(function (a) { PERMISSIONS[r][a] = true; }); });
  optimizer.forEach(function (a) { PERMISSIONS.optimizer[a] = true; }); approver.forEach(function (a) { PERMISSIONS.approver[a] = true; });
  function checkPermission(role, action) { return PERMISSIONS[role] && PERMISSIONS[role][action] ? { allow: true } : { allow: false, reason: 'permission_denied' }; }
  function assertAuthorized(role, action) { var r = checkPermission(role, action); return r.allow ? { ok: true } : { ok: false, error: 'PERMISSION_DENIED', action: action, role: role }; }
  return { ROLES: ROLES, PERMISSIONS: PERMISSIONS, checkPermission: checkPermission, assertAuthorized: assertAuthorized };
}));
