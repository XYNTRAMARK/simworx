from playwright.sync_api import sync_playwright

URL="http://127.0.0.1:8765/projection-screen-configurator-v58.html"

def rect(page,sel):
    return page.locator(sel).evaluate("""el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {
      x:r.x,y:r.y,w:r.width,h:r.height,position:s.position,top:s.top
    }}""")

with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page(viewport={"width":1680,"height":1050})
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1400)

    bar=rect(p,'.led-estimate-bar')
    shell=rect(p,'.led-shell') if p.locator('.led-shell').count() else None
    title=rect(p,'#led-running-title')
    total=rect(p,'#led-running-total')
    note=rect(p,'#led-running-note')
    currency=rect(p,'#projection-currency')
    print("V58_PRICE_BAR",{"bar":bar,"shell":shell,"title":title,"total":total,"note":note,"currency":currency})

    assert bar["h"] <= 92, bar
    assert bar["w"] > 1000, bar
    assert total["y"] >= bar["y"] and total["y"]+total["h"] <= bar["y"]+bar["h"]+2
    assert currency["y"] >= bar["y"]-2 and currency["y"]+currency["h"] <= bar["y"]+bar["h"]+2

    # Sticky behavior remains: when scrolled, the price bar should still sit below the fixed site header.
    p.evaluate("window.scrollTo(0,700)")
    p.wait_for_timeout(250)
    scrolled=rect(p,'.led-estimate-bar')
    header=rect(p,'.global-header')
    print("V58_STICKY",{"bar":scrolled,"header":header})
    assert abs(scrolled["y"]-(header["y"]+header["h"])) <= 3, (scrolled,header)

    # Critical inherited features still exist.
    for marker in ['#guided-calculate','#led-canvas-home','#projection-v25-controls','#v39-country','#v37-email-proposal']:
        assert p.locator(marker).count()==1,marker

    b.close()

print("V58 COMPACT PRICE BAR ACCEPTANCE PASS")
