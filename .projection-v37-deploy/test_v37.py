import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v37.html',wait_until='domcontentloaded',timeout=15000)

    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true':break
        page.wait_for_timeout(200)
    else:raise AssertionError('V37 app not ready')

    page.locator('[data-guided-go="2"]').click()
    for _ in range(50):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2':break
        page.wait_for_timeout(100)

    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3' and page.locator('#v37-left-column').count():break
        page.wait_for_timeout(100)
    else:raise AssertionError('V37 Step 3 not ready')

    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(350):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled():break
        page.wait_for_timeout(100)
    else:raise AssertionError('V37 calculation did not complete')
    page.wait_for_timeout(700)

    # Core functions still exist in the right control column.
    assert page.locator('#v30-projector-selector').is_visible()
    assert page.locator('#v30-move').is_visible()
    assert page.locator('#v34-height').is_visible()
    assert page.locator('#v30-throw').is_visible()
    assert (page.locator('#v30-move').text_content() or '').strip()=='Move projector'

    # Secondary content now occupies the area directly below the viewer.
    live=page.locator('#v30-coverage').locator('xpath=ancestor::*[contains(@class,"v30-section")][1]')
    lookup=page.locator('#v31-projector-lookup')
    below=page.locator('#v37-left-below')
    assert live.evaluate("el=>el.parentElement.id")=='v37-left-below'
    assert lookup.evaluate("el=>el.parentElement.id")=='v37-left-below'
    assert below.is_visible()
    print('SECONDARY_PANELS_MOVED_BELOW_VIEWER_PASS')


    # Projector search must open a separate popup and leave the configurator page in place.
    search=page.locator('#v31-projector-search')
    assert search.get_attribute('aria-disabled')=='false'
    main_url=page.url
    with page.expect_popup(timeout=5000) as popup_info:
        search.click()
    popup=popup_info.value
    page.wait_for_timeout(300)
    print('PROJECTOR_POPUP_URL',popup.url)
    assert page.url==main_url
    assert 'Projector results opened in a separate results window' in (page.locator('#v31-projector-search-status').text_content() or '')
    assert 'google.com/search' in (search.get_attribute('href') or '')
    popup.close()
    print('PROJECTOR_POPUP_PASS')

    # Confirm layout geometry: panels start immediately after viewer, rather than leaving a blank column.
    home=page.locator('#led-canvas-home').bounding_box()
    below_box=below.bounding_box()
    panel=page.locator('#projection-v25-controls').bounding_box()
    print('VIEWER_HOME_BOX',home)
    print('BELOW_BOX',below_box)
    print('RIGHT_PANEL_BOX',panel)
    assert home and below_box and panel
    gap=below_box['y']-(home['y']+home['height'])
    print('GAP_BELOW_VIEWER',gap)
    assert gap>=0 and gap<=20, gap

    # Viewer + below-viewer content should occupy materially more of the left column than the old viewer alone.
    used_left=(below_box['y']+below_box['height'])-home['y']
    print('LEFT_COLUMN_USED_HEIGHT',used_left,'RIGHT_PANEL_HEIGHT',panel['height'])
    assert used_left>home['height']+150

    page.screenshot(path='/tmp/v37-proof.png',full_page=False)
    browser.close()

print('V37 ACCEPTANCE PASS')
