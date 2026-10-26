from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v52.html"

def wait_step(page,n):
    for _ in range(100):
        cur=page.locator('[data-guided-go][aria-current="step"]')
        if cur.count() and cur.get_attribute('data-guided-go')==str(n): return
        page.wait_for_timeout(100)
    raise AssertionError(f'Step {n} did not become current')

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={"width":1680,"height":1050})
    page.add_init_script("window.print=()=>{window.__v52PrintCalled=true}")
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)

    for _ in range(120):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(150)
    else: raise AssertionError('V52 app not ready')

    assert "Include Projector Mounting Frame" in page.content()
    assert "Built-in screen gantry" not in page.content()

    page.locator('[data-guided-go="2"]').click(); wait_step(page,2)
    page.locator('[data-guided-go="3"]').click(); wait_step(page,3)

    calc=page.locator('#guided-calculate')
    calc.click(timeout=5000)
    for _ in range(400):
        if page.locator('#guided-result').is_visible() and not calc.is_disabled(): break
        page.wait_for_timeout(100)
    else: raise AssertionError('V52 projector profile calculation did not complete')
    page.wait_for_timeout(500)

    # Enter proposal through the normal workflow.
    page.locator('[data-guided-go="4"]').click(); wait_step(page,4)
    for _ in range(120):
        count=page.evaluate("Array.isArray(window.__projectionProposalViews)?window.__projectionProposalViews.length:0")
        if count>=4: break
        page.wait_for_timeout(100)
    else:
        canvas_info=page.evaluate("""() => {
          const c=document.querySelector('#led-canvas canvas');
          return c?{w:c.width,h:c.height,data:c.toDataURL('image/jpeg',.5).slice(0,30)}:null
        }""")
        raise AssertionError(f'Proposal view capture did not produce four images; canvas={canvas_info}')

    views=page.evaluate("window.__projectionProposalViews.map(v=>({view:v.view,label:v.label,len:v.data.length,prefix:v.data.slice(0,23)}))")
    print("V52_CAPTURED_VIEWS",views)
    assert [v["view"] for v in views]==["perspective","front","top","side"],views
    assert all(v["prefix"].startswith("data:image/") and v["len"]>1000 for v in views)

    # On-screen proposal shows the same four images.
    assert page.locator('#v52-proposal-views img').count()==4

    # Printable quote contains embedded customer-specific images.
    page.locator('#v37-print-proposal').click()
    page.wait_for_timeout(500)
    print_html=page.locator('#projection-print-document').inner_html()
    assert "Configured visual system" in print_html
    assert print_html.count("data:image/jpeg")>=4
    assert page.evaluate("window.__v52PrintCalled===true")
    print("V52_PROPOSAL_IMAGE_PASS",len(print_html))

    browser.close()

print("V52 PROPOSAL VIEW CAPTURE ACCEPTANCE PASS")
