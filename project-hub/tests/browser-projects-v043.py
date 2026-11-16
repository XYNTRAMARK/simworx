"""Local-only Chromium smoke. Never run against live Sim-Worx website.
Install Playwright/Chromium only if already available at no extra cost.
From project-hub: python3 -m http.server 8765
Next terminal: python3 tests/browser-projects-v043.py
No user/customer data required; this starts with a clean browser context.
"""
from playwright.sync_api import sync_playwright
import os

URL=os.environ.get('PROJECT_HUB_URL','http://127.0.0.1:8765')
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
    page=browser.new_page()
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(URL,wait_until='networkidle')
    page.evaluate("localStorage.removeItem('simworx-project-hub-demo-v1');localStorage.removeItem('simworx-project-hub-local-staff-v1');sessionStorage.clear()")
    page.reload(wait_until='networkidle')
    assert page.locator('form[data-form="v43-staff-setup"]').count()==1
    page.locator('form[data-form="v43-staff-setup"] input[name="username"]').fill('local-test')
    page.locator('form[data-form="v43-staff-setup"] input[name="password"]').fill('smoke-test-not-for-production')
    page.locator('form[data-form="v43-staff-setup"] input[name="confirmation"]').fill('smoke-test-not-for-production')
    page.locator('form[data-form="v43-staff-setup"] button[type="submit"]').click()
    page.locator('.version-chip').wait_for()
    assert page.locator('.version-chip').inner_text()=='V0.4.3'
    assert 'LOCAL · STAFF ONLY' in page.locator('.topbar').inner_text()
    assert page.get_by_text('Active projects').count()>0
    assert page.locator('.content').inner_text().find('NOAH — Advanced Training Simulator')==-1
    page.locator('[data-action="nav"][data-id="settings"]').click()
    assert page.get_by_text('Workspace file and recovery').count()>0
    assert page.locator('[data-action="v41-restore"]').count()==1
    assert page.locator('[data-action="v43-file-new"]').count()==1
    # Tests after an isolated synthetic project is entered can be added without personal documents.
    page.locator('[data-action="v43-staff-logout"]').click()
    assert page.locator('form[data-form="v43-staff-login"]').count()==1
    assert not errors,errors
    print('V0.4.3 clean start, staff gate and settings smoke PASS')
    browser.close()
