"""V0.4.1 full-project browser smoke. Run after starting HTTP server in project-hub:
python3 -m http.server 8765
python3 tests/browser-materials-v041.py
Requires Playwright and a Chromium browser. Does not use production."""
from playwright.sync_api import sync_playwright
import os

URL=os.environ.get("PROJECT_HUB_URL","http://127.0.0.1:8765")
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium"))
    page=browser.new_page(accept_downloads=True)
    errors=[]
    page.on("pageerror",lambda err: errors.append(str(err)))
    page.goto(URL, wait_until="networkidle")
    page.evaluate("localStorage.removeItem('simworx-project-hub-demo-v1')")
    page.reload(wait_until="networkidle")
    assert page.locator(".version-chip").inner_text()=="V0.4.1"
    page.locator('[data-action="nav"][data-id="projects"]').click()
    page.locator('[data-action="project-tab"][data-id="register"]').click()
    assert "Work register" in page.locator("body").inner_text()
    page.locator('[data-action="project-tab"][data-id="schedule"]').click()
    assert "Gantt" in page.locator("body").inner_text()
    page.locator('[data-action="project-tab"][data-id="procurement"]').click()
    assert page.locator('form[data-form="v41-requirement"]').count()==1
    page.locator('form[data-form="v41-requirement"] select[name="partId"]').select_option("part4")
    page.locator('form[data-form="v41-requirement"] input[name="quantity"]').fill("2")
    page.locator('form[data-form="v41-requirement"] input[name="position"]').fill("V041-SMOKE")
    page.locator('form[data-form="v41-requirement"] button[type="submit"]').click()
    assert "V041-SMOKE" in page.evaluate("localStorage.getItem('simworx-project-hub-demo-v1')")
    page.locator('[data-action="nav"][data-id="purchasing"]').click()
    page.locator('[data-action="v41-order-new"]').first.click()
    page.locator('form[data-form="v41-po"] input[name="supplier"]').fill("Demo Test Supplier")
    page.locator('form[data-form="v41-po"] input[name="poQty"]').first.fill("5")
    page.locator('[data-action="v41-add-po-line"]').click()
    assert page.locator('form[data-form="v41-po"] [data-v41-po-line]').count()==2
    page.locator('form[data-form="v41-po"] input[name="poQty"]').nth(1).fill("3")
    page.locator('form[data-form="v41-po"] select[name="poPart"]').nth(1).select_option("part4")
    page.locator('form[data-form="v41-po"] button[type="submit"]').click()
    assert "Demo Test Supplier" in page.locator("body").inner_text()
    assert page.locator('form[data-form="v41-tracking"]').count()==1
    page.locator('form[data-form="v41-tracking"] input[name="carrier"]').fill("Example Courier")
    page.locator('form[data-form="v41-tracking"] input[name="trackingCode"]').fill("TRACK-SMOKE-01")
    page.locator('form[data-form="v41-tracking"] button[type="submit"]').click()
    assert "TRACK-SMOKE-01" in page.locator("body").inner_text()
    page.locator('[data-action="nav"][data-id="inventory"]').click()
    assert "Workshop stock & allocations" in page.locator("body").inner_text()
    page.locator('[data-action="nav"][data-id="client"]').click()
    assert "TRACK-SMOKE-01" not in page.locator("body").inner_text()
    page.locator('[data-action="nav"][data-id="settings"]').click()
    assert page.locator('[data-action="v41-backup"]').count()==1
    assert not errors,errors
    print("V0.4.1 full browser smoke: PASS")
    browser.close()
