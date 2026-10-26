from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v54.html"

def rect(page,sel):
    return page.locator(sel).evaluate("""el=>{const r=el.getBoundingClientRect();return {
      x:r.x,y:r.y,w:r.width,h:r.height,visible:!!(el.offsetWidth||el.offsetHeight||el.getClientRects().length)
    }}""")

def owner(page,sel):
    return page.locator(sel).evaluate("""el=>({
      parentId:el.parentElement?.id||'',
      parentClass:el.parentElement?.className||'',
      prevId:el.previousElementSibling?.id||'',
      nextId:el.nextElementSibling?.id||''
    })""")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={"width":1680,"height":1050})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    for _ in range(120):
        if page.locator('html').get_attribute('data-standalone-ready')=='true': break
        page.wait_for_timeout(100)
    else: raise AssertionError('V54 app not ready')

    # Step 2 is the immutable reference. Capture ownership + geometry before ever entering Step 3.
    page.locator('[data-guided-go="2"]').click()
    page.wait_for_timeout(1400)
    before={
      "home":owner(page,"#led-canvas-home"),
      "button":owner(page,"#guided-calculate"),
      "result":owner(page,"#guided-result"),
      "viewer":rect(page,"#led-canvas-home"),
      "canvas":rect(page,"#led-canvas"),
      "preview":rect(page,"#led-preview"),
    }
    assert before["viewer"]["visible"], before
    assert before["canvas"]["w"]>500 and before["canvas"]["h"]>300,before

    # Enter Step 3 and verify the intended temporary layout.
    page.locator('[data-guided-go="3"]').click()
    page.wait_for_timeout(900)
    assert "v53-step3" in (page.locator(".led-workbench").get_attribute("class") or "")
    assert page.locator("#v53-left-stack").count()==1
    assert page.locator("#led-canvas-home").evaluate("el=>el.parentElement.id")=="led-preview"

    # Return to Step 2. Every moved element must return exactly to the pre-Step-3 owner.
    page.locator('[data-guided-go="2"]').click()
    page.wait_for_timeout(1200)
    after={
      "home":owner(page,"#led-canvas-home"),
      "button":owner(page,"#guided-calculate"),
      "result":owner(page,"#guided-result"),
      "viewer":rect(page,"#led-canvas-home"),
      "canvas":rect(page,"#led-canvas"),
      "preview":rect(page,"#led-preview"),
    }
    print("V54_STEP2_BEFORE",before)
    print("V54_STEP2_AFTER",after)

    for key in ["home","button","result"]:
        assert after[key]==before[key],(key,before[key],after[key])
    assert page.locator("#v53-left-stack").count()==0
    assert "v53-step3" not in (page.locator(".led-workbench").get_attribute("class") or "")
    assert after["viewer"]["visible"],after
    assert abs(after["viewer"]["w"]-before["viewer"]["w"])<=2,(before,after)
    assert abs(after["viewer"]["h"]-before["viewer"]["h"])<=2,(before,after)
    assert abs(after["canvas"]["w"]-before["canvas"]["w"])<=2,(before,after)
    assert abs(after["canvas"]["h"]-before["canvas"]["h"])<=2,(before,after)

    browser.close()

print("V54 STEP 2 PRESERVATION / STEP 3 REVERSIBILITY PASS")
