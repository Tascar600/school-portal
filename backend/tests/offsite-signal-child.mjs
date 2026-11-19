// Used by offsite-backup.test.mjs: a stand-in for the portal that is told to stop. It starts the off-site backup, changes its
// "database" once, and then has Node deliver SIGTERM to its own handler, which is what Node does when a host sends the signal
// (a real signal cannot be sent to a process on Windows). The handler must upload the last change and exit with code 0.
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ob = require('../src/utils/offsiteBackup.ts');

let version = 0;
let data = Buffer.from('state 1');
const runner = ob.startOffsiteBackups({ snapshot: () => data, version: () => version }, process.env);
if (!runner) { console.log('NOT STARTED'); process.exit(3); }

data = Buffer.from('state 2: the last change before the host stopped the portal');
version++;
console.log('READY');
process.emit('SIGTERM');
