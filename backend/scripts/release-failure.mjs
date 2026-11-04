// Deliberately omit raw messages, SQL, arguments, connection details and stacks.
export function releaseFailureDiagnostic(error) {
  const code =
    typeof error?.code === 'string' &&
    /^(?:ENOENT|EACCES|EPERM|EINVAL|P\d{4})$/.test(error.code)
      ? error.code
      : 'GUARD_OR_VALIDATION';
  const diagnostic = error?.foundationDiagnostic;
  return {
    code,
    ...(diagnostic &&
    [
      'guards',
      'permissions',
      'permission-scopes',
      'context',
      'memberships',
      'bridge',
      'audit',
    ].includes(diagnostic.step)
      ? {
          step: diagnostic.step,
          elapsedMs:
            Number.isSafeInteger(diagnostic.elapsedMs) &&
            diagnostic.elapsedMs >= 0
              ? diagnostic.elapsedMs
              : null,
        }
      : {}),
  };
}
