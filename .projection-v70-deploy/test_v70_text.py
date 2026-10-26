from playwright.sync_api import sync_playwright
URL="http://127.0.0.1:8765/projection-screen-configurator-v70.html"
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1440,"height":900})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1000)
    body=p.locator("body").inner_text()
    assert "Build your own projection screen using our configurator and get an instant price." in body
    assert "Design the screen around your room and cockpit, then calculate the projector specification and mounting geometry your installation requires." not in body
    # Critical inherited features remain present.
    assert p.locator("#v37-email-proposal").count()==1
    assert p.locator("#v65-save-pdf").count()==1
    assert p.locator("#guided-calculate").count()==1
    assert p.locator("#led-canvas-home").count()==1
    b.close()
print("V70 INTRO TEXT ONLY ACCEPTANCE PASS")
