from pathlib import Path
p=Path('projection-screen-configurator-v17.html')
s=p.read_text()
needle="const offline=await import('projection:/src/offline-api.js');offline.installOfflineAPI(payload);"
idx=s.find(needle)
if idx<0:
    raise SystemExit('offline import marker not found')
injection="""for(const file of Object.keys(payload.modules)){
    try{
      console.log('IMPORTTEST',file);
      await import('projection:'+file);
      console.log('IMPORTOK',file);
    }catch(error){
      console.error('IMPORTFAIL',file,error?.stack||error?.message||error);
      throw error;
    }
  }
  """
p.write_text(s[:idx]+injection+s[idx:])
