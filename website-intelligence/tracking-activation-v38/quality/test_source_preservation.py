"""Independent source-preservation checks against downloaded live HTML."""
from pathlib import Path
import os
import re
import sys
import unittest

PROJECT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PROJECT / 'deploy'))
import activate_tracking as publisher

LOADER = '/assets/js/simworx-intelligence-bootstrap-v2.js'


class SourcePreservation(unittest.TestCase):
    def test_each_downloaded_live_page_keeps_every_original_byte(self):
        fixtures = Path(os.environ.get('QA_SOURCE_DIR', str(PROJECT / 'live')))
        pages = sorted(fixtures.rglob('*.html'))
        if not pages:
            self.skipTest('Downloaded current live source fixtures are not included in this checkout')
        self.assertGreaterEqual(len(pages), 4)
        for page in pages:
            with self.subTest(page=page.name):
                before = page.read_bytes()
                relative = str(page.relative_to(fixtures))
                properties = publisher.page_properties('/htdocs/' + relative, {})
                after, changed = publisher.transform(before, LOADER, properties)
                block = publisher.tracking_block(LOADER, properties)
                self.assertTrue(changed)
                self.assertEqual(after.count(block), 1)
                self.assertEqual(after.replace(block, b'', 1), before)
                # Independently compare the entire rendered-body source, not
                # just the publisher's own whole-file recovery condition.
                original_body = re.search(br'<body\b[\s\S]*', before, re.I)
                modified_body = re.search(br'<body\b[\s\S]*', after, re.I)
                self.assertIsNotNone(original_body)
                self.assertEqual(modified_body.group(), original_body.group())
                self.assertLess(after.index(block), re.search(br'</head\s*>', after, re.I).start())
                repeated, repeated_change = publisher.transform(after, LOADER, properties)
                self.assertFalse(repeated_change)
                self.assertEqual(repeated, after)

    def test_utf8_crlf_scripts_and_comments_do_not_move_or_rewrite_content(self):
        originals = [
            '<html>\r\n<head><title>Simworx — España</title></head>\r\n<body><h1>Original</h1></body></html>'.encode(),
            b'<html><head><script>const pretend="</head>";</script></head><body><style>.a{color:red}</style><button onclick="original()">Keep me</button></body></html>',
            b'<html><head><!-- </head> is a comment -->\n<title>Original</title></head><body data-state="unchanged">Text</body></html>',
        ]
        for before in originals:
            with self.subTest(before=before[:50]):
                after, changed = publisher.transform(before, LOADER)
                self.assertTrue(changed)
                self.assertEqual(after.replace(publisher.tracking_block(LOADER), b'', 1), before)
                self.assertEqual(re.search(br'<body\b[\s\S]*', after, re.I).group(), re.search(br'<body\b[\s\S]*', before, re.I).group())

    def test_private_areas_and_non_html_are_excluded_from_page_allowlist(self):
        for path in ['/htdocs/admin/index.html', '/htdocs/portal/index.html', '/htdocs/reports/index.html', '/htdocs/stripe/checkout.html', '/htdocs/.private/index.html', '/htdocs/assets/js/site.js', '/private/config.php', '/htdocs/../outside.html']:
            self.assertFalse(publisher.public_html(path), path)
        for path in ['/htdocs/index.html', '/htdocs/contact.html', '/htdocs/led-screen-configurator.html', '/htdocs/projection-screen-configurator-v37.html']:
            self.assertTrue(publisher.public_html(path), path)


if __name__ == '__main__':
    unittest.main()
