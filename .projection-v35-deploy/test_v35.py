import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

def wait_step(page,n):
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')==str(n): return
        page.wait_for_timeout(100)
    raise AssertionError(f'Step {n} did not become current')

def calculate(page,expected):
    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(350):
        result=page.locator('#guided-result')
        if result.is_visible() and not calc.is_disabled():
            break
        page.wait_for_timeout(100)
    else:
        raise AssertionError(f'{expected}-projector calculation did not complete')
    page.wait_for_timeout(700)
    assert page.locator('#projection-count').input_value()==str(expected)
    assert page.locator('#guided-count').input_value()==str(expected)
    buttons=page.locator('#v30-projector-selector button')
    print(f'SELECTOR_COUNT_{expected}',buttons.count())
    assert buttons.count()==expected, f'Expected {expected} projector buttons, got {buttons.count()}'
    summary=page.locator('#guided-result-summary').text_content() or ''
    viewer_status=page.locator('#guided-viewer-status-text').text_content() or ''
    progress=page.locator('#guided-progress').text_content() or ''
    print(f'SUMMARY_{expected}',summary)
    print(f'VIEWER_STATUS_{expected}',viewer_status)
    print(f'PROGRESS_{expected}',progress)
    assert f'{expected} projectors' in viewer_status or f'{expected} ×' in summary or f'{expected}-projector' in progress
    if expected==3:
        assert buttons.nth(0).text_content().strip()=='P1'
        assert buttons.nth(1).text_content().strip()=='P2'
        assert buttons.nth(2).text_content().strip()=='P3'
    return summary,viewer_status,progress

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v35.html',wait_until='domcontentloaded',timeout=15000)
    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(200)
    else: raise AssertionError('V35 app not ready')

    page.locator('[data-guided-go="2"]').click(); wait_step(page,2)
    page.locator('[data-guided-go="3"]').click(); wait_step(page,3)

    # User selects 3: this must produce exactly 3, never 2.
    page.locator('#v31-count-3').click()
    page.wait_for_timeout(300)
    assert page.locator('#projection-count').input_value()=='3'
    assert page.locator('#guided-count').input_value()=='3'
    assert 'exactly 3 projectors' in (page.locator('#v35-count-lock-note').text_content() or '')
    calculate(page,3)
    print('HARD_THREE_PROJECTOR_PASS')

    # User selects 2: same hard constraint in the other direction.
    page.locator('#v31-count-2').click()
    page.wait_for_timeout(350)
    assert page.locator('#projection-count').input_value()=='2'
    assert page.locator('#guided-count').input_value()=='2'
    assert 'exactly 2 projectors' in (page.locator('#v35-count-lock-note').text_content() or '')
    calculate(page,2)
    print('HARD_TWO_PROJECTOR_PASS')

    # Return to 3 for proof screenshot.
    page.locator('#v31-count-3').click()
    page.wait_for_timeout(250)
    calculate(page,3)
    page.screenshot(path='/tmp/v35-proof.png',full_page=False)
    browser.close()

print('V35 ACCEPTANCE PASS')
