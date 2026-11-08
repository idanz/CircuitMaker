// Let the native Python parity harness execute example assertions with the same engine.
import {readFileSync} from 'node:fs';
import {simulateScenario} from '../src/simulation-engine.js';
process.stdout.write(JSON.stringify(simulateScenario(JSON.parse(readFileSync(0,'utf8')))));
