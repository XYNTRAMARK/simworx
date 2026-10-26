from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v59.html"

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1680,"height":1050})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1400)

    # The material selector still exists for inherited state logic, but is not customer-visible.
    bar=p.locator('.projection-material-bar')
    assert bar.count()==1
    assert not bar.is_visible()

    # Default material controls/state still exist; no logic has been removed.
    assert p.locator('#projection-materials').count()==1

    # Critical neighbouring Step 2 and global elements remain untouched.
    for sel in [
        '.led-shape-bar',
        '#led-diameter',
        '#led-horizontalFov',
        '#led-viewableHeight',
        '#led-screenBottom',
        '#led-canvas-home',
        '.led-estimate-bar',
        '#guided-calculate',
        '#v37-email-proposal'
    ]:
        assert p.locator(sel).count()==1,sel

    # Price bar from V58 remains compact.
    price=p.locator('.led-estimate-bar').bounding_box()
    assert price and price['height']<=92,price

    b.close()

print("V59 MATERIAL BAR REMOVAL ACCEPTANCE PASS")
