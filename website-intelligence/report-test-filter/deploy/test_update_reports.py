import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import update_reports as deploy


class FakeFTP:
    def __init__(self):
        self.files = {deploy.TARGET: b'old reports', deploy.HOMEPAGE: b'public homepage', '/htdocs/assets/js/business.js': b'original'}
        self.stores, self.renames, self.deletes = [], [], []
        self.lost_reply = False

    def retrbinary(self, command, consume, blocksize=65536):
        consume(self.files[command.removeprefix('RETR ')])

    def storbinary(self, command, handle, blocksize=65536):
        path = command.removeprefix('STOR ')
        self.stores.append(path)
        self.files[path] = handle.read()

    def rename(self, source, destination):
        self.renames.append((source, destination))
        self.files[destination] = self.files.pop(source)
        if self.lost_reply:
            self.lost_reply = False
            raise ConnectionError('Rename reply lost after server applied it')

    def delete(self, path):
        self.deletes.append(path)
        self.files.pop(path, None)

    def mlsd(self, folder):
        for path, data in self.files.items():
            if str(Path(path).parent) == folder:
                yield Path(path).name, {'type': 'file', 'size': str(len(data)), 'modify': 'before'}

    def inventory(self):
        result = {path: {'type': 'file', 'size': str(len(data)), 'modify': 'before'} for path, data in self.files.items()}
        result['/htdocs/reports'] = {'type': 'dir', 'modify': 'before'}
        result['/htdocs/assets'] = {'type': 'dir', 'modify': 'before'}
        result['/htdocs/assets/js'] = {'type': 'dir', 'modify': 'before'}
        return result


class DeploymentGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.work = self.root / 'work'
        self.work.mkdir()
        (self.work / 'payload.js').write_bytes(b'new filtered reports')
        self.source = self.root / 'source'
        (self.source / 'reports').mkdir(parents=True)
        (self.source / 'reports/analytics.js').write_bytes(b'new filtered reports')
        self.ftp = FakeFTP()
        self.old = self.ftp.files[deploy.TARGET]
        original = self.work / 'site/htdocs/reports/analytics.js'
        original.parent.mkdir(parents=True)
        original.write_bytes(self.old)
        self.review = {'path': deploy.TARGET, 'before_sha256': deploy.common.digest(self.old), 'after_sha256': deploy.common.digest(b'new filtered reports'), 'homepage_sha256': deploy.common.digest(self.ftp.files[deploy.HOMEPAGE])}
        self.plan = {'path': deploy.TARGET, 'source': 'reports/analytics.js', 'expected_before': self.review['before_sha256'], 'expected_after': self.review['after_sha256']}
        self.patches = [patch.object(deploy, 'WORK', self.work), patch.object(deploy, 'SOURCE', self.source), patch.object(deploy.common, 'inventory', side_effect=lambda ftp: ftp.inventory())]
        for item in self.patches:
            item.start()
        self.token = '123456abcdef'
        self.transaction = {'changed': False, 'temps': set()}

    def tearDown(self):
        for item in self.patches:
            item.stop()
        self.temp.cleanup()

    def write_plan(self):
        (self.source / 'plan.json').write_text(json.dumps(self.plan))

    def test_valid_plan_is_exact_single_file(self):
        self.write_plan()
        value, data = deploy.plan()
        self.assertEqual(value['path'], deploy.TARGET)
        self.assertEqual(data, b'new filtered reports')

    def test_public_or_app_target_rejected(self):
        for target in ['/htdocs/index.html', '/htdocs/reports/app.js', '/htdocs/assets/js/business.js', '/htdocs/reports/../index.html']:
            self.plan['path'] = target
            self.write_plan()
            with self.assertRaises(RuntimeError):
                deploy.plan()

    def test_plan_extra_field_and_changed_hash_rejected(self):
        self.plan['assets'] = []
        self.write_plan()
        with self.assertRaises(RuntimeError):
            deploy.plan()
        del self.plan['assets']
        self.plan['expected_after'] = 'a' * 64
        self.write_plan()
        with self.assertRaises(RuntimeError):
            deploy.plan()

    def test_source_symlink_rejected(self):
        source = self.source / 'reports/analytics.js'
        source.unlink()
        source.symlink_to(self.work / 'payload.js')
        self.write_plan()
        with self.assertRaises(RuntimeError):
            deploy.plan()

    def test_atomic_update_writes_only_own_temp_then_reports_calculation(self):
        before = self.ftp.inventory()
        deploy.install(self.ftp, before, self.review, self.token, self.transaction)
        deploy.verify_scope(self.ftp, before, self.review)
        self.assertEqual(self.ftp.stores, [deploy.temporary_path(self.token)])
        self.assertEqual(self.ftp.renames, [(deploy.temporary_path(self.token), deploy.TARGET)])
        self.assertEqual(self.ftp.deletes, [])
        self.assertEqual(self.ftp.files[deploy.HOMEPAGE], b'public homepage')
        self.assertEqual(self.ftp.files['/htdocs/assets/js/business.js'], b'original')

    def test_changed_inventory_stops_before_upload(self):
        before = self.ftp.inventory()
        self.ftp.files['/htdocs/customer.html'] = b'concurrent new page'
        with self.assertRaises(RuntimeError):
            deploy.install(self.ftp, before, self.review, self.token, self.transaction)
        self.assertEqual(self.ftp.stores, [])

    def test_changed_current_calculation_stops_before_upload(self):
        self.ftp.files[deploy.TARGET] = b'independently updated'
        with self.assertRaises(RuntimeError):
            deploy.install(self.ftp, self.ftp.inventory(), self.review, self.token, self.transaction)
        self.assertEqual(self.ftp.stores, [])

    def test_nonallowlisted_manifest_cannot_write_or_rollback(self):
        self.review['path'] = deploy.HOMEPAGE
        for action in [lambda: deploy.install(self.ftp, self.ftp.inventory(), self.review, self.token, self.transaction), lambda: deploy.rollback(self.ftp, self.review, self.token, self.transaction)]:
            with self.assertRaises(RuntimeError):
                action()
        self.assertEqual(self.ftp.stores, [])

    def test_lost_rename_reply_has_intent_and_restores_exact_original(self):
        self.ftp.lost_reply = True
        with self.assertRaises(ConnectionError):
            deploy.install(self.ftp, self.ftp.inventory(), self.review, self.token, self.transaction)
        self.assertTrue(self.transaction['changed'])
        self.assertEqual(self.ftp.files[deploy.TARGET], b'new filtered reports')
        deploy.rollback(self.ftp, self.review, self.token, self.transaction)
        self.assertEqual(self.ftp.files[deploy.TARGET], self.old)
        self.assertEqual(self.ftp.files[deploy.HOMEPAGE], b'public homepage')
        self.assertTrue(all(path.startswith('/htdocs/reports/.simworx-report-test-filter-') for path in self.ftp.deletes))

    def test_rollback_preserves_independent_change(self):
        deploy.install(self.ftp, self.ftp.inventory(), self.review, self.token, self.transaction)
        self.ftp.files[deploy.TARGET] = b'new customer change'
        with self.assertRaises(RuntimeError):
            deploy.rollback(self.ftp, self.review, self.token, self.transaction)
        self.assertEqual(self.ftp.files[deploy.TARGET], b'new customer change')

    def test_scope_rejects_unrelated_change_or_missing_file(self):
        before = self.ftp.inventory()
        deploy.install(self.ftp, before, self.review, self.token, self.transaction)
        self.ftp.files['/htdocs/assets/js/business.js'] = b'independent edit'
        with self.assertRaises(RuntimeError):
            deploy.verify_scope(self.ftp, before, self.review)
        del self.ftp.files[deploy.HOMEPAGE]
        with self.assertRaises(RuntimeError):
            deploy.verify_scope(self.ftp, before, self.review)

    def test_foreign_temp_cannot_be_deleted(self):
        self.transaction['temps'].add('/htdocs/reports/customer-file.js')
        with self.assertRaises(RuntimeError):
            deploy.rollback(self.ftp, self.review, self.token, self.transaction)
        self.assertEqual(self.ftp.deletes, [])

    def test_backup_archive_verifies_all_files(self):
        site = self.work / 'site'
        homepage = site / 'htdocs/index.html'
        homepage.write_bytes(b'public homepage')
        checksums = {deploy.TARGET: deploy.common.digest(self.old), deploy.HOMEPAGE: deploy.common.digest(b'public homepage')}
        archive = deploy.make_archive(site, {}, checksums)
        self.assertTrue(archive.is_file())
        checksums[deploy.HOMEPAGE] = 'a' * 64
        with self.assertRaises(RuntimeError):
            deploy.make_archive(site, {}, checksums)

    def test_publish_requires_retained_backup_before_connection(self):
        self.write_plan()
        with patch.dict(deploy.os.environ, {}, clear=True), patch.object(deploy.common, 'connect') as connect:
            with self.assertRaises(RuntimeError):
                deploy.publish()
            connect.assert_not_called()


if __name__ == '__main__':
    unittest.main()
