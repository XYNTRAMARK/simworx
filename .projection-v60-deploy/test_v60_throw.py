from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v60.html"

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1680,"height":1050})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1400)

    p.locator('[data-guided-go="3"]').click()
    p.wait_for_timeout(800)

    slider=p.locator('#v30-throw')
    scale=p.locator('.v30-throw-scale')
    spans=scale.locator('span')
    assert slider.count()==1 and spans.count()==4

    sb=slider.bounding_box()
    boxes=[spans.nth(i).bounding_box() for i in range(4)]
    centers=[b['x']+b['width']/2 for b in boxes]
    rel=[(c-sb['x'])/sb['width'] for c in centers]
    print("V60_THROW_SCALE",{"slider":sb,"centers":centers,"relative":rel})

    assert abs(rel[0]-0.0)<0.06,rel
    assert abs(rel[1]-0.08333)<0.04,rel
    assert abs(rel[2]-0.38889)<0.04,rel
    assert abs(rel[3]-1.0)<0.06,rel

    # Slider logic/range untouched.
    assert slider.get_attribute('min')=="0.30"
    assert slider.get_attribute('max')=="2.10"
    assert slider.get_attribute('step')=="0.005"

    # Recent accepted features remain.
    assert not p.locator('.projection-material-bar').is_visible()
    price=p.locator('.led-estimate-bar').bounding_box()
    assert price and price['height']<=92

    b.close()

print("V60 THROW LEGEND ALIGNMENT PASS")
