from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v50.html"

def rect(page,sel):
    return page.locator(sel).evaluate("""el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {
      x:r.x,y:r.y,w:r.width,h:r.height,grid:s.gridTemplateColumns,padding:s.padding,display:s.display
    }}""")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1680,"height":1050})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    page.wait_for_timeout(1500)

    # Step 2 is the accepted reference geometry.
    page.locator('[data-guided-go="2"]').click()
    page.wait_for_timeout(500)
    step2_work=rect(page,".led-workbench")
    step2_preview=rect(page,"#led-preview")
    step2_viewer=rect(page,"#led-canvas-home")
    step2_canvas=rect(page,"#led-canvas")

    # Step 3 must not resize the viewer to make room for controls.
    page.locator('[data-guided-go="3"]').click()
    page.wait_for_timeout(700)
    classes=page.locator(".led-workbench").get_attribute("class") or ""
    assert "v49-step3" in classes and "v50-step3" in classes, classes
    step3_work=rect(page,".led-workbench")
    step3_preview=rect(page,"#led-preview")
    step3_viewer=rect(page,"#led-canvas-home")
    step3_canvas=rect(page,"#led-canvas")
    controls=rect(page,"#projection-v25-controls")

    print("V50_STEP2",{"work":step2_work,"preview":step2_preview,"viewer":step2_viewer,"canvas":step2_canvas})
    print("V50_STEP3",{"work":step3_work,"preview":step3_preview,"viewer":step3_viewer,"canvas":step3_canvas,"controls":controls})

    # The main right-hand viewing surface and canvas must remain the same size.
    assert abs(step3_preview["w"]-step2_preview["w"]) <= 2, (step2_preview,step3_preview)
    assert abs(step3_viewer["w"]-step2_viewer["w"]) <= 2, (step2_viewer,step3_viewer)
    assert abs(step3_canvas["w"]-step2_canvas["w"]) <= 2, (step2_canvas,step3_canvas)
    assert abs(step3_canvas["h"]-step2_canvas["h"]) <= 2, (step2_canvas,step3_canvas)

    # Tuning belongs below the viewer, never beside it.
    assert controls["y"] >= step3_viewer["y"] + step3_viewer["h"] - 2, (step3_viewer,controls)
    assert abs(controls["w"]-step3_viewer["w"]) <= 2, (step3_viewer,controls)

    # Mobile/tablet remains stacked.
    page.set_viewport_size({"width":900,"height":1000})
    page.wait_for_timeout(350)
    row=rect(page,"#projection-v29-edit-row")
    viewer=rect(page,"#led-canvas-home")
    controls_small=rect(page,"#projection-v25-controls")
    assert len(row["grid"].split())==1, row
    assert controls_small["y"] >= viewer["y"] + viewer["h"] - 2, (viewer,controls_small)

    browser.close()

print("V50 CONSISTENT VIEWER ACCEPTANCE PASS")
