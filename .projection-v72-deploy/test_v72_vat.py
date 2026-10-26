from playwright.sync_api import sync_playwright
URL="http://127.0.0.1:8765/projection-screen-configurator-v72.html"

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    for width in [1440,1280,1024]:
        p=b.new_page(viewport={"width":width,"height":900})
        p.goto(URL,wait_until="domcontentloaded",timeout=60000)
        p.wait_for_timeout(1000)

        # Reveal proposal surface only for geometry inspection; do not alter application logic.
        p.evaluate("""() => {
          const proposal=document.getElementById('v37-proposal');
          if(proposal)proposal.hidden=false;
        }""")
        p.wait_for_timeout(150)

        box=p.locator('#v55-vat-selector')
        card=box.locator('xpath=ancestor::aside[contains(@class,"v37-proposal-card")]')
        assert box.count()==1 and card.count()==1
        br=box.bounding_box();cr=card.bounding_box()
        country=p.locator('#v39-country').bounding_box()
        customer=p.locator('#v37-customer-type').bounding_box()
        print("V72_GEOMETRY",width,{"box":br,"card":cr,"country":country,"customer":customer})
        eps=1.5
        assert br["x"]>=cr["x"]-eps
        assert br["x"]+br["width"]<=cr["x"]+cr["width"]+eps
        assert country["x"]+country["width"]<=br["x"]+br["width"]+eps
        assert customer["x"]+customer["width"]<=br["x"]+br["width"]+eps

        # Critical inherited functionality remains present.
        assert p.locator('#v37-email-proposal').count()==1
        assert p.locator('#v65-save-pdf').count()==1
        assert p.locator('#guided-calculate').count()==1
        p.close()
    b.close()

print("V72 VAT CONTAINMENT PASS")
