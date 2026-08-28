const fs = require('fs');
const path = require('path');

const groups = [
  ['contract', './test/contract.test.cjs'],
  ['adapter', './test/adapter.test.cjs'],
  ['security', './test/security.test.cjs'],
  ['audit', './test/audit.test.cjs']
];
let failed = 0;
(async () => {
  for (const [name, file] of groups) {
    const absolute = path.join(__dirname, file);
    console.log('\n[' + name + ']');
    if (!fs.existsSync(absolute)) { console.log('  PENDING (由 2b/2c/2d 实现)'); continue; }
    try { const result = require(absolute); if (result && result.run) failed += await result.run(); }
    catch (error) { failed++; console.log('  FAIL ' + error.message); }
  }
  console.log('\nV0.9 verification: ' + (failed ? 'FAILED' : 'PASSED'));
  process.exitCode = failed ? 1 : 0;
})();
