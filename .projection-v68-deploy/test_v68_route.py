from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v68.html"
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1440,"height":950})
    p.add_init_script("""
      window.turnstile={
        render:(el,opts)=>{const i=document.createElement('input');i.type='hidden';i.name='cf-turnstile-response';i.value='token';el.appendChild(i);setTimeout(()=>opts.callback?.('token'),0);return 7},
        getResponse:id=>id===7?'token':'',reset:()=>{}
      };
    """)
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1200)
    form=p.locator('#v48-email-form')
    assert form.get_attribute('action')=='led-quote-submit.php'
    script=p.locator('#projection-v37-proposal-js').text_content() or ''
    assert "payload.set('quote_action','projection-email')" in script
    assert "projection_images" in script
    # Existing unrelated accepted UI remains.
    assert not p.locator('#guided-viewer-status').is_visible()
    assert not p.locator('.projection-material-bar').is_visible()
    assert p.locator('#v65-save-pdf').count()==1
    b.close()
print("V68 PROJECTION ROUTED THROUGH LED ENDPOINT PASS")
