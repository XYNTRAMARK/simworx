from playwright.sync_api import sync_playwright
URL="http://127.0.0.1:8765/projection-screen-configurator-v71.html"
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1440,"height":900})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1000)
    h1=p.locator("h1").first.inner_text()
    body=p.locator("body").inner_text()
    print("V71_H1",h1)
    assert h1=="Build your own projection screen using our configurator and get an instant price."
    assert body.count("Build your own projection screen using our configurator and get an instant price.")==1
    # Critical inherited features remain.
    assert p.locator("#v37-email-proposal").count()==1
    assert p.locator("#v65-save-pdf").count()==1
    assert p.locator("#guided-calculate").count()==1
    assert p.locator("#led-canvas-home").count()==1
    b.close()
print("V71 HEADLINE-ONLY ACCEPTANCE PASS")
