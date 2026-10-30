"""Hermetic failure-path tests. No cloud access, database or service control.

Run with Python 3; on Windows set BASH to the installed Git Bash executable.
All operational commands are replaced inside a disposable fixture directory.
"""
import os
from pathlib import Path
import shutil
import shlex
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

    def run_script(self, name, *arguments, **changes):
        command = 'p="$1"; if command -v cygpath >/dev/null; then p=$(cygpath -u "$p"); fi; export PATH="$p:$PATH"; exec bash "$2" "${@:3}"'
        return subprocess.run([BASH, '-c', command, '_', self.bin.as_posix(), (OPS / name).as_posix(), *arguments],
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


class DeploymentTests(unittest.TestCase):
    run_script = OperationsTests.run_script
    call_text = OperationsTests.call_text
    tearDown = OperationsTests.tearDown
    sha = 'a' * 40

    def stub(self, name, body):
        file = self.bin / name
        file.write_text('#!/usr/bin/env bash\n' + body + '\n', encoding='utf-8', newline='\n')
        file.chmod(0o700)

    def setUp(self):
        OperationsTests.setUp(self)
        self.repo = self.root / 'repo'
        self.original = self.repo / 'backend'
        self.target = self.repo / '.local/releases' / self.sha / 'backend'
        self.override_dir = self.root / 'etc/vogpk-api.service.d'
        self.dropin = self.override_dir / '20-vogpk-release.conf'
        self.current = self.root / 'working-directory'
        self.current.write_text(self.original.as_posix() + '\n')
        for folder in [self.repo / '.git', self.original / 'node_modules', self.original / 'dist', self.original / 'prisma/migrations']:
            folder.mkdir(parents=True, exist_ok=True)
        (self.original / '.env.local').write_text('fixture-private-file')
        (self.original / 'dist/main.js').write_text('original-built-code')
        (self.original / 'prisma/schema.prisma').write_text('fixture-schema')
        self.export = self.root / 'export/backend'
        (self.export / 'prisma/migrations').mkdir(parents=True)
        (self.export / 'prisma/schema.prisma').write_text('fixture-schema')
        (self.export / 'src').mkdir()
        (self.export / 'test').mkdir()
        (self.export / 'src/main.ts').write_text('fixture source')
        (self.export / 'src/generated').mkdir()
        (self.export / 'src/generated/auto.ts').write_text('generated fixture')
        script = (OPS / 'deploy-backend.sh').read_text()
        self.assertEqual(script.count('repo=/home/ubuntu/vog-pk'), 1)
        self.assertEqual(script.count('/etc/systemd/system/vogpk-api.service.d'), 2)
        script = script.replace('repo=/home/ubuntu/vog-pk', 'repo=' + shlex.quote(self.repo.as_posix()))
        script = script.replace('/etc/systemd/system/vogpk-api.service.d', self.override_dir.as_posix())
        self.assertNotIn('/etc/systemd', script)
        self.fixture_script = self.root / 'deploy-fixture.sh'
        self.fixture_script.write_text(script, encoding='utf-8', newline='\n')
        self.env.update({'MOCK_ORIGINAL': self.original.as_posix(), 'MOCK_CURRENT': self.current.as_posix(),
                         'MOCK_DROPIN': self.dropin.as_posix(), 'MOCK_EXPORT': self.export.parent.as_posix()})
        self.stub('id', 'if [[ $1 == -un ]]; then echo ubuntu; else echo 1000; fi')
        self.stub('node', 'echo 24')
        self.stub('git', '''case "$3" in
 cat-file) exit 0;;
 remote) echo https://github.com/Monis-iqbal21/vog-pk.git;;
 archive) tar -cf - -C "$MOCK_EXPORT" backend;;
 *) exit 1;;
esac''')
        self.stub('sudo', '[[ $1 == -n ]] && shift; exec "$@"')
        self.stub('install', '''directory=no
while [[ $# -gt 0 ]]; do
 case "$1" in
  -m|-o|-g) shift 2;;
  -d) directory=yes; shift;;
  *) break;;
 esac
done
if [[ $directory == yes ]]; then mkdir -p "$1"; else cp "$1" "$2"; fi''')
        self.stub('systemctl', '''case "$1" in
 show) cat "$MOCK_CURRENT";;
 daemon-reload) echo reload >>"$CALLS";;
 restart)
  echo restart >>"$CALLS"
  if [[ -f $MOCK_DROPIN ]]; then sed -n 's/^WorkingDirectory=//p' "$MOCK_DROPIN" >"$MOCK_CURRENT"; else printf '%s\n' "$MOCK_ORIGINAL" >"$MOCK_CURRENT"; fi
  ;;
 *) exit 1;;
esac''')
        self.stub('curl', '''if [[ ${FAIL_NEW_HEALTH:-no} == yes && $(cat "$MOCK_CURRENT") != "$MOCK_ORIGINAL" ]]; then exit 1; fi
exit 0''')
        self.stub('ss', 'echo "LISTEN 0 511 127.0.0.1:4000 0.0.0.0:*"')
        self.stub('sleep', 'exit 0')
        log = shlex.quote(self.calls.as_posix())
        self.npm_body = '''[[ ! -e .env.local && ! -L .env.local ]] || exit 70
[[ -z ${DATABASE_URL:-} && -z ${BFF_SHARED_SECRET:-} && -z ${OWNER_PASSWORD:-} && $NODE_ENV == test ]] || exit 71
echo build-env-clean >>''' + log + '''
if [[ $1 == exec ]]; then
 [[ $* == *--offline* && $* == *--no-ignore* && $* == *src/main.ts* && $* != *src/generated* ]] || exit 72
 echo lint-explicit-source >>''' + log + '''
fi
if [[ $1 == run && $2 == build ]]; then mkdir -p dist node_modules; echo prepared-code >dist/main.js; fi'''
        self.stub('npm', self.npm_body)

    def run_deploy(self, *args, **changes):
        return self.run_script(self.fixture_script, *args, **changes)

    def prepared(self):
        (self.target / 'dist').mkdir(parents=True)
        (self.target / 'node_modules').mkdir()
        (self.target / 'dist/main.js').write_text('prepared-code')
        (self.target / '.env.local').write_text('fixture-private-file')
        (self.target / 'RELEASE_COMMIT').write_text(self.sha + '\n')

    def test_prepare_keeps_runtime_credentials_out_of_build(self):
        result = self.run_deploy('prepare', self.sha, DATABASE_URL='fixture', BFF_SHARED_SECRET='fixture', OWNER_PASSWORD='fixture')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.call_text().count('build-env-clean'), 4)
        self.assertEqual((self.target / '.env.local').read_text(), 'fixture-private-file')
        # Git Bash may emulate ln -s by copying on Windows; Ubuntu must link.
        if os.name != 'nt':
            self.assertTrue((self.target / '.env.local').is_symlink())
        self.assertTrue((self.target / 'RELEASE_COMMIT').exists())
        self.assertEqual((self.original / '.env.local').read_text(), 'fixture-private-file')
        self.assertNotIn('restart', self.call_text())

    def test_failed_build_has_no_runtime_link_or_ready_marker(self):
        self.stub('npm', self.npm_body + '\nexit 8')
        result = self.run_deploy('prepare', self.sha)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse((self.target / '.env.local').is_symlink())
        self.assertFalse((self.target / 'RELEASE_COMMIT').exists())
        self.assertNotIn('restart', self.call_text())

    def test_preparation_lints_source_and_excludes_generated_files(self):
        result = self.run_deploy('prepare', self.sha)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.call_text().splitlines().count('lint-explicit-source'), 1)

    def test_activation_requires_restart_approval(self):
        self.prepared()
        self.assertNotEqual(self.run_deploy('activate', self.sha).returncode, 0)
        self.assertFalse(self.dropin.exists())
        self.assertNotIn('restart', self.call_text())

    def test_initial_activation_and_rollback_restore_absent_override(self):
        self.prepared()
        result = self.run_deploy('activate', self.sha, '--approved-restart')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue(self.dropin.exists())
        result = self.run_deploy('rollback', '--approved-restart')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertFalse(self.dropin.exists())
        self.assertEqual(self.current.read_text().strip(), self.original.as_posix())
        self.assertEqual((self.original / 'dist/main.js').read_text(), 'original-built-code')

    def test_existing_override_is_restored_byte_for_byte(self):
        self.prepared()
        self.override_dir.mkdir(parents=True)
        previous = '# Managed by VOGPK release tooling\n[Service]\nWorkingDirectory=' + self.original.as_posix() + '\nUMask=0027\nEnvironment=EXISTING_POLICY=retain\n'
        self.dropin.write_text(previous, newline='\n')
        self.assertEqual(self.run_deploy('activate', self.sha, '--approved-restart').returncode, 0)
        self.assertEqual(self.run_deploy('rollback', '--approved-restart').returncode, 0)
        self.assertEqual(self.dropin.read_text(), previous)

    def test_failed_health_restores_original_override_and_restarts_previous(self):
        self.prepared()
        result = self.run_deploy('activate', self.sha, '--approved-restart', FAIL_NEW_HEALTH='yes')
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(self.dropin.exists())
        self.assertEqual(self.current.read_text().strip(), self.original.as_posix())
        self.assertEqual(self.call_text().splitlines().count('restart'), 2)

    def test_unrelated_override_is_never_replaced(self):
        self.prepared()
        self.override_dir.mkdir(parents=True)
        self.dropin.write_text('[Service]\nUMask=0027\n', newline='\n')
        self.assertNotEqual(self.run_deploy('activate', self.sha, '--approved-restart').returncode, 0)
        self.assertEqual(self.dropin.read_text(), '[Service]\nUMask=0027\n')
        self.assertNotIn('restart', self.call_text())

    def test_rollback_requires_recorded_configuration(self):
        self.assertNotEqual(self.run_deploy('rollback', '--approved-restart').returncode, 0)
        self.assertNotIn('restart', self.call_text())


if __name__ == '__main__':
    unittest.main()
