from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v51.html"

def rect(page,sel):
    return page.locator(sel).evaluate("""el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {
      x:r.x,y:r.y,w:r.width,h:r.height,display:s.display,position:s.position
    }}""")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1680,"height":1050})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    page.wait_for_timeout(1500)

    # Accepted V50 viewer geometry remains unchanged between Steps 2 and 3.
    page.locator('[data-guided-go="2"]').click()
    page.wait_for_timeout(350)
    s2=rect(page,"#led-canvas")

    page.locator('[data-guided-go="3"]').click()
    page.wait_for_timeout(600)
    s3=rect(page,"#led-canvas")
    assert abs(s3["w"]-s2["w"])<=2,(s2,s3)
    assert abs(s3["h"]-s2["h"])<=2,(s2,s3)

    # Mounting choice removed from customer workflow but ceiling remains the internal default.
    hidden=page.locator("#projection-mounting-style-v51-hidden")
    assert hidden.count()==1
    assert hidden.input_value()=="ceiling"
    assert not hidden.is_visible()
    assert not page.locator("#projection-mounting-note").is_visible()

    # Preferences moved before CTA and clearance defaults to 20 cm.
    prefs=page.locator(".guided-preferences.v51-preferences")
    cta=page.locator("#guided-calculate")
    assert prefs.count()==1 and cta.count()==1
    assert prefs.evaluate("(a,b)=>a.compareDocumentPosition(b)&Node.DOCUMENT_POSITION_FOLLOWING",cta.element_handle())
    assert page.locator("#guided-mount-drop").input_value() in ["0.20","0.2"]
    assert "20 cm ceiling clearance" in (prefs.locator("summary").text_content() or "")
    assert (cta.text_content() or "").strip()=="Click To Generate Projector Profile"

    # Exactly the four requested overlay controls moved inside viewer.
    overlay=page.locator("#v51-viewer-overlays")
    assert overlay.count()==1 and overlay.is_visible()
    for control_id in ["projection-coverage","projection-shadows","projection-frusta","projection-structure"]:
      assert overlay.locator("#"+control_id).count()==1
    assert overlay.locator("#projection-manual-viewer").count()==0
    home=rect(page,"#led-canvas-home"); ov=rect(page,"#v51-viewer-overlays")
    assert ov["x"]>=home["x"] and ov["y"]>=home["y"],(home,ov)
    assert ov["x"]+ov["w"]<=home["x"]+home["w"]+2,(home,ov)

    # Pilot/simulator controls remain in their original area, not inside viewer overlay.
    assert overlay.locator("#led-pilot-view").count()==0
    assert overlay.locator("#led-simulatorType").count()==0
    assert page.locator("#led-pilot-seat").count()==1
    assert page.locator("#led-simulatorType").count()==1

    browser.close()

print("V51 STEP 3 SIMPLIFICATION ACCEPTANCE PASS")
