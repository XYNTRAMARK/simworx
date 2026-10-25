import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v36.html',wait_until='domcontentloaded',timeout=15000)

    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(200)
    else: raise AssertionError('V36 app not ready')

    page.locator('[data-guided-go="2"]').click()
    for _ in range(50):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2': break
        page.wait_for_timeout(100)
    else: raise AssertionError('Step 2 failed')

    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3' and page.locator('#v30-move').is_visible(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('Step 3 failed')

    assert (page.locator('#v30-move').text_content() or '').strip()=='Move projector'
    assert page.locator('#v34-height').is_visible()
    assert 'Raise / lower gantry' in (page.locator('#v34-height').text_content() or '')
    print('MOVE_PROJECTOR_LABEL_PASS')

    # Turn shadows off, then calculate: the new layout must turn them back on automatically.
    shadows=page.locator('#projection-shadows')
    if shadows.is_checked():
        shadows.uncheck()
    assert not shadows.is_checked()

    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(350):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('Calculation did not complete')

    page.wait_for_timeout(700)
    assert shadows.is_checked(), 'Shadows were not re-enabled when projectors loaded'
    print('SHADOWS_AUTO_ENABLED_PASS')

    page.screenshot(path='/tmp/v36-proof.png',full_page=False)
    browser.close()

print('V36 ACCEPTANCE PASS')
