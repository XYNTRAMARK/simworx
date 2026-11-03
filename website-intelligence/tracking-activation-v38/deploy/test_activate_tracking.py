import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import activate_tracking as activation

LOADER='/assets/js/simworx-intelligence-bootstrap-v2.js'

class TransformTests(unittest.TestCase):
    def test_head_only_preserves_every_existing_byte(self):
        before=b'<!doctype html>\r\n<HTML><HEAD><style>body> :last-child{color:red}</style></HEAD><body><p>Existing</p></body></HTML>'
        after,changed=activation.transform(before,LOADER)
        block=activation.tracking_block(LOADER)
        self.assertTrue(changed);self.assertEqual(after.replace(block,b'',1),before)
        self.assertEqual(after.split(b'<body>',1)[1],before.split(b'<body>',1)[1])
        self.assertLess(after.index(block),after.index(b'</HEAD>'))
    def test_script_literal_is_not_a_real_head_end(self):
        before=b'<html><head><script>var text="</head>";</script></head><body>Keep</body></html>'
        after,_=activation.transform(before,LOADER)
        self.assertIn(b'</script>\n<script id="simworx-intelligence-tracking"',after)
        self.assertEqual(after.replace(activation.tracking_block(LOADER),b'',1),before)
    def test_transform_is_idempotent_and_conflicting_installation_is_rejected(self):
        before=b'<html><head></head><body>Original</body></html>'
        after,_=activation.transform(before,LOADER)
        self.assertEqual(activation.transform(after,LOADER),(after,False))
        with self.assertRaises(RuntimeError):activation.transform(after,'/assets/js/simworx-intelligence-bootstrap-v3.js')
    def test_encoded_text_and_lf_positions_are_preserved(self):
        before='<html>\n<head>\n<title>Simworx — España</title>\n</head><body>Same</body></html>'.encode()
        after,_=activation.transform(before,LOADER)
        self.assertEqual(after.replace(activation.tracking_block(LOADER),b'',1),before)
    def test_missing_head_and_untrusted_asset_namespace_fail_closed(self):
        with self.assertRaises(RuntimeError):activation.transform(b'<body>Legacy</body>',LOADER)
        for path in ['/assets/js/main.js','/../index.html','/assets/js/simworx-intelligence-v1.js?override=1']:
            with self.assertRaises(RuntimeError):activation.tracking_block(path)
    def test_private_paths_are_not_tracking_html_targets(self):
        for path in ['/htdocs/admin/index.html','/htdocs/reports/index.html','/htdocs/portal/index.html','/htdocs/.secret.html','/htdocs/a/../index.html','/htdocs/index.php']:
            self.assertFalse(activation.public_html(path),path)
        self.assertTrue(activation.public_html('/htdocs/projection-screen-configurator-v38.html'))
    def test_configurator_properties_are_invisible_attributes_and_escaped(self):
        block=activation.tracking_block(LOADER,{'configurator':'projection','configurator_version':'projection_v37'})
        self.assertIn(b'data-configurator="projection"',block)
        self.assertIn(b'data-configurator-version="projection_v37"',block)
    def test_tmp_paths_are_fixed_to_target_parent_and_no_arbitrary_writes(self):
        self.assertEqual(activation.temporary_path('/htdocs/index.html','abc'),'/htdocs/.simworx-tracking-abc-index.html.upload')
        for target in ['/htdocs/admin/index.html','/private/stripe.php','/htdocs/assets/js/main.js']:
            with self.assertRaises(RuntimeError):activation.temporary_path(target,'abc')
    def test_known_projection_csp_only_adds_exact_tracking_urls_and_preserves_body(self):
        before=b'<html><head>'+activation.CSP_META_BEFORE+b'<style>body{color:red}</style></head><body>Original content</body></html>'
        props={'configurator':'projection','configurator_version':'projection-v37','tracking_csp':True}
        after,changed=activation.transform(before,LOADER,props)
        self.assertTrue(changed)
        self.assertEqual(activation.restore_original(after,LOADER,props),before)
        self.assertEqual(after.split(b'<body>',1)[1],before.split(b'<body>',1)[1])
        def directives(policy):return dict(part.split(' ',1) for part in policy.split('; '))
        old=directives(activation.CSP_BEFORE);new=directives(activation.CSP_AFTER)
        self.assertEqual(new['connect-src'],activation.CSP_ENDPOINT)
        self.assertEqual(new['script-src'].split(),["'unsafe-inline'",'blob:',*activation.CSP_ASSET_URLS])
        for key in old:
            if key not in {'script-src','connect-src'}:self.assertEqual(new[key],old[key])
        self.assertEqual(activation.transform(after,LOADER,props),(after,False))
    def test_unknown_or_widened_projection_csp_fails_closed(self):
        props={'tracking_csp':True}
        unknown=b'<head>'+activation.CSP_META_BEFORE.replace(b"blob:",b"'self'",1)+b'</head><body>Same</body>'
        with self.assertRaises(RuntimeError):activation.transform(unknown,LOADER,props)
        before=b'<head>'+activation.CSP_META_BEFORE+b'</head><body>Same</body>'
        after,_=activation.transform(before,LOADER,props)
        widened=after.replace(activation.CSP_ENDPOINT.encode(),b'https://example.com')
        with self.assertRaises(RuntimeError):activation.restore_original(widened,LOADER,props)
    def test_csp_plan_only_allows_exact_projection_path_with_before_sha(self):
        with tempfile.TemporaryDirectory() as tmp:
            source=Path(tmp);(source/'assets').mkdir();(source/'assets/bootstrap.js').write_text('/* tracking */')
            value={'loader_url':LOADER,'assets':[{'source':'assets/bootstrap.js','path':'/htdocs'+LOADER}], 'html_paths':[activation.CSP_TRACKING_PATH], 'csp_tracking_paths':[activation.CSP_TRACKING_PATH], 'expected_before':{activation.CSP_TRACKING_PATH:'a'*64}}
            plan=source/'activation.json'
            with patch.object(activation,'SOURCE',source),patch.object(activation,'PLAN',plan):
                plan.write_text(json.dumps(value));activation.plan()
                for changes in [{'csp_tracking_paths':['/htdocs/index.html']},{'csp_tracking_paths':['/htdocs/admin/index.html']},{'csp_tracking_paths':[activation.CSP_TRACKING_PATH,activation.CSP_TRACKING_PATH]},{'expected_before':{}},{'html_paths':['/htdocs/index.html']},{'page_properties':{activation.CSP_TRACKING_PATH:{'tracking_csp':True}}}]:
                    plan.write_text(json.dumps(dict(value,**changes)))
                    with self.assertRaises(RuntimeError):activation.plan()

class FakeFTP:
    def __init__(self,files):self.files=dict(files);self.writes=[]
    def retrbinary(self,command,callback,blocksize=65536):callback(self.files[command.removeprefix('RETR ')])
    def storbinary(self,command,handle,blocksize=65536):
        path=command.removeprefix('STOR ');self.writes.append(('store',path));self.files[path]=handle.read()
    def rename(self,source,target):self.writes.append(('rename',source,target));self.files[target]=self.files.pop(source)
    def delete(self,path):self.writes.append(('delete',path));del self.files[path]

class PublicationTests(unittest.TestCase):
    def setup_payload(self,work):
        before=b'<html><head></head><body>Preserved</body></html>'
        after,_=activation.transform(before,LOADER)
        (work/'payload').mkdir();(work/'payload/index.html').write_bytes(after)
        item={'before_sha256':activation.common.digest(before),'after_sha256':activation.common.digest(after)}
        review={'html':{'/htdocs/index.html':item},'new_assets':{'/htdocs'+LOADER:'value'}}
        return before,after,review
    def test_assets_are_new_and_html_replacement_is_guarded(self):
        with tempfile.TemporaryDirectory() as tmp:
            work=Path(tmp);before,after,review=self.setup_payload(work)
            files={'/htdocs/index.html':before};ftp=FakeFTP(files)
            state={'/htdocs/index.html':{'type':'file'}}
            transaction={'changed':set(),'assets':set(),'temps':set()}
            with patch.object(activation,'WORK',work),patch.object(activation.common,'inventory',return_value=state),patch.object(activation.common,'entries',side_effect=lambda client,parent:[(Path(p).name,{'type':'file'}) for p in client.files if str(Path(p).parent)==parent]):
                activation.install(ftp,state,review,{'/htdocs'+LOADER:b'/* tracking only */'},'token',transaction)
            self.assertEqual(ftp.files['/htdocs/index.html'],after)
            self.assertTrue(all(w[1].startswith('/htdocs/assets/js/simworx-intelligence-') or '/.simworx-tracking-token-' in w[1] for w in ftp.writes))
    def test_independent_page_change_prevents_any_html_replacement(self):
        with tempfile.TemporaryDirectory() as tmp:
            work=Path(tmp);before,after,review=self.setup_payload(work)
            ftp=FakeFTP({'/htdocs/index.html':b'Independently changed','/htdocs'+LOADER:b'/* tracking */'})
            state={'/htdocs/index.html':{'type':'file'},'/htdocs'+LOADER:{'type':'file'}}
            with patch.object(activation,'WORK',work),patch.object(activation.common,'inventory',return_value=state):
                with self.assertRaises(RuntimeError):activation.install(ftp,state,review,{'/htdocs'+LOADER:b'/* tracking */'},'token',{'changed':set(),'assets':set(),'temps':set()})
            self.assertFalse(ftp.writes)
    def test_rollback_restores_only_own_after_hash(self):
        with tempfile.TemporaryDirectory() as tmp:
            work=Path(tmp);before,after,review=self.setup_payload(work)
            original=work/'site/htdocs/index.html';original.parent.mkdir(parents=True);original.write_bytes(before)
            ftp=FakeFTP({'/htdocs/index.html':after})
            transaction={'changed':{'/htdocs/index.html'},'assets':set(),'temps':set()}
            with patch.object(activation,'WORK',work):activation.rollback(ftp,review,'token',transaction)
            self.assertEqual(ftp.files['/htdocs/index.html'],before)
            ftp.files['/htdocs/index.html']=b'Independent later edit';ftp.writes=[]
            with patch.object(activation,'WORK',work):
                with self.assertRaises(RuntimeError):activation.rollback(ftp,review,'token',transaction)
            self.assertFalse(ftp.writes)
    def test_two_exact_reporting_logic_paths_are_only_nonhtml_updates(self):
        self.assertEqual(activation.temporary_path('/htdocs/reports/analytics.js','abc'),'/htdocs/reports/.simworx-tracking-abc-analytics.js.upload')
        self.assertEqual(activation.temporary_path('/htdocs/reports/app.js','abc'),'/htdocs/reports/.simworx-tracking-abc-app.js.upload')
        for target in ['/htdocs/reports/config.js','/htdocs/reports/styles.css','/htdocs/assets/js/global-header.js','/htdocs/admin/admin.js']:
            with self.assertRaises(RuntimeError):activation.temporary_path(target,'abc')
    def test_reporting_updates_require_unique_exact_paths_and_before_hashes(self):
        def entry(path):return {'path':path,'source':'reports/'+Path(path).name,'expected_before':'a'*64}
        analytics=entry(activation.REPORT_ANALYTICS);app=entry(activation.REPORT_APP)
        self.assertEqual(activation.report_items({'report_updates':[analytics,app]}),[analytics,app])
        self.assertEqual(activation.report_items({'report_analytics_update':analytics}),[analytics])
        for value in [{'report_updates':[analytics,analytics]}, {'report_updates':[app,entry('/htdocs/reports/styles.css')]}, {'report_updates':[entry('/htdocs/admin/admin.js')]}, {'report_updates':[analytics,app,app]}, {'report_updates':[dict(app,expected_before='invalid')]}, {'report_updates':[analytics],'report_analytics_update':analytics}, {'report_analytics_update':app}]:
            with self.assertRaises(RuntimeError):activation.report_items(value)
    def test_lost_rename_reply_still_marks_target_for_conditional_recovery(self):
        class LostReply(FakeFTP):
            def rename(self,source,target):
                super().rename(source,target)
                raise ConnectionError('Rename reply lost')
        with tempfile.TemporaryDirectory() as tmp:
            work=Path(tmp);before,after,review=self.setup_payload(work)
            ftp=LostReply({'/htdocs/index.html':before,'/htdocs'+LOADER:b'/* tracking */'})
            state={'/htdocs/index.html':{'type':'file'},'/htdocs'+LOADER:{'type':'file'}}
            transaction={'changed':set(),'assets':set(),'temps':set()}
            with patch.object(activation,'WORK',work),patch.object(activation.common,'inventory',return_value=state),patch.object(activation.common,'entries',side_effect=lambda client,parent:[(Path(p).name,{'type':'file'}) for p in client.files if str(Path(p).parent)==parent]):
                with self.assertRaises(ConnectionError):activation.install(ftp,state,review,{'/htdocs'+LOADER:b'/* tracking */'},'token',transaction)
            self.assertEqual(ftp.files['/htdocs/index.html'],after)
            self.assertIn('/htdocs/index.html',transaction['changed'])

if __name__=='__main__':unittest.main()
