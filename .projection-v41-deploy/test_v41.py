import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v41.html',wait_until='domcontentloaded',timeout=15000)

    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true':break
        page.wait_for_timeout(200)
    else:raise AssertionError('V41 app not ready')

    page.locator('[data-guided-go="2"]').click()
    for _ in range(60):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2':break
        page.wait_for_timeout(100)
    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3' and page.locator('#v41-projector-compact').count():break
        page.wait_for_timeout(100)
    else:raise AssertionError('V41 Step 3 not ready')

    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(350):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled():break
        page.wait_for_timeout(100)
    else:raise AssertionError('V41 calculation failed')
    page.wait_for_timeout(500)

    compact=page.locator('#v41-projector-compact')
    throw=page.locator('#v41-throw-section')
    move=page.locator('#v30-move').locator('xpath=ancestor::*[contains(@class,"v30-section")][1]')
    assert compact.is_visible()
    assert throw.is_visible()
    assert move.is_visible()

    # New order: compact quantity/selector, then Throw, then movement.
    compact_box=compact.bounding_box()
    throw_box=throw.bounding_box()
    move_box=move.bounding_box()
    print('ORDER_BOXES',compact_box,throw_box,move_box)
    assert compact_box and throw_box and move_box
    assert compact_box['y'] < throw_box['y'] < move_box['y']

    # Compact control height: both rows should be materially smaller than old 42px buttons.
    h2=page.locator('#v31-count-2').bounding_box()
    hp1=page.locator('#v30-projector-1').bounding_box()
    print('COMPACT_BUTTONS',h2,hp1)
    assert h2 and hp1 and h2['height']<=32 and hp1['height']<=32

    # Existing count logic still works.
    page.locator('#v31-count-2').click()
    page.wait_for_timeout(250)
    assert page.locator('#projection-count').input_value()=='2'
    assert page.locator('#guided-count').input_value()=='2'
    page.locator('#v31-count-3').click()
    page.wait_for_timeout(250)
    assert page.locator('#projection-count').input_value()=='3'
    assert page.locator('#guided-count').input_value()=='3'
    print('COUNT_FUNCTION_PRESERVED_PASS')

    # Existing projector selection still works.
    page.locator('#v30-projector-2').click()
    page.wait_for_timeout(150)
    assert page.locator('#v30-projector-2').get_attribute('aria-pressed')=='true'
    print('SELECT_FUNCTION_PRESERVED_PASS')

    # Throw remains global and live.
    page.locator('#v30-throw').evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}",'0.64')
    page.wait_for_timeout(500)
    throws=[]
    for i in range(3):
        page.locator(f'#v30-projector-{i+1}').click()
        page.wait_for_timeout(100)
        throws.append(float(page.locator('#projection-throw').input_value()))
    print('GLOBAL_THROW_VALUES',throws)
    assert all(abs(v-.64)<.01 for v in throws)

    # V40 fixed wizard and V39 VAT functionality are still present.
    assert page.locator('#v40-guided-header').is_visible()
    assert page.locator('#v39-country').count()==1

    page.screenshot(path='/tmp/v41-proof.png',full_page=False)
    browser.close()

print('V41 ACCEPTANCE PASS')
