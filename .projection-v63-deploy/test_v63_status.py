from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v63.html"

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1440,"height":950})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1200)

    # Seed the exact stale state the user reported.
    p.evaluate("""() => {
      const s=document.getElementById('v37-email-status');
      s.textContent='Unable to send the proposal.';
      s.classList.add('v48-error');
    }""")

    p.evaluate("""() => document.getElementById('v37-email-proposal').dispatchEvent(new MouseEvent('click',{bubbles:true}))""")
    p.wait_for_timeout(150)

    status=p.locator('#v37-email-status')
    assert (status.text_content() or '')==''
    classes=status.get_attribute('class') or ''
    assert 'v48-error' not in classes and 'v42-error' not in classes
    assert p.locator('#v37-email-dialog').is_visible()

    # Email transport and unrelated accepted UI remain present.
    script=p.locator('#projection-v37-proposal-js').text_content() or ''
    assert "HTMLFormElement.prototype.submit.call(form)" in script
    assert not p.locator('.projection-material-bar').is_visible()
    assert p.locator('.led-estimate-bar').bounding_box()['height']<=92
    assert p.locator('#v30-throw').count()==1

    b.close()

print("V63 STALE EMAIL STATUS RESET PASS")
