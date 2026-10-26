from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v56.html"

def rect(page,sel):
    return page.locator(sel).evaluate("""el=>{const r=el.getBoundingClientRect();return {
      x:r.x,y:r.y,w:r.width,h:r.height,visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)
    }}""")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={"width":1680,"height":1050})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    for _ in range(120):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(100)
    else: raise AssertionError('V56 app not ready')

    # Step 2 remains untouched.
    page.locator('[data-guided-go="2"]').click()
    page.wait_for_timeout(1300)
    step2_viewer=rect(page,'#led-canvas-home')
    step2_panel_owner=page.locator('#projection-v25-controls').evaluate("el=>({parent:el.parentElement?.id||'',hidden:el.hidden})")
    assert step2_viewer["visible"]

    # Step 3: controls must be visible in RIGHT preview, below viewer controls.
    page.locator('[data-guided-go="3"]').click()
    page.wait_for_timeout(1100)

    work=page.locator('.led-workbench')
    assert 'v53-step3' in (work.get_attribute('class') or '')

    panel=page.locator('#projection-v25-controls')
    assert panel.is_visible(), "Projector controls are not visible in Step 3"
    assert panel.evaluate("el=>el.parentElement.id")=='led-preview'
    assert page.locator('#projection-v30-control-surface').is_visible()

    viewer=rect(page,'#led-canvas-home')
    toolbar=rect(page,'.led-viewer-toolbar')
    tabs=rect(page,'.projection-view-tabs')
    controls=rect(page,'#projection-v25-controls')
    left=rect(page,'.guided-planner')
    right=rect(page,'#led-preview')

    print("V56_STEP3",{"left":left,"right":right,"viewer":viewer,"toolbar":toolbar,"tabs":tabs,"controls":controls})

    assert controls["x"] >= right["x"]-2
    assert controls["x"]+controls["w"] <= right["x"]+right["w"]+2
    assert controls["y"] >= tabs["y"]+tabs["h"]-2
    assert controls["x"] > left["x"]+left["w"]-4

    # Existing projector controls are present: selector, move/aim, throw.
    for sel in ['#v30-projector-selector','#v30-move','#v30-aim','#v30-throw']:
        assert page.locator(sel).count()==1 and page.locator(sel).is_visible(), sel

    # No projector controls in left column.
    assert page.locator('#v53-left-stack #projection-v25-controls').count()==0
    assert page.locator('#v53-left-stack #v30-throw').count()==0

    # Return to Step 2: V54 preservation still holds.
    page.locator('[data-guided-go="2"]').click()
    page.wait_for_timeout(1200)
    after=rect(page,'#led-canvas-home')
    assert after["visible"]
    assert abs(after["w"]-step2_viewer["w"])<=2,(step2_viewer,after)
    assert abs(after["h"]-step2_viewer["h"])<=2,(step2_viewer,after)

    # V55 VAT fields remain explicit/no defaults.
    page.locator('[data-guided-go="4"]').click()
    page.wait_for_timeout(700)
    assert page.locator('#v39-country').input_value()==''
    assert page.locator('#v37-customer-type').input_value()==''

    browser.close()

print("V56 PROJECTOR CONTROL REGRESSION REPAIR PASS")
