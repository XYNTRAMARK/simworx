from pathlib import Path
p=Path('projection-screen-configurator-v17.html')
s=p.read_text()
needle="const offline=await import('projection:/src/offline-api.js');offline.installOfflineAPI(payload);"
idx=s.find(needle)
if idx<0: raise SystemExit('offline import marker not found')
ordered=[
'/src/optics.js',
'/src/layout-planner.js',
'/src/guided-planner.js',
'/src/led-viewer.js',
'/src/projection-layer.js',
'/assets/js/led/eye-controls.js',
'/assets/js/led/pilot-view.js',
'/assets/js/led/pilot-eyes.js',
'/assets/js/led/units.js',
'/src/screen-geometry.js',
'/src/import-ui.js',
'/src/admin-ui.js',
'/src/pricing.js',
'/src/app.js'
]
items=','.join(repr(x) for x in ordered)
injection=f"""const diagnosticModules=[{items}];
  for(const file of diagnosticModules){{
    try{{
      console.log('IMPORTTEST',file);
      await import('projection:'+file);
      console.log('IMPORTOK',file);
    }}catch(error){{
      console.error('IMPORTFAIL',file,error?.stack||error?.message||error);
      throw error;
    }}
  }}
  """
p.write_text(s[:idx]+injection+s[idx:])
