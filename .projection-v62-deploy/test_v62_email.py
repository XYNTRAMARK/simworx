from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v62.html"
snapshot={
  "configuration":{"currency":"GBP","diameter":4.5,"horizontalFov":180,"viewableHeight":2.4,"screenBottom":0.35,"simulatorType":"airliner","mountingStyle":"ceiling","room":{"width":6,"depth":6,"height":3.2},"projectors":[]},
  "quote":{"reference":"SWX-PROJ-V62-TEST","date":"2026-10-26","lineItems":[{"id":"screen","label":"Projection screen and frame","amount":12000,"status":"priced"}]}
}

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
    p.evaluate("""snap=>{
      window.SimworxProjection={snapshot:()=>snap};
      document.querySelectorAll('[data-guided-go]').forEach(b=>b.removeAttribute('aria-current'));
      document.querySelector('[data-guided-go="4"]').setAttribute('aria-current','step');
    }""",snapshot)
    p.wait_for_timeout(700)

    # Use route interception to emulate the same-origin PHP response to the native form POST.
    captured={}
    def route_handler(route,request):
        if 'projection-quote-submit.php' in request.url and request.method=='POST':
            captured['url']=request.url
            captured['method']=request.method
            captured['post']=request.post_data or ''
            route.fulfill(status=200,content_type='application/json',body='{"ok":true,"reference":"SWX-PROJ-V62-TEST"}')
        else:
            route.continue_()
    p.route('**/*',route_handler)

    p.locator('#v37-email-proposal').click();p.wait_for_timeout(250)
    p.locator('#v37-email-address').fill('test@example.com')
    p.locator('#v37-email-name').fill('Native Submit Test')
    p.locator('#v37-email-send').click()
    p.wait_for_timeout(1800)

    status=p.locator('#v37-proposal-status').text_content() or ''
    email_status=p.locator('#v37-email-status').text_content() or ''
    print("V62_NATIVE_SUBMIT",{"captured":captured,"status":status,"email_status":email_status})
    assert captured.get('method')=='POST',captured
    assert 'proposal_html' in captured.get('post',''),captured
    assert 'proposal_text' in captured.get('post',''),captured
    assert 'cf-turnstile-response' in captured.get('post',''),captured
    assert 'sent successfully' in status.lower(),(status,email_status)

    # Old fetch transport is gone.
    script=p.locator('#projection-v37-proposal-js').text_content() or ''
    assert "const response=await fetch(form.action" not in script
    assert "HTMLFormElement.prototype.submit.call(form)" in script

    # Unrelated accepted UI remains.
    assert not p.locator('.projection-material-bar').is_visible()
    assert p.locator('.led-estimate-bar').bounding_box()['height']<=92
    assert p.locator('#v30-throw').count()==1
    b.close()

print("V62 NATIVE FORM EMAIL TRANSPORT PASS")
