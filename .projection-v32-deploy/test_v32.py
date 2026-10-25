import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v32.html',wait_until='domcontentloaded',timeout=15000)
    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(200)
    else: raise AssertionError('V32 app not ready')

    page.locator('[data-guided-go="2"]').click()
    for _ in range(50):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2': break
        page.wait_for_timeout(100)
    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3' and page.locator('#v31-count-2').is_visible(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('V32 Step 3 not ready')

    assert not page.locator('#guided-count').is_visible()
    assert not page.locator('#projection-count').is_visible()

    page.locator('#v31-count-2').click()
    page.wait_for_timeout(400)
    assert page.locator('#projection-count').input_value()=='2'
    assert page.locator('#guided-count').input_value()=='2'
    assert page.locator('#v31-count-2').get_attribute('aria-pressed')=='true'
    print('TWO_PROJECTORS_SINGLE_SOURCE_PASS')

    page.locator('#v31-count-3').click()
    page.wait_for_timeout(400)
    assert page.locator('#projection-count').input_value()=='3'
    assert page.locator('#guided-count').input_value()=='3'
    assert page.locator('#v31-count-3').get_attribute('aria-pressed')=='true'
    print('THREE_PROJECTORS_SINGLE_SOURCE_PASS')

    assert page.locator('#v31-projector-search').count()==1
    assert page.locator('#led-runway-view').count()==1
    page.screenshot(path='/tmp/v32-proof.png',full_page=False)
    browser.close()

print('V32 ACCEPTANCE PASS')
