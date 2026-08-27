// F-056 S5 · exact-title-phrase override — unit tests for the phrase extractor.
// S5 in f056-coherence-offline covers "step 1" end-to-end; these cover the
// other ordinal words the override must recognise (v2, part 3, phase 2, ...).
import test from 'node:test';
import assert from 'node:assert/strict';
import { SearchEngine } from '../src/core/search.mjs';

function extractor() {
  // _exactTitlePhraseFromQuery only reads the query string; a bare instance is enough.
  return Object.create(SearchEngine.prototype);
}

test('exact-title phrase: recognises step/part/v/version + numeral', () => {
  const e = extractor();
  assert.equal(e._exactTitlePhraseFromQuery('pgvector setup step 1'), 'step 1');
  assert.equal(e._exactTitlePhraseFromQuery('deploy part 3'), 'part 3');
  assert.equal(e._exactTitlePhraseFromQuery('migration v2'), 'v 2');
  assert.equal(e._exactTitlePhraseFromQuery('rollout phase 2'), 'phase 2');
  assert.equal(e._exactTitlePhraseFromQuery('setup version 5'), 'version 5');
});

test('exact-title phrase: returns null for queries without ordinals', () => {
  const e = extractor();
  assert.equal(e._exactTitlePhraseFromQuery('how to fix auth bug'), null);
  assert.equal(e._exactTitlePhraseFromQuery('pgvector setup'), null);
  assert.equal(e._exactTitlePhraseFromQuery(''), null);
  assert.equal(e._exactTitlePhraseFromQuery('just a number 42 alone'), null);
});

test('exact-title phrase: numeral must directly follow the ordinal word', () => {
  const e = extractor();
  assert.equal(e._exactTitlePhraseFromQuery('step number one'), null, 'spelled-out, not digit');
  assert.equal(e._exactTitlePhraseFromQuery('step 1 in docs'), 'step 1');
  // "step1" (no space) is matched as "step 1" by \s* — but that's harmless:
  // the override compares title.includes('step 1') (with space), so a title
  // "step1" never triggers it. We assert the extractor's output here and the
  // non-trigger property in the S5 end-to-end test.
  assert.equal(e._exactTitlePhraseFromQuery('step1 no space'), 'step 1');
});
