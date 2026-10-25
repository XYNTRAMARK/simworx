import shutil
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright

chrome = shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome:
    raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser = pw.chromium.launch(
        headless=True,
        executable_path=chrome,
        args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader']
    )
    page = browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v31.html', wait_until='domcontentloaded', timeout=15000)

    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready') == 'true':
            break
        page.wait_for_timeout(200)
    else:
        raise AssertionError('V31 app did not become ready')

    page.locator('[data-guided-go="2"]').click()
    for _ in range(50):
        cur = page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go') == '2':
            break
        page.wait_for_timeout(100)
    else:
        raise AssertionError('Step 2 failed')

    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur = page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go') == '3' and page.locator('#v31-projector-count').is_visible():
            break
        page.wait_for_timeout(100)
    else:
        raise AssertionError('V31 Step 3 did not become ready')

    # Projector quantity is a simple 2/3 choice.
    assert not page.locator('#projection-count').is_visible()
    page.locator('#v31-count-2').click()
    page.wait_for_timeout(300)
    assert page.locator('#projection-count').input_value() == '2'
    assert page.locator('#v31-count-2').get_attribute('aria-pressed') == 'true'
    page.locator('#v31-count-3').click()
    page.wait_for_timeout(300)
    assert page.locator('#projection-count').input_value() == '3'
    assert page.locator('#v31-count-3').get_attribute('aria-pressed') == 'true'
    print('PROJECTOR_COUNT_BUTTONS_PASS')

    # Calculate a real requirement.
    calc = page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(250):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled():
            break
        page.wait_for_timeout(100)
    else:
        raise AssertionError('V31 layout calculation did not complete')
    page.wait_for_timeout(600)

    # Runway preview switches into the coverage-limited test-image mode.
    runway = page.locator('#led-runway-view')
    runway.check()
    page.wait_for_timeout(500)
    assert runway.is_checked()
    assert not page.locator('#projection-coverage').is_checked()
    assert not page.locator('#projection-shadows').is_checked()
    assert 'coverage-limited' in (page.locator('#v31-runway-note').text_content() or '')
    print('RUNWAY_COVERAGE_MODE_PASS')

    # AI lookup is generated from the current calculated specification.
    link = page.locator('#v31-projector-search')
    assert link.get_attribute('aria-disabled') == 'false'
    href = link.get_attribute('href')
    assert href and 'google.com/search' in href and 'udm=50' in href
    qs = parse_qs(urlparse(href).query)
    prompt = qs.get('q',[''])[0]
    print('AI_QUERY_PREFIX', prompt[:300])
    assert '3 to 5' in prompt
    assert 'throw ratio' in prompt.lower()
    assert 'manufacturer' in prompt.lower()
    assert 'flight-simulator' in prompt.lower()
    print('AI_PROJECTOR_LOOKUP_PASS')

    page.screenshot(path='/tmp/v31-proof.png', full_page=False)
    browser.close()

print('V31 ACCEPTANCE PASS')
