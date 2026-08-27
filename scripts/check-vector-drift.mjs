#!/usr/bin/env node
// F-088 · Is our copy of the ERC-8350 conformance vectors still the protocol's copy?
//
// test/anchoring-golden.test.mjs pins the vendored math against
// test/fixtures/erc8350-vectors-v2.json. That catches drift in OUR math. It cannot
// catch drift in the PROTOCOL's vectors, because the fixture is a copy and a copy
// cannot notice that its source changed. This script asks that second question.
//
// It is deliberately NOT part of `npm test`. Every other check in this package is
// offline and dependency-free; this one needs a network hop. Fusing them would mean
// the suite could no longer say which kind of claim a red result refutes — a red would
// be ambiguous between "the math is wrong" and "GitHub was slow". Same discipline the
// protocol's own interop note §6.2 arrived at from two other directions.
//
// Exit codes are three-valued on purpose, because "the vectors differ" and "I could not
// find out" are different facts and a boolean destroys the one you need:
//
//   0  MATCH       — byte-identical to the published vectors
//   1  DRIFT       — the protocol changed its vectors; ours is stale, act on it
//   2  UNREACHABLE — could not fetch; nothing was learned, do NOT read as MATCH
//
// Usage: node scripts/check-vector-drift.mjs [--ref <git-ref>]

import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(HERE, '..', 'test', 'fixtures', 'erc8350-vectors-v2.json');
const TIMEOUT_MS = 15_000;

const EXIT = {MATCH: 0, DRIFT: 1, UNREACHABLE: 2};

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function parseArgs(argv) {
  let ref = 'main';
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--ref') {
      ref = argv[i + 1];
      if (!ref) throw new Error('--ref requires a value');
      i += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argv[i]}`);
  }
  return {ref};
}

async function main() {
  const {ref} = parseArgs(process.argv.slice(2));
  const url =
    `https://raw.githubusercontent.com/AwareLiquid/ERC-8350/${ref}/test-vectors/v2.json`;

  let local;
  try {
    local = readFileSync(FIXTURE);
  } catch (error) {
    // A missing fixture is our defect, not an unreachable upstream. Distinct from both.
    console.error(`local fixture unreadable: ${FIXTURE} (${error.code ?? error.message})`);
    return EXIT.DRIFT;
  }

  let remote;
  try {
    const response = await fetch(url, {signal: AbortSignal.timeout(TIMEOUT_MS)});
    if (!response.ok) {
      // A 404 is worth separating in the message: it usually means the path moved,
      // which is itself drift-shaped, but this script did not verify anything, so it
      // still exits UNREACHABLE rather than guessing.
      console.error(`UNREACHABLE — ${response.status} ${response.statusText} for ${url}`);
      console.error('  nothing was verified; this is not a pass');
      return EXIT.UNREACHABLE;
    }
    remote = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.error(`UNREACHABLE — ${error.name}: ${error.message}`);
    console.error('  nothing was verified; this is not a pass');
    return EXIT.UNREACHABLE;
  }

  const localDigest = sha256(local);
  const remoteDigest = sha256(remote);

  if (localDigest === remoteDigest) {
    console.log(`MATCH — fixture is byte-identical to ${ref}:test-vectors/v2.json`);
    console.log(`  sha256 ${localDigest}`);
    return EXIT.MATCH;
  }

  console.error('DRIFT — the protocol vectors have changed and our fixture is stale');
  console.error(`  local  sha256 ${localDigest}`);
  console.error(`  remote sha256 ${remoteDigest}`);
  console.error(`  fix: curl -sSL ${url} -o ${path.relative(process.cwd(), FIXTURE)}`);
  console.error('  then re-run the golden test — a passing suite after a vector change');
  console.error('  is the interesting case, not the boring one.');
  return EXIT.DRIFT;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`check-vector-drift failed: ${error.message}`);
    process.exit(EXIT.UNREACHABLE);
  },
);
