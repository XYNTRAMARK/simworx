from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v55.html"

snapshot={
  "configuration":{
    "currency":"GBP","diameter":4.5,"horizontalFov":180,"viewableHeight":2.4,"screenBottom":0.35,
    "simulatorType":"airliner","mountingStyle":"ceiling","notes":"VAT acceptance test",
    "room":{"width":6,"depth":6,"height":3.2},
    "projectors":[{"id":"P1","position":[0,2.8,-2.2],"yaw":0,"pitch":-4,"roll":0,"throwRatio":0.69}]
  },
  "quote":{
    "reference":"SWX-PROJ-V55-VAT","date":"2026-10-26",
    "lineItems":[{"id":"screen","label":"Projection screen and frame","amount":12000,"status":"priced"}]
  }
}

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1440,"height":950})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    page.wait_for_timeout(1200)

    page.evaluate("""snap=>{
      window.SimworxProjection={snapshot:()=>snap};
      document.querySelectorAll('[data-guided-go]').forEach(b=>b.removeAttribute('aria-current'));
      document.querySelector('[data-guided-go="4"]').setAttribute('aria-current','step');
    }""",snapshot)
    page.wait_for_timeout(700)

    country=page.locator('#v39-country')
    customer=page.locator('#v37-customer-type')
    assert country.input_value()=='' , country.input_value()
    assert customer.input_value()=='' , customer.input_value()
    assert country.locator('option').first.text_content().strip().startswith('Select delivery country')
    assert customer.locator('option').first.text_content().strip().startswith('Select customer type')

    box=page.locator('#v55-vat-selector')
    assert box.is_visible()
    assert 'v55-incomplete' in (box.get_attribute('class') or '')
    note=page.locator('#v37-vat-note').text_content() or ''
    lines=page.locator('#v37-price-lines').text_content() or ''
    total=page.locator('#v37-proposal-total').text_content() or ''
    print('V55_INITIAL',{'note':note,'lines':lines,'total':total})
    assert 'VAT details required' in note
    assert 'Select the delivery country and customer type' in note
    assert 'VAT' in lines and 'To confirm' in lines
    assert 'To confirm' in total
    assert '21%' not in lines
    assert 'Spanish VAT estimate' not in note

    # Country alone must still not calculate VAT.
    country.select_option('GB')
    page.wait_for_timeout(250)
    note=page.locator('#v37-vat-note').text_content() or ''
    lines=page.locator('#v37-price-lines').text_content() or ''
    assert 'VAT details required' in note
    assert 'To confirm' in lines

    # Once both fields are explicit, treatment becomes active and callout turns green.
    customer.select_option('business')
    page.wait_for_timeout(300)
    note=page.locator('#v37-vat-note').text_content() or ''
    lines=page.locator('#v37-price-lines').text_content() or ''
    boxclass=box.get_attribute('class') or ''
    print('V55_SELECTED',{'note':note,'lines':lines,'box':boxclass})
    assert 'v55-ready' in boxclass
    assert 'United Kingdom' in note
    assert '0%' in lines or 'VAT · 0%' in lines
    assert 'Spanish VAT estimate: 21%' not in note

    # Spain only gets Spanish VAT after being explicitly selected.
    country.select_option('ES')
    customer.select_option('personal')
    page.wait_for_timeout(300)
    note=page.locator('#v37-vat-note').text_content() or ''
    lines=page.locator('#v37-price-lines').text_content() or ''
    assert 'Spanish domestic supply' in note
    assert '21%' in lines

    browser.close()

print("V55 EXPLICIT VAT SELECTION ACCEPTANCE PASS")
