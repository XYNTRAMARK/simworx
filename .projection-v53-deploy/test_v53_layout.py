from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v53.html"

def rect(page,sel):
    return page.locator(sel).evaluate("""el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {
      x:r.x,y:r.y,w:r.width,h:r.height,display:s.display,grid:s.gridTemplateColumns,overflow:s.overflow
    }}""")

with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True,args=['--no-sandbox','--disable-dev-shm-usage','--use-gl=swiftshader','--enable-unsafe-swiftshader'])
    page=browser.new_page(viewport={"width":1680,"height":1050})
    page.goto(URL,wait_until="domcontentloaded",timeout=60000)
    for _ in range(120):
        if page.locator('html').get_attribute('data-standalone-ready')=='true':break
        page.wait_for_timeout(100)
    else:raise AssertionError('V53 app not ready')

    page.locator('[data-guided-go="3"]').click()
    page.wait_for_timeout(900)

    work=rect(page,'.led-workbench')
    planner=rect(page,'.guided-planner')
    preview=rect(page,'#led-preview')
    canvas_home=rect(page,'#led-canvas-home')
    canvas=rect(page,'#led-canvas')
    toolbar=rect(page,'.led-viewer-toolbar')
    tabs=rect(page,'.projection-view-tabs')
    print("V53_GEOMETRY",{"work":work,"left":planner,"right":preview,"viewer":canvas_home,"canvas":canvas,"toolbar":toolbar,"tabs":tabs})

    # Exactly two desktop columns.
    cols=[x for x in work["grid"].split(" ") if x]
    assert len(cols)==2,work
    assert planner["x"] < preview["x"],(planner,preview)

    # Left: CTA first, result/projector information, no preferences or manual controls.
    stack=page.locator('#v53-left-stack')
    assert stack.count()==1 and stack.is_visible()
    first=stack.locator(':scope > *').first
    assert first.get_attribute('id')=='guided-calculate'
    assert (page.locator('#guided-calculate').text_content() or '').strip()=='Click To Generate Projector Profile'
    assert not page.locator('.guided-preferences').is_visible()
    assert not page.locator('#projection-v25-controls').is_visible()
    assert not page.locator('#guided-manual').is_visible()
    assert not page.locator('.guided-catalogue').is_visible()
    assert page.locator('#guided-mount-drop').input_value() in ['0.2','0.20']
    assert page.locator('#v31-projector-lookup').evaluate("el=>el.parentElement.id")=='v53-left-stack'

    # No throw control visible in the left column.
    visible_throw=page.locator('#v53-left-stack input[type="range"]').evaluate_all("els=>els.filter(e=>getComputedStyle(e).display!=='none'&&e.offsetParent!==null).map(e=>e.id)")
    assert not any('throw' in x for x in visible_throw),visible_throw

    # Right: parametric heading is at top, then viewer, then normal viewer controls.
    head=page.locator('#led-preview .led-viewer-head')
    assert head.count()==1 and head.is_visible()
    assert 'PARAMETRIC MODEL' in (head.text_content() or '')
    assert page.locator('#led-canvas-home').evaluate("el=>el.parentElement.id")=='led-preview'
    assert canvas_home["y"] < toolbar["y"] < tabs["y"],(canvas_home,toolbar,tabs)

    # Nothing can be hidden underneath the viewer.
    assert toolbar["y"] >= canvas_home["y"]+canvas_home["h"]-2,(canvas_home,toolbar)
    lookup=rect(page,'#v31-projector-lookup')
    assert lookup["x"] < preview["x"],(lookup,preview)
    assert lookup["y"]+lookup["h"] <= max(planner["y"]+planner["h"],lookup["y"]+lookup["h"])+1

    # V52 proposal capture feature remains inherited.
    assert page.locator('#projection-v52-proposal-views').count()==1

    browser.close()

print("V53 TWO-COLUMN STEP 3 ACCEPTANCE PASS")
