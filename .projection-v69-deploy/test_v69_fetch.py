from playwright.sync_api import sync_playwright
URL="http://127.0.0.1:8765/projection-screen-configurator-v69.html"
with sync_playwright() as pw:
    b=pw.chromium.launch(headless=True)
    p=b.new_page()
    p.goto(URL,wait_until="domcontentloaded",timeout=60000)
    p.wait_for_timeout(1200)
    info=p.evaluate("""() => ({
      hasNative:typeof window.__simworxProjectionNativeFetch==='function',
      hasOffline:typeof window.__simworxProjectionOfflineFetch==='function',
      fetchString:String(window.fetch),
      offlineString:String(window.__simworxProjectionOfflineFetch)
    })""")
    print("V69_FETCH_ROUTER",info)
    assert info["hasNative"] and info["hasOffline"]
    assert "led-quote-submit.php" in info["fetchString"]
    assert info["hasOffline"]
    b.close()
print("V69 FETCH ROUTER LOCAL PASS")
