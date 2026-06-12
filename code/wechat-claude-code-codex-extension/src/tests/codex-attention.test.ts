import test from 'node:test';
import assert from 'node:assert/strict';
import { needsUserAttention } from '../codex/provider.js';

test('needsUserAttention detects approval and permission waits', () => {
  assert.equal(needsUserAttention('waiting for approval before running command'), true);
  assert.equal(needsUserAttention('permission required before proceeding'), true);
  assert.equal(needsUserAttention('sandbox blocked this command'), true);
});

test('needsUserAttention ignores ordinary progress text', () => {
  assert.equal(needsUserAttention('Codex is still processing the request'), false);
});
