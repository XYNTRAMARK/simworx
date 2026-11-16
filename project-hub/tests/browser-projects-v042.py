"""V0.4.2 full-browser acceptance smoke; no production network actions.
Run from project-hub: python3 -m http.server 8765
Then in a separate terminal: python3 tests/browser-projects-v042.py
Requires Playwright + Chromium. This is an optional verification script, not a test already run.
"""
from playwright.sync_api import sync_playwright
import os

URL=os.environ.get("PROJECT_HUB_URL","http://127.0.0.1:8765")
with sync_playwright() as pw:
    browser=pw.chromium.launch(headless=True, executable_path=os.environ.get("CHROMIUM_PATH","/usr/bin/chromium"))
    page=browser.new_page(accept_downloads=True)
    errors=[]
    page.on("pageerror",lambda exc:errors.append(str(exc)))
    page.goto(URL,wait_until="networkidle")
    page.evaluate("localStorage.removeItem('simworx-project-hub-demo-v1')")
    page.reload(wait_until="networkidle")
    assert page.locator(".version-chip").inner_text()=="V0.4.2"
    page.locator('[data-action="nav"][data-id="projects"]').click()
    assert page.locator('.v42-project-switch').count()==1
    assert page.locator('.v42-project-summary').count()==1
    assert page.get_by_text("All active projects",exact=True).count()==0
    page.locator('[data-action="v42-toggle-project-list"]').click()
    assert page.get_by_text("All active projects",exact=True).count()==1
    page.locator('[data-action="v42-toggle-project-list"]').click()
    page.locator('[data-action="project-tab"][data-id="budget"]').first.click()
    assert page.get_by_text("Project budget control").count()==1
    page.locator('form[data-form="v42-budget"] input[name="budget"]').fill("100000")
    page.locator('form[data-form="v42-budget"] input[name="spent"]').fill("500")
    page.locator('form[data-form="v42-budget"] input[name="committed"]').fill("100")
    page.locator('form[data-form="v42-budget"] button[type="submit"]').click()
    assert "100000" in page.evaluate("localStorage.getItem('simworx-project-hub-demo-v1')")
    page.locator('[data-action="project-tab"][data-id="procurement"]').first.click()
    assert page.locator('[data-action="v42-material-edit"]').count()>0
    page.locator('[data-action="v42-material-edit"]').first.click()
    assert page.locator('form[data-form="v42-material-edit"]').count()==1
    page.locator('form[data-form="v42-material-edit"] input[name="quantity"]').fill("7")
    page.locator('form[data-form="v42-material-edit"] button[type="submit"]').click()
    assert page.locator('form[data-form="v42-material-edit"]').count()==0
    page.locator('[data-action="nav"][data-id="purchasing"]').click()
    stage=page.locator('select[data-v42-delivery]').first
    assert stage.count()==1
    stage.select_option("Out for delivery")
    assert page.get_by_text("Out for delivery",exact=True).count()>0
    page.locator('[data-action="nav"][data-id="projects"]').click()
    page.locator('[data-action="project-tab"][data-id="register"]').click()
    assert "Work register" in page.locator("body").inner_text()
    page.locator('[data-action="project-tab"][data-id="schedule"]').click()
    assert "Gantt" in page.locator("body").inner_text()
    page.locator('[data-action="nav"][data-id="client"]').click()
    assert "100000" not in page.locator("body").inner_text()
    assert errors==[],errors
    print("Project Hub V0.4.2 focused-project/browser smoke: PASS")
    browser.close()
