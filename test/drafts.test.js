import test from 'node:test';
import assert from 'node:assert/strict';
import { resetDrafts } from '../public/drafts.js';

test('leaving a mission clears drafts without attempting to restore absent notes', () => {
  const inputs = { tuner: 907, notes: 'Previous calculation' };
  resetDrafts(inputs, undefined, null);
  assert.deepEqual(inputs, {});
  resetDrafts(inputs);
  assert.deepEqual(inputs, {});
});

test('matching mission notes restore without retaining old device inputs', () => {
  const inputs = { tuner: 907, 'tuner:bandwidth': 'wide', decoder: '117' };
  resetDrafts(inputs, 'current', { missionId: 'current', text: 'One cell' });
  assert.deepEqual(inputs, { notes: 'One cell' });
});

test('new missions and the lobby do not inherit notes from another mission', () => {
  const notes = { missionId: 'previous', text: 'Old serial' };
  for (const missionId of ['current', null, undefined]) {
    const inputs = { notes: notes.text };
    resetDrafts(inputs, missionId, notes);
    assert.deepEqual(inputs, {});
  }
});
