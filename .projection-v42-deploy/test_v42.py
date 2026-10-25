from pathlib import Path
from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v42.html"

with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={"width":1440,"height":1000})
    page.add_init_script("""
      window.turnstile={
        render:(el,opts)=>{el.dataset.fake='ready';return 7},
        getResponse:(id)=>id===7?'test-turnstile-token':'',
        reset:()=>{}
      };
    """)
    page.route("**/projection-quote-submit.php",lambda route: route.fulfill(
        status=200,
        content_type="application/json",
        body='{"ok":true,"message":"Proposal sent successfully.","reference":"SWX-PROJ-TEST"}'
    ))
    page.goto(URL,wait_until="domcontentloaded",timeout=30000)
    page.wait_for_function("document.getElementById('v37-email-proposal') !== null",timeout=20000)

    # Put the inherited proposal controller into Step 4 so it initialises the
    # canonical proposal reference/state exactly as the live UI does.
    page.wait_for_timeout(1200)
    assert page.locator("#v37-proposal").get_attribute("data-bound")=="true"
    for button in page.locator("[data-guided-go]").all():
        button.remove_attribute("aria-current")
    page.locator('[data-guided-go="4"]').set_attribute("aria-current","step")
    page.wait_for_timeout(800)
    assert not page.locator("#v37-proposal").is_hidden()

    assert page.locator("#v37-print-proposal").inner_text()=="Save proposal as PDF"
    assert page.locator("#v37-download-proposal").is_hidden()

    page.locator("#v37-email-proposal").click()
    assert page.locator("#v37-email-dialog").is_visible()
    assert page.locator("#v37-email-send").inner_text()=="Send proposal"
    page.locator("#v37-email-address").fill("mark@sim-worx.com")
    page.locator("#v37-email-name").fill("Mark")

    # Ensure proposal state exists before submit. If Step 4 is not current, direct
    # handler still uses the canonical snapshot exposed by the configurator.
    page.wait_for_timeout(300)
    assert page.locator("#v42-projection-turnstile").get_attribute("data-fake")=="ready"
    page.locator("#v37-email-send").click()
    page.wait_for_timeout(900)
    status=page.locator("#v37-proposal-status").inner_text()
    assert "sent successfully" in status.lower()

    assert page.locator("body").evaluate("(el)=>document.documentElement.innerHTML.includes('projection-quote-submit.php')")
    assert page.locator("body").evaluate("(el)=>document.documentElement.innerHTML.includes('Commercial proposal')")
    page.screenshot(path="/tmp/v42-proof.png",full_page=True)
    browser.close()

print("V42 acceptance PASS")
