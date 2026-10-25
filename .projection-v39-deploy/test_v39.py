import shutil, time
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    errors=[]
    page.on('pageerror',lambda e: errors.append(str(e)))
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v39.html',wait_until='domcontentloaded',timeout=15000)

    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(200)
    else: raise AssertionError('V39 app not ready')

    # Build a real Step-3 layout.
    page.locator('[data-guided-go="2"]').click()
    for _ in range(60):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2':break
        page.wait_for_timeout(100)
    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3':break
        page.wait_for_timeout(100)
    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(350):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled():break
        page.wait_for_timeout(100)
    else: raise AssertionError('V39 layout calculation failed')
    page.wait_for_timeout(700)

    # PERFORMANCE: rapid throw inputs should be cheap because only the beam preview
    # updates immediately; engineering metrics settle after the debounce.
    slider=page.locator('#v30-throw')
    start=time.perf_counter()
    for value in ['0.42','0.48','0.55','0.63','0.72','0.82','0.94','1.05','0.88','0.70','0.58','0.50']:
        slider.evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}",value)
    dispatch_ms=(time.perf_counter()-start)*1000
    print('RAPID_THROW_DISPATCH_MS',dispatch_ms)
    assert dispatch_ms<800, dispatch_ms
    page.wait_for_timeout(650)
    assert abs(float(page.locator('#projection-throw').input_value())-0.50)<0.01
    coverage=page.locator('#projection-coverage-metric').text_content() or ''
    shadow=page.locator('#projection-shadow-metric').text_content() or ''
    print('SETTLED_METRICS',coverage,shadow)
    assert '%' in coverage and '%' in shadow
    print('DEFERRED_THROW_ENGINEERING_PASS')

    # Existing movement controls remain intact.
    assert page.locator('#v30-move').is_visible()
    assert page.locator('#v30-aim').is_visible()
    assert page.locator('#v34-height').is_visible()
    assert page.locator('#v33-mirror').is_visible()
    print('MOVEMENT_WORKFLOW_PRESERVED_PASS')

    # Open Proposal.
    page.locator('[data-guided-go="4"]').click()
    for _ in range(100):
        if page.locator('#v37-proposal').is_visible() and page.locator('#v39-country').is_visible():break
        page.wait_for_timeout(100)
    else: raise AssertionError('V39 Proposal did not open')

    # Spain domestic: 21% for both personal/business.
    page.locator('#v39-country').select_option('ES')
    page.locator('#v37-customer-type').select_option('personal')
    page.wait_for_timeout(120)
    lines=page.locator('#v37-price-lines').text_content() or ''
    note=page.locator('#v37-vat-note').text_content() or ''
    assert 'VAT · 21%' in lines and 'Spanish domestic supply' in note
    print('VAT_SPAIN_PASS')

    # France personal: destination 20%.
    page.locator('#v39-country').select_option('FR')
    page.locator('#v37-customer-type').select_option('personal')
    page.wait_for_timeout(120)
    lines=page.locator('#v37-price-lines').text_content() or ''
    note=page.locator('#v37-vat-note').text_content() or ''
    assert 'VAT · 20%' in lines and 'destination VAT' in note
    print('VAT_FRANCE_PERSONAL_PASS')

    # Estonia current standard rate: 24%.
    page.locator('#v39-country').select_option('EE')
    page.wait_for_timeout(120)
    lines=page.locator('#v37-price-lines').text_content() or ''
    assert 'VAT · 24%' in lines
    print('VAT_ESTONIA_24_PASS')

    # EU business with VAT number: provisional 0%, VIES warning.
    page.locator('#v39-country').select_option('DE')
    page.locator('#v37-customer-type').select_option('business')
    page.locator('#v37-vat-number').fill('DE123456789')
    page.wait_for_timeout(120)
    lines=page.locator('#v37-price-lines').text_content() or ''
    note=page.locator('#v37-vat-note').text_content() or ''
    assert 'VAT · 0%' in lines and 'VIES' in note
    assert page.locator('#v39-vies-link').is_visible()
    print('VAT_EU_B2B_VIES_PASS')

    # EU business without VAT number falls back to Spanish VAT estimate.
    page.locator('#v37-vat-number').fill('')
    page.wait_for_timeout(120)
    lines=page.locator('#v37-price-lines').text_content() or ''
    note=page.locator('#v37-vat-note').text_content() or ''
    assert 'VAT · 21%' in lines and 'without validated VAT number' in note
    print('VAT_EU_B2B_NO_NUMBER_PASS')

    # Canary Islands / non-EU exports: 0 Spanish VAT with local tax excluded.
    page.locator('#v39-country').select_option('ES-CN')
    page.locator('#v37-customer-type').select_option('personal')
    page.wait_for_timeout(120)
    lines=page.locator('#v37-price-lines').text_content() or ''
    note=page.locator('#v37-vat-note').text_content() or ''
    assert 'VAT · 0%' in lines and 'IGIC' in note
    print('VAT_CANARIES_PASS')

    page.locator('#v39-country').select_option('GB')
    page.wait_for_timeout(120)
    lines=page.locator('#v37-price-lines').text_content() or ''
    note=page.locator('#v37-vat-note').text_content() or ''
    assert 'VAT · 0%' in lines and 'Import VAT' in note
    print('VAT_NON_EU_EXPORT_PASS')

    # Onsite installation abroad must stop pretending a simple VAT rate is definitive.
    page.locator('#v38-onsite').check()
    page.locator('#v39-country').select_option('FR')
    page.wait_for_timeout(150)
    lines=page.locator('#v37-price-lines').text_content() or ''
    note=page.locator('#v37-vat-note').text_content() or ''
    total=page.locator('#v37-proposal-total').text_content() or ''
    print('ONSITE_FOREIGN_VAT',lines,note,total)
    assert 'VATTo confirm' in lines.replace(' ','') or 'VAT To confirm' in lines
    assert 'installation / assembly' in note
    assert 'To confirm' in total
    print('VAT_ONSITE_INSTALLED_GOODS_PASS')

    # Ensure country selection appears in Proposal spec.
    spec=page.locator('#v37-proposal-spec').text_content() or ''
    assert 'Delivery country' in spec and 'France' in spec
    print('VAT_COUNTRY_IN_PROPOSAL_PASS')

    unexpected=[e for e in errors if "Unexpected token '-'" not in e]
    assert not unexpected, unexpected
    page.screenshot(path='/tmp/v39-proof.png',full_page=False)
    browser.close()

print('V39 ACCEPTANCE PASS')
