import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v38.html',wait_until='domcontentloaded',timeout=15000)

    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(200)
    else: raise AssertionError('V38 app not ready')

    # Verify the lower GBP tier live: 3.0 m diameter, 180° arc, 2.0 m height = 9.42 m².
    page.locator('#led-diameter').fill('3.0')
    page.locator('#led-diameter').dispatch_event('input')
    page.locator('#led-viewableHeight').fill('2.0')
    page.locator('#led-viewableHeight').dispatch_event('input')
    page.locator('#led-horizontalFov').fill('180')
    page.locator('#led-horizontalFov').dispatch_event('input')
    page.wait_for_timeout(500)
    small_snap=page.evaluate("window.SimworxProjection.snapshot()")
    small_screen=[l for l in small_snap['quote']['lineItems'] if l.get('id')=='screen-system'][0]
    print('SCREEN_LINE_UNDER_10',small_screen)
    assert '@ £550/m²' in small_screen['label']
    assert small_screen.get('rateGbp')==550
    print('GBP_SCREEN_RATE_UNDER_10_PASS')

    # Restore the standard 16.96 m² geometry before optical calculation.
    page.locator('#led-diameter').fill('4.5')
    page.locator('#led-diameter').dispatch_event('input')
    page.locator('#led-viewableHeight').fill('2.4')
    page.locator('#led-viewableHeight').dispatch_event('input')
    page.wait_for_timeout(500)

    # Calculate a 3-projector layout using the existing locked workflow.
    page.locator('[data-guided-go="2"]').click()
    for _ in range(50):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2': break
        page.wait_for_timeout(100)
    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3': break
        page.wait_for_timeout(100)

    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(350):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('V38 layout calculation failed')
    page.wait_for_timeout(700)

    # Default screen is >10 m², so its master rate must be £600/m².
    snap=page.evaluate("window.SimworxProjection.snapshot()")
    screen=[l for l in snap['quote']['lineItems'] if l.get('id')=='screen-system'][0]
    print('SCREEN_LINE_DEFAULT',screen)
    assert '@ £600/m²' in screen['label']
    assert screen.get('rateGbp')==600
    assert screen.get('baseGbp',0)>10000
    print('GBP_SCREEN_RATE_OVER_10_PASS')

    # Proposal should open with commercial controls.
    page.locator('[data-guided-go="4"]').click()
    for _ in range(80):
        if page.locator('#v37-proposal').is_visible() and page.locator('#v38-onsite').is_visible(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('V38 Proposal did not open')

    # Check all priced add-ons except mutually-exclusive custom enclosure.
    for selector in ['#v38-onsite','#v38-gantry','#v38-full-enclosure','#v38-warranty','#v38-crate']:
        page.locator(selector).check()
        page.wait_for_timeout(100)

    lines=page.locator('#v37-price-lines').text_content() or ''
    total=page.locator('#v37-proposal-total').text_content() or ''
    print('ADDON_LINES',lines)
    print('ADDON_TOTAL',total)
    assert 'Onsite installation & warping' in lines
    assert 'Travel expenses' in lines and 'To be quoted' in lines
    assert 'Built-in screen gantry' in lines
    assert 'Full enclosure' in lines
    assert 'Extended 5-year screen & frame warranty · 5%' in lines
    assert 'Shipping crate' in lines
    assert 'quoted/POA items' in total
    assert 'delivery' in total.lower()
    print('PRICED_ADDONS_PASS')

    # Warranty is 5% of the screen/frame base GBP price.
    snap=page.evaluate("window.SimworxProjection.snapshot()")
    screen=[l for l in snap['quote']['lineItems'] if l.get('id')=='screen-system'][0]
    # Switch to GBP so the price assertions are exact and transparent.
    page.locator('#v37-currency-buttons button[data-currency="GBP"]').click()
    page.wait_for_timeout(600)
    gbp_lines=page.locator('#v37-price-lines').text_content() or ''
    print('GBP_ADDON_LINES',gbp_lines)
    assert '£5,000.00' in gbp_lines
    assert '£1,500.00' in gbp_lines
    assert '£350.00' in gbp_lines
    expected_warranty=screen['baseGbp']*.05
    expected_warranty_text=f"£{expected_warranty:,.2f}"
    print('EXPECTED_WARRANTY',expected_warranty_text)
    assert expected_warranty_text in gbp_lines
    print('GBP_ADDON_VALUES_PASS')

    # Custom enclosure is POA and mutually exclusive with Full enclosure.
    page.locator('#v38-custom-enclosure').check()
    page.wait_for_timeout(150)
    assert not page.locator('#v38-full-enclosure').is_checked()
    custom_lines=page.locator('#v37-price-lines').text_content() or ''
    assert 'Custom enclosure' in custom_lines and 'POA' in custom_lines
    print('CUSTOM_ENCLOSURE_POA_PASS')

    # Returning to Full enclosure unchecks Custom enclosure.
    page.locator('#v38-full-enclosure').check()
    page.wait_for_timeout(150)
    assert not page.locator('#v38-custom-enclosure').is_checked()
    print('ENCLOSURE_MUTUAL_EXCLUSION_PASS')

    # EUR is derived from the GBP-mastered quote; changing currency preserves the GBP base marker.
    page.locator('#v37-currency-buttons button[data-currency="EUR"]').click()
    page.wait_for_timeout(600)
    eur_snap=page.evaluate("window.SimworxProjection.snapshot()")
    eur_screen=[l for l in eur_snap['quote']['lineItems'] if l.get('id')=='screen-system'][0]
    print('EUR_SCREEN_LINE',eur_screen)
    assert eur_screen.get('baseGbp')==screen.get('baseGbp')
    assert eur_screen['amount']!=screen['baseGbp']
    print('EUR_FROM_GBP_BASE_PASS')

    unexpected=[e for e in errors if "Unexpected token '-'" not in e]
    print('INHERITED_PAGE_ERRORS',errors)
    assert not unexpected, unexpected
    page.screenshot(path='/tmp/v38-proof.png',full_page=False)
    browser.close()

print('V38 ACCEPTANCE PASS')
