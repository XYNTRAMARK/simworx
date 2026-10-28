from playwright.sync_api import sync_playwright
import json
END='euttubfvsrgkeiescsdm.supabase.co/functions/v1/simworx-intelligence'
def names(captured):
    out=[]
    for item in captured:
        try:
            payload=json.loads(item)
            out += [e.get('event_name') for e in payload.get('events',[])]
        except: pass
    return out
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    # Cockpit journey
    p=b.new_page(viewport={"width":1440,"height":900});capt=[]
    p.route("**/functions/v1/simworx-intelligence",lambda route,req:(capt.append(req.post_data or ''),route.fulfill(status=200,content_type="application/json",body='{"ok":true,"accepted":20}')))
    p.goto("https://www.sim-worx.com/a320-full-cockpit.html?wi-validation=1",wait_until="domcontentloaded",timeout=60000);p.wait_for_timeout(800)
    p.evaluate("window.SimworxIntelligence && window.SimworxIntelligence.setConsent({analytics:true})");p.wait_for_timeout(300)
    p.evaluate("""() => {
      const radios=[...document.querySelectorAll('input[name="mip-package"]')];
      const target=radios[1]||radios[0];
      if(target){target.checked=true;target.dispatchEvent(new Event('change',{bubbles:true}));}
    }""")
    p.wait_for_timeout(100)
    region=p.locator('#framecfg-region')
    if region.count() and region.locator('option').count()>1:region.select_option(index=1)
    p.locator('#framecfg-quote').click(force=True);p.wait_for_timeout(200)
    p.evaluate("window.SimworxIntelligence.flush()");p.wait_for_timeout(400)
    cockpit_names=names(capt);print("COCKPIT_EVENTS",cockpit_names)
    required={'cockpit_configurator_opened','cockpit_configurator_started','product_configurator_opened','product_configurator_started','simulator_model_selected','product_option_selected','product_delivery_selected','product_quote_started'}
    assert required.issubset(set(cockpit_names)),required-set(cockpit_names)
    p.close()

    # Product selection
    p=b.new_page(viewport={"width":1440,"height":900});capt=[]
    p.route("**/functions/v1/simworx-intelligence",lambda route,req:(capt.append(req.post_data or ''),route.fulfill(status=200,content_type="application/json",body='{"ok":true,"accepted":20}')))
    p.goto("https://www.sim-worx.com/frames.html?wi-validation=1",wait_until="domcontentloaded",timeout=60000);p.wait_for_timeout(500)
    p.evaluate("window.SimworxIntelligence && window.SimworxIntelligence.setConsent({analytics:true}); document.addEventListener('click',e=>{if(e.target.closest('a[href*=\"a320-full-cockpit.html\"]'))e.preventDefault()},true)")
    p.locator('a[href*="a320-full-cockpit.html"]').last.click(force=True);p.wait_for_timeout(100);p.evaluate("window.SimworxIntelligence.flush()");p.wait_for_timeout(300)
    frame_names=names(capt);print("FRAME_EVENTS",frame_names);assert 'product_configurator_selected' in frame_names
    p.close()

    # Software product click
    p=b.new_page(viewport={"width":1440,"height":900});capt=[]
    p.route("**/functions/v1/simworx-intelligence",lambda route,req:(capt.append(req.post_data or ''),route.fulfill(status=200,content_type="application/json",body='{"ok":true,"accepted":20}')))
    p.goto("https://www.sim-worx.com/software.html?wi-validation=1",wait_until="domcontentloaded",timeout=60000);p.wait_for_timeout(500)
    p.evaluate("window.SimworxIntelligence && window.SimworxIntelligence.setConsent({analytics:true}); document.addEventListener('click',e=>{if(e.target.closest('a[href*=\"simstarter.html\"]'))e.preventDefault()},true)")
    p.locator('a[href*="simstarter.html"]').first.click(force=True);p.wait_for_timeout(100);p.evaluate("window.SimworxIntelligence.flush()");p.wait_for_timeout(300)
    software_names=names(capt);print("SOFTWARE_EVENTS",software_names);assert 'software_product_clicked' in software_names
    p.close();b.close()
print("WEBSITE_INTELLIGENCE_BUSINESS_V1_LIVE_TEST_PASS")
