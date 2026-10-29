from playwright.sync_api import sync_playwright
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1440,"height":900})
    p.goto("https://www.sim-worx.com/projection-screen-configurator.html?utm_source=tracking_validation&utm_medium=verification&utm_campaign=TRACKING-VALIDATION-REPORTINGV4-SMOKE",wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(2500)
    scripts=p.locator('script[src*="simworx-intelligence"]').evaluate_all("els=>els.map(e=>e.src)")
    print("PROJECTION_TRACKING_SCRIPTS",scripts)
    assert any("simworx-intelligence-bootstrap-v1.js" in x for x in scripts)
    b.close()
print("REPORTING_V4_BROWSER_PASS")
