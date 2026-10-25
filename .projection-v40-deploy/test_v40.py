import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])

    for viewport in ({'width':1600,'height':1000},{'width':700,'height':900}):
        page=browser.new_page(viewport=viewport)
        page.goto('http://127.0.0.1:8765/projection-screen-configurator-v40.html',wait_until='domcontentloaded',timeout=15000)
        for _ in range(100):
            if page.locator('html').get_attribute('data-standalone-ready')=='true':break
            page.wait_for_timeout(200)
        else:raise AssertionError('V40 app not ready')
        page.wait_for_timeout(500)

        estimate=page.locator('.led-estimate-bar').bounding_box()
        header=page.locator('#v40-guided-header').bounding_box()
        assert estimate and header
        print('INITIAL_BOXES',viewport,estimate,header)

        # Header must sit directly beneath fixed price bar.
        delta=header['y']-(estimate['y']+estimate['height'])
        print('HEADER_GAP',viewport,delta)
        assert abs(delta)<=2.5, delta

        # Existing navigation still works.
        page.locator('[data-guided-go="2"]').click()
        for _ in range(70):
            cur=page.locator('[data-guided-go][aria-current="step"]')
            if cur.count() and cur.get_attribute('data-guided-go')=='2':break
            page.wait_for_timeout(100)
        else:raise AssertionError('Step 2 navigation failed')
        assert 'Step 2 of 4' in (page.locator('#guided-step-status').text_content() or '')

        # Scroll deeply: price bar and wizard bar must remain fixed together.
        page.evaluate("window.scrollTo(0,Math.max(900,document.body.scrollHeight*0.6))")
        page.wait_for_timeout(250)
        estimate2=page.locator('.led-estimate-bar').bounding_box()
        header2=page.locator('#v40-guided-header').bounding_box()
        assert estimate2 and header2
        print('SCROLLED_BOXES',viewport,estimate2,header2)
        assert abs(estimate2['y'])<=1.5
        delta2=header2['y']-(estimate2['y']+estimate2['height'])
        assert abs(delta2)<=2.5, delta2

        # Header must stay clickable after scrolling.
        page.locator('[data-guided-go="1"]').click()
        for _ in range(60):
            cur=page.locator('[data-guided-go][aria-current="step"]')
            if cur.count() and cur.get_attribute('data-guided-go')=='1':break
            page.wait_for_timeout(100)
        else:raise AssertionError('Fixed wizard header lost clickability')

        # V39 functions still inherited.
        assert page.locator('#v39-country').count()==1
        assert page.locator('#v38-onsite').count()==1
        assert page.locator('#v30-move').count()==1
        print('FIXED_WIZARD_PASS',viewport)
        page.close()

    browser.close()

print('V40 ACCEPTANCE PASS')
