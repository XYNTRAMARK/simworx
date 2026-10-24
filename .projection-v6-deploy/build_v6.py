from pathlib import Path
import subprocess, shutil

subprocess.run(['python3','.projection-v5-deploy/build_v5.py'],check=True)

p=Path('projection/src/app.js')
s=p.read_text()

# Initialise a display-only price gate. Quote calculations can continue internally.
anchor="let guided=null;\nlet customProfiles=[],initialising=true,geometryError=false,lastEnquiryKey=null;\n"
if anchor not in s:
    raise SystemExit('App state anchor not found')
s=s.replace(anchor,anchor+"let screenPriceActivated=false;\n",1)

# Suppress visible estimate until the customer actually edits Step 2 screen geometry.
old="""function renderQuote(){
  if(!quote)return;
  const partial=quote.status!=='complete';"""
new="""function renderQuote(){
  if(!quote)return;
  if(!screenPriceActivated){
    const zero=money(0);
    $('led-running-title').textContent='Your configuration estimate';
    $('led-running-total').textContent=zero;
    $('led-estimate').textContent=zero;
    $('led-running-note').textContent='Adjust the screen in Step 2 to calculate your estimate.';
    $('led-price-status').textContent='No screen price is shown until you start configuring the screen.';
    return;
  }
  const partial=quote.status!=='complete';"""
if old not in s:
    raise SystemExit('renderQuote anchor not found')
s=s.replace(old,new,1)

# Activate only from the screen geometry controls, not room controls.
old="""    if(value<min||value>max){input.setCustomValidity('Enter a value within the displayed preview range.');return;}input.setCustomValidity('');state[key]=value;update();
  }));"""
new="""    if(value<min||value>max){input.setCustomValidity('Enter a value within the displayed preview range.');return;}input.setCustomValidity('');
    if(state.guidedStep===2&&['diameter','horizontalFov','viewableHeight','screenBottom'].includes(key))screenPriceActivated=true;
    state[key]=value;update();
  }));"""
if old not in s:
    raise SystemExit('screen input listener anchor not found')
s=s.replace(old,new,1)

# Loading a saved configuration is intentional configuration, so price may display.
old="""function loadPayload(data){const loaded=validateLoaded(data);customProfiles=loaded.customProfiles;state={...state,...loaded.configuration"""
new="""function loadPayload(data){screenPriceActivated=true;const loaded=validateLoaded(data);customProfiles=loaded.customProfiles;state={...state,...loaded.configuration"""
if old not in s:
    raise SystemExit('load payload anchor not found')
s=s.replace(old,new,1)

p.write_text(s)

subprocess.run(['python3','tools/build-projection-guided.py'],check=True)
shutil.copyfile('projection-screen-configurator-preview.html','projection-screen-configurator-v6.html')

app=Path('projection/src/app.js').read_text()
assert 'let screenPriceActivated=false;' in app
assert "Adjust the screen in Step 2 to calculate your estimate." in app
assert "state.guidedStep===2&&['diameter','horizontalFov','viewableHeight','screenBottom'].includes(key)" in app
print('V6 deferred-price checks passed')
