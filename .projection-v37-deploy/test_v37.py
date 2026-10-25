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
    assert 'google.com/search' in (search.get_attribute('href') or '')
    popup.close()
    print('PROJECTOR_POPUP_PASS')

    # Confirm layout geometry: panels start immediately after viewer, rather than leaving a blank column.
    page.locator('#v37-left-column').scroll_into_view_if_needed()
    page.wait_for_timeout(150)
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

    # Step 4 is a real Proposal, not the old passive Review screen.
    page.locator('[data-guided-go="4"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='4' and page.locator('#v37-proposal').is_visible():
            break
        page.wait_for_timeout(100)
    else:
        raise AssertionError('V37 Proposal step did not open')

    assert (page.locator('[data-guided-go="4"]').text_content() or '').strip().endswith('Proposal')
    assert 'Proposal' in (page.locator('#guided-step-status').text_content() or '')
    assert page.locator('#v37-proposal-spec').is_visible()
    assert page.locator('#v37-projector-rows tr').count()==3
    assert page.locator('#v37-price-lines').is_visible()
    assert page.locator('#v37-print-proposal').is_visible()
    assert page.locator('#v37-download-proposal').is_visible()
    assert page.locator('#v37-email-proposal').is_visible()
    assert page.locator('#v37-request-quote').is_visible()
    assert not page.locator('#led-review').is_visible()
    print('PROPOSAL_STEP_VISIBLE_PASS')

    # Spain uses the visible 21% VAT estimate and delivery stays quote-only.
    page.locator('#v37-destination').select_option('spain')
    page.wait_for_timeout(150)
    lines=page.locator('#v37-price-lines').text_content() or ''
    vat_note=page.locator('#v37-vat-note').text_content() or ''
    print('SPAIN_FINANCE',lines,vat_note)
    assert 'VAT · 21%' in lines
    assert 'Delivery' in lines and 'To be quoted' in lines
    assert '21%' in vat_note
    print('SPAIN_VAT_PASS')

    # EU business VAT treatment changes to 0% estimate when a VAT number is supplied.
    page.locator('#v37-destination').select_option('eu')
    page.locator('#v37-customer-type').select_option('business')
    page.locator('#v37-vat-number').fill('FR12345678901')
    page.wait_for_timeout(150)
    eu_lines=page.locator('#v37-price-lines').text_content() or ''
    eu_note=page.locator('#v37-vat-note').text_content() or ''
    print('EU_BUSINESS_FINANCE',eu_lines,eu_note)
    assert 'VAT · 0%' in eu_lines
    assert 'VIES' in eu_note
    print('EU_BUSINESS_VAT_PASS')

    # Proposal currency remains synchronized with the main configurator currency.
    page.locator('#v37-currency-buttons button[data-currency="GBP"]').click()
    page.wait_for_timeout(500)
    assert page.locator('#projection-currency').input_value()=='GBP'
    assert page.locator('#v37-currency-buttons button[data-currency="GBP"]').get_attribute('aria-pressed')=='true'
    print('PROPOSAL_CURRENCY_SYNC_PASS')

    # Email action opens the proposal email box without leaving the proposal.
    page.locator('#v37-email-proposal').click()
    assert page.locator('#v37-email-dialog').is_visible()
    page.locator('#v37-email-close').click()
    assert not page.locator('#v37-email-dialog').is_visible()
    print('PROPOSAL_EMAIL_DIALOG_PASS')

    page.screenshot(path='/tmp/v37-proof.png',full_page=False)
    browser.close()

print('V37 ACCEPTANCE PASS')
