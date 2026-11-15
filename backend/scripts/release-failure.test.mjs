import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releaseFailureDiagnostic } from './release-failure.mjs';
test('release failures retain code, step and duration without private diagnostics', () => {
  const error = {
    code: 'P2028',
    message: 'PRIVATE_SENTINEL',
    stack: 'PRIVATE_SENTINEL',
    meta: { private: 'PRIVATE_SENTINEL' },
    foundationDiagnostic: {
      step: 'permissions',
      elapsedMs: 30001,
      private: 'PRIVATE_SENTINEL',
    },
  };
  assert.deepEqual(releaseFailureDiagnostic(error), {
    code: 'P2028',
    step: 'permissions',
    elapsedMs: 30001,
  });
  assert.ok(
    !JSON.stringify(releaseFailureDiagnostic(error)).includes(
      'PRIVATE_SENTINEL',
    ),
  );
});
test('untrusted fields and invalid durations are excluded', () => {
  assert.deepEqual(
    releaseFailureDiagnostic({
      code: { toString: () => 'P2028', private: 'PRIVATE_SENTINEL' },
    }),
    { code: 'GUARD_OR_VALIDATION' },
  );
  assert.deepEqual(
    releaseFailureDiagnostic({
      code: 'PRIVATE_SENTINEL',
      foundationDiagnostic: { step: 'PRIVATE_SENTINEL' },
    }),
    { code: 'GUARD_OR_VALIDATION' },
  );
  assert.deepEqual(
    releaseFailureDiagnostic({
      foundationDiagnostic: { step: 'guards', elapsedMs: 'PRIVATE_SENTINEL' },
    }),
    { code: 'GUARD_OR_VALIDATION', step: 'guards', elapsedMs: null },
  );
});
