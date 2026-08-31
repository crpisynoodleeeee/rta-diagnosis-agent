(function (root, factory) { if (typeof module === 'object' && module.exports) module.exports = factory(); else root.V10Audit = factory(); }(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function createAudit() { var events = [], seq = 0;
    function recordAudit(e) { var x = Object.assign({}, e, { evidenceIds: e.evidenceIds || [], _seq: ++seq, timestamp: e.timestamp || new Date().toISOString() }); if (x.result === 'denied' && !x.error && !x.reason) throw new Error('denied audit requires error/reason'); events.push(x); return x; }
    function getTimeline(q) { q = q || {}; return events.filter(function (e) { return (!q.taskId || e.taskId === q.taskId) && (!q.operator || e.operator === q.operator) && (!q.role || e.role === q.role) && (!q.tenantId || e.context && e.context.tenantId === q.tenantId); }).slice().sort(function(a,b){ return new Date(a.timestamp)-new Date(b.timestamp) || a._seq-b._seq; }); }
    return { recordAudit: recordAudit, getTimeline: getTimeline, _events: events };
  }
  var singleton = createAudit(); singleton.createAudit = createAudit; return singleton;
}));
