import shutil
from playwright.sync_api import sync_playwright

chrome=shutil.which('google-chrome') or shutil.which('chromium') or shutil.which('chromium-browser')
if not chrome: raise SystemExit('Chrome not found')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,executable_path=chrome,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={'width':1600,'height':1000})
    page.goto('http://127.0.0.1:8765/projection-screen-configurator-v33.html',wait_until='domcontentloaded',timeout=15000)

    for _ in range(100):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(200)
    else: raise AssertionError('V33 app not ready')

    page.locator('[data-guided-go="2"]').click()
    for _ in range(50):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='2': break
        page.wait_for_timeout(100)
    page.locator('[data-guided-go="3"]').click()
    for _ in range(80):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')=='3' and page.locator('#v33-mirror').is_visible(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('V33 Step 3 not ready')

    # Calculate a real 3-projector layout first.
    page.locator('#v31-count-3').click()
    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(250):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('V33 layout calculation failed')
    page.wait_for_timeout(500)

    # Mirror P1 to P3 with a deterministic source pose.
    page.locator('#v30-projector-1').click()
    page.wait_for_timeout(200)
    for selector,value in [
        ('#projection-x','-1.700'),
        ('#projection-y','3.250'),
        ('#projection-z','1.350'),
        ('#projection-yaw','18'),
        ('#projection-pitch','-7'),
        ('#projection-roll','170'),
    ]:
        page.locator(selector).evaluate("(el,v)=>{el.value=v;el.dispatchEvent(new Event('change',{bubbles:true}));}",value)
        page.wait_for_timeout(120)

    label=page.locator('#v33-mirror').text_content()
    print('MIRROR_LABEL',label)
    assert 'P1' in label and 'P3' in label
    page.locator('#v33-mirror').click()
    page.wait_for_timeout(800)

    page.locator('#v30-projector-3').click()
    page.wait_for_timeout(250)
    x=float(page.locator('#projection-x').input_value())
    y=float(page.locator('#projection-y').input_value())
    z=float(page.locator('#projection-z').input_value())
    yaw=float(page.locator('#projection-yaw').input_value())
    pitch=float(page.locator('#projection-pitch').input_value())
    roll=float(page.locator('#projection-roll').input_value())
    print('MIRRORED_P3',x,y,z,yaw,pitch,roll)
    assert abs(x-1.7)<0.02
    assert abs(y-3.25)<0.02
    assert abs(z-1.35)<0.02
    assert abs(yaw+18)<0.2
    assert abs(pitch+7)<0.2
    assert abs(roll+170)<0.2
    print('MIRROR_PASS')

    # Throw is forced to every projector.
    page.locator('#v30-throw').evaluate("el=>{el.value='0.62';el.dispatchEvent(new Event('input',{bubbles:true}));}")
    page.wait_for_timeout(800)
    throws=[]
    for i in range(3):
        page.locator(f'#v30-projector-{i+1}').click()
        page.wait_for_timeout(150)
        throws.append(float(page.locator('#projection-throw').input_value()))
    print('THROWS_ALL',throws)
    assert all(abs(v-0.62)<0.01 for v in throws)
    assert not page.locator('#v30-throw-all').is_visible()
    print('GLOBAL_THROW_PASS')

    # Removed advice block really is gone visually.
    assert not page.locator('.guided-advice-title').is_visible()
    assert not page.locator('#guided-remedies').is_visible()
    assert not page.locator('.guided-advice-actions').is_visible()
    assert not page.locator('#guided-mounting').is_visible()
    print('ADVICE_SECTION_REMOVED_PASS')

    # Viewer uses more vertical space.
    box=page.locator('#led-canvas').bounding_box()
    print('VIEWER_SIZE',box)
    assert box and box['height']>=550
    print('VIEWER_SPACE_PASS')

    page.screenshot(path='/tmp/v33-proof.png',full_page=False)
    browser.close()

print('V33 ACCEPTANCE PASS')
