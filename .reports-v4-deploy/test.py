from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1600,"height":1000})
    p.goto("https://www.sim-worx.com/reports/?reporting-v4=1",wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1000)
    # Demo mode verifies rendering without using the private reports PIN.
    p.locator('#demo-login').click();p.wait_for_timeout(1200)
    p.locator('[data-page="traffic"]').click();p.wait_for_timeout(500)
    traffic=p.locator('#main-content').inner_text()
    assert 'OpenAI Ads traffic reconciliation' in traffic
    assert 'Cockpit product journey' in traffic
    assert 'Software interest' in traffic
    p.locator('[data-page="configurators"]').click();p.wait_for_timeout(500)
    conf=p.locator('#main-content').inner_text()
    assert 'Where sessions stopped' in conf
    assert 'Aircraft & simulator choices' in conf
    assert 'Cockpit configurators' in conf
    b.close()
print("REPORTS_V4_UI_BROWSER_PASS")
