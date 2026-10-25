import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v34.html',wait_until='domcontentloaded',timeout=15000)
    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true':break
        page.wait_for_timeout(200)
    else:raise AssertionError('V34 app not ready')

    page.locator('[data-guided-go="2"]').click()
    for _ in range(50):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2':break
        page.wait_for_timeout(100)
    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3' and page.locator('#v34-height').is_visible():break
        page.wait_for_timeout(100)
    else:raise AssertionError('V34 Step 3 not ready')

    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(250):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled():break
        page.wait_for_timeout(100)
    else:raise AssertionError('V34 layout calculation failed')
    page.wait_for_timeout(500)

    # Capture initial plane and mount drop.
    initial_height=float((page.locator('#v34-lens-height').text_content() or '0').split()[0])
    initial_drop=float((page.locator('#v34-ceiling-drop').text_content() or '0').split()[0])
    print('INITIAL_HEIGHT_DROP',initial_height,initial_drop)

    # Explicit height mode must exist and enable manual vertical manipulation.
    page.locator('#v34-height').click()
    page.wait_for_timeout(200)
    assert page.locator('#v34-height').get_attribute('aria-pressed')=='true'
    assert page.locator('#projection-manual-viewer').is_checked()
    print('HEIGHT_MODE_PASS')

    # Raise 200 mm using precision controls.
    for _ in range(4):
        page.locator('#v34-raise').click()
        page.wait_for_timeout(150)

    raised_height=float((page.locator('#v34-lens-height').text_content() or '0').split()[0])
    raised_drop=float((page.locator('#v34-ceiling-drop').text_content() or '0').split()[0])
    print('RAISED_HEIGHT_DROP',raised_height,raised_drop)
    assert raised_height>initial_height+0.15
    assert raised_drop<initial_drop-0.15

    # All projectors must remain on exactly the same horizontal plane.
    heights=[]
    buttons=page.locator('#v30-projector-selector button')
    for i in range(buttons.count()):
        buttons.nth(i).click()
        page.wait_for_timeout(120)
        heights.append(float(page.locator('#projection-y').input_value()))
    print('ALL_LENS_HEIGHTS',heights)
    assert max(heights)-min(heights)<0.005
    assert all(abs(h-raised_height)<0.02 for h in heights)
    print('GANTRY_PLANE_PASS')

    # Raising to the limit must stop below the ceiling and report the shortened mount.
    info=page.evaluate("window.__projectionAdjustGantryHeight(99)")
    page.wait_for_timeout(500)
    print('MAX_HEIGHT_INFO',info)
    assert info['height']<=info['maxHeight']+0.001
    assert info['drop']>=0.079
    assert info['drop']<0.10
    print('CEILING_CLAMP_AND_MOUNT_DROP_PASS')

    page.screenshot(path='/tmp/v34-proof.png',full_page=False)
    browser.close()

print('V34 ACCEPTANCE PASS')
