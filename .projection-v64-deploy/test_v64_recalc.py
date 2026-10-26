from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v64.html"

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1680,"height":1050})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1400)

    strip=p.locator('#guided-viewer-status')
    recalc=p.locator('#guided-recalculate')
    assert strip.count()==1
    assert recalc.count()==1
    assert not strip.is_visible()

    # Underlying elements/logic remain in DOM; only visibility changed.
    assert p.locator('#guided-viewer-status-text').count()==1
    assert p.locator('#led-canvas-home').count()==1
    assert p.locator('#projection-v25-controls').count()==1
    assert p.locator('#v30-throw').count()==1
    assert p.locator('#v37-email-proposal').count()==1

    # Recent accepted UI remains intact.
    assert not p.locator('.projection-material-bar').is_visible()
    price=p.locator('.led-estimate-bar').bounding_box()
    assert price and price['height']<=92

    b.close()

print("V64 RECALCULATE STRIP VISIBILITY-ONLY PASS")
