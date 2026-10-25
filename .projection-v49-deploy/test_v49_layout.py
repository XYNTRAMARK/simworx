from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v49.html"

def rect(page,sel):
    return page.locator(sel).evaluate("""el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {
      x:r.x,y:r.y,w:r.width,h:r.height,grid:s.gridTemplateColumns,padding:s.padding,position:s.position
    }}""")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1680,"height":1050})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    page.wait_for_timeout(1500)
    page.locator('[data-guided-go="3"]').click()
    page.wait_for_timeout(700)

    assert "v49-step3" in (page.locator(".led-workbench").get_attribute("class") or "")

    work=rect(page,".led-workbench")
    planner=rect(page,".guided-planner")
    preview=rect(page,"#led-preview")
    row=rect(page,"#projection-v29-edit-row")
    viewer=rect(page,"#led-canvas-home")
    canvas=rect(page,"#led-canvas")
    controls=rect(page,"#projection-v25-controls")

    print("V49_GEOMETRY",{"workbench":work,"planner":planner,"preview":preview,"row":row,"viewer":viewer,"canvas":canvas,"controls":controls})

    assert 1170 <= work["w"] <= 1190, work
    assert 230 <= planner["w"] <= 265, planner
    assert preview["w"] >= 890, preview
    assert viewer["w"] >= 590, viewer
    assert controls["w"] <= 260, controls
    assert viewer["w"] >= controls["w"]*2.2, (viewer,controls)
    assert canvas["h"] >= 600, canvas

    # Responsive fallback must stack instead of crushing the viewer.
    page.set_viewport_size({"width":900,"height":1000})
    page.wait_for_timeout(300)
    work_small=rect(page,".led-workbench")
    row_small=rect(page,"#projection-v29-edit-row")
    viewer_small=rect(page,"#led-canvas-home")
    controls_small=rect(page,"#projection-v25-controls")
    print("V49_SMALL",{"workbench":work_small,"row":row_small,"viewer":viewer_small,"controls":controls_small})
    assert len(work_small["grid"].split())==1, work_small
    assert len(row_small["grid"].split())==1, row_small
    assert viewer_small["w"]>700, viewer_small
    assert controls_small["w"]>700, controls_small

    browser.close()

print("V49 VIEWER PRIORITY ACCEPTANCE PASS")
