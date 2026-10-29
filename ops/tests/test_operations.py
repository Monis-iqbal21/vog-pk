"""Hermetic failure-path tests. No cloud access, database or service control.

Run with Python 3; on Windows set BASH to the installed Git Bash executable.
All operational commands are replaced inside a disposable fixture directory.
"""
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

OPS = Path(__file__).resolve().parents[1]
BASH = os.environ.get('BASH') or shutil.which('bash')
if not BASH:
    raise SystemExit('Bash is required')


class OperationsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='vogpk-ops-test-')
        self.root = Path(self.temp.name)
        self.bin = self.root / 'bin'
        self.bin.mkdir()
        self.state = self.root / 'state'
        self.state.mkdir()
        self.calls = self.root / 'calls'
        self.env = {**os.environ, 'CALLS': self.calls.as_posix(),
                    'BACKUP_DESTINATION_APPROVED': 'yes', 'BACKUP_REPOSITORY_DEDICATED': 'yes',
                    'RESTIC_REPOSITORY': 's3:https://example.invalid/dedicated',
                    'STATE_DIRECTORY': self.state.as_posix(), 'PGPASSWORD': '', 'DATABASE_URL': ''}
        for variable in ['RESTIC_PASSWORD_FILE', 'PGSERVICEFILE', 'PGPASSFILE']:
            file = self.root / variable
            file.write_text('non-secret fixture', encoding='utf-8')
            self.env[variable] = file.as_posix()
        stubs = {
            'id': 'if [[ $1 == -un ]]; then echo test-operator; else echo 1000; fi',
            'stat': 'if [[ $2 == %u ]]; then echo 1000; else echo "${MOCK_MODE:-600}"; fi',
            'flock': 'exit 0',
            'pg_dump': 'echo producer >>"$CALLS"; echo sample-dump; if [[ ${FAIL_PRODUCER:-no} == yes ]]; then echo SENSITIVE_TEST_DIAGNOSTIC >&2; exit 1; fi',
            'restic': '''echo "$*" >>"$CALLS"
if [[ $1 == backup ]]; then
 cat >/dev/null
 if [[ ${FAIL_RESTIC:-no} == yes ]]; then echo SENSITIVE_TEST_DIAGNOSTIC >&2; exit 1; fi
 echo '{"message_type":"summary","snapshot_id":"abcdef0123456789"}'
fi''',
            'python3': 'exec "' + Path(sys.executable).as_posix() + '" "$@"',
            'date': 'if [[ ${*: -1} == +%u ]]; then echo "${MOCK_DAY:-1}"; else echo 2026-10-30T00:00:00Z; fi',
            'systemctl': 'echo service-check >>"$CALLS"; [[ ${FAIL_SERVICE:-no} != yes ]]',
            'curl': 'echo http-check >>"$CALLS"; [[ ${FAIL_HTTP:-no} != yes ]]',
            'logger': 'echo journal-alert >>"$CALLS"',
        }
        for name, body in stubs.items():
            file = self.bin / name
            file.write_text('#!/usr/bin/env bash\n' + body + '\n', encoding='utf-8', newline='\n')
            file.chmod(0o700)

    def tearDown(self):
        self.temp.cleanup()

    def run_script(self, name, **changes):
        command = 'p="$1"; if command -v cygpath >/dev/null; then p=$(cygpath -u "$p"); fi; export PATH="$p:$PATH"; exec bash "$2"'
        return subprocess.run([BASH, '-c', command, '_', self.bin.as_posix(), (OPS / name).as_posix()],
                              env={**self.env, **changes}, text=True, capture_output=True, timeout=20)

    def call_text(self):
        return self.calls.read_text() if self.calls.exists() else ''

    def test_shell_syntax(self):
        for file in OPS.glob('*.sh'):
            result = subprocess.run([BASH, '-n', file.as_posix()], capture_output=True)
            self.assertEqual(result.returncode, 0, file.name)

    def test_unapproved_destination_refused(self):
        self.assertNotEqual(self.run_script('postgres-backup.sh', BACKUP_DESTINATION_APPROVED='no').returncode, 0)
        self.assertEqual(self.call_text(), '')

    def test_shared_repository_refused(self):
        self.assertNotEqual(self.run_script('postgres-backup.sh', BACKUP_REPOSITORY_DEDICATED='no').returncode, 0)
        self.assertEqual(self.call_text(), '')

    def test_insecure_destination_refused(self):
        self.assertNotEqual(self.run_script('postgres-backup.sh', RESTIC_REPOSITORY='s3:http://example.invalid').returncode, 0)
        self.assertEqual(self.call_text(), '')

    def test_private_file_permissions_required(self):
        self.assertNotEqual(self.run_script('postgres-backup.sh', MOCK_MODE='644').returncode, 0)
        self.assertEqual(self.call_text(), '')

    def test_password_environment_refused(self):
        self.assertNotEqual(self.run_script('postgres-backup.sh', PGPASSWORD='non-secret-fixture').returncode, 0)
        self.assertEqual(self.call_text(), '')

    def test_failed_dump_never_promoted_or_retained(self):
        result = self.run_script('postgres-backup.sh', FAIL_PRODUCER='yes')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('tag --remove', self.call_text())
        self.assertNotIn('forget', self.call_text())
        self.assertNotIn('SENSITIVE_TEST_DIAGNOSTIC', result.stdout + result.stderr)
        self.assertFalse((self.state / 'last-success').exists())

    def test_failed_upload_never_promoted(self):
        result = self.run_script('postgres-backup.sh', FAIL_RESTIC='yes')
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn('tag --remove', self.call_text())
        self.assertNotIn('SENSITIVE_TEST_DIAGNOSTIC', result.stdout + result.stderr)

    def test_successful_backup_scopes_retention_and_leaves_no_dump(self):
        result = self.run_script('postgres-backup.sh')
        self.assertEqual(result.returncode, 0, result.stderr)
        calls = self.call_text()
        self.assertIn('--tag vogpk-postgres-pending', calls)
        self.assertIn('--add vogpk-postgres-complete', calls)
        self.assertIn('forget --host vogpk-oracle --tag vogpk-postgres-complete', calls)
        self.assertIn('--keep-daily 7 --keep-weekly 4 --keep-monthly 6', calls)
        self.assertNotIn('prune', calls)
        self.assertTrue((self.state / 'last-success').exists())
        self.assertFalse(any(p.name.startswith(('result.', 'errors.')) for p in self.state.iterdir()))

    def test_prune_requires_explicit_approval(self):
        result = self.run_script('postgres-backup.sh', MOCK_DAY='7', BACKUP_WEEKLY_PRUNE_APPROVED='yes')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('prune', self.call_text())

    def test_monitor_success(self):
        self.assertEqual(self.run_script('monitor-health.sh').returncode, 0)

    def test_monitor_service_failure_alerts(self):
        self.assertNotEqual(self.run_script('monitor-health.sh', FAIL_SERVICE='yes').returncode, 0)
        self.assertIn('journal-alert', self.call_text())
        self.assertNotIn('http-check', self.call_text())

    def test_monitor_http_failure_alerts(self):
        self.assertNotEqual(self.run_script('monitor-health.sh', FAIL_HTTP='yes').returncode, 0)
        self.assertIn('journal-alert', self.call_text())

    def test_deploy_refuses_wrong_operator(self):
        self.assertNotEqual(self.run_script('deploy-backend.sh').returncode, 0)
        self.assertEqual(self.call_text(), '')


if __name__ == '__main__':
    unittest.main()
