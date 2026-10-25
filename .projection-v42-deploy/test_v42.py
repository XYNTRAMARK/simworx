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

    # The local static acceptance server does not load the production 3D module
    # graph, so provide a deterministic canonical snapshot for the delivery layer.
    page.locator("body").evaluate("""(el)=>{
      if(!window.SimworxProjection?.snapshot?.()){
        window.SimworxProjection={
          snapshot:()=>({
            configuration:{
              currency:'GBP',diameter:4.5,horizontalFov:180,viewableHeight:2.4,
              screenBottom:0.35,simulatorType:'airliner',mountingStyle:'ceiling',
              room:{width:6,depth:6,height:3.2},notes:'Acceptance test proposal',
              projectors:[{id:'P1',position:[0,2.8,-2.2],yaw:0,pitch:-4,roll:0,throwRatio:0.8}]
            },
            quote:{
              reference:'SWX-PROJ-TEST',date:'2026-10-25',
              lineItems:[
                {id:'screen',label:'Projection screen and frame',amount:12000,status:'priced'},
                {id:'warping',label:'Warping / calibration package',amount:1500,status:'priced'}
              ]
            }
          })
        };
      }
    }""")

    # Put the inherited proposal controller into Step 4 so it initialises the
    # canonical proposal reference/state exactly as the live UI does.
    page.wait_for_timeout(1200)
    assert page.locator("#v37-proposal").get_attribute("data-bound")=="true"
    page.locator("[data-guided-go]").evaluate_all("(els)=>els.forEach(el=>el.setAttribute('aria-current',''))")
    page.locator('[data-guided-go="4"]').evaluate("(el)=>el.setAttribute('aria-current','step')")
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
    email_status=page.locator("#v37-email-status").inner_text()
    print("PROPOSAL_STATUS",status)
    print("EMAIL_STATUS",email_status)
    assert "sent successfully" in status.lower(), (status,email_status)

    assert page.locator("body").evaluate("(el)=>document.documentElement.innerHTML.includes('projection-quote-submit.php')")
    assert page.locator("body").evaluate("(el)=>document.documentElement.innerHTML.includes('Commercial proposal')")
    page.screenshot(path="/tmp/v42-proof.png",full_page=True)
    browser.close()

print("V42 acceptance PASS")
