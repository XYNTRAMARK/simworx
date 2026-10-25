from pathlib import Path
import subprocess,re
subprocess.run(['python3','.projection-v21-deploy/build_v21.py'],check=True)
s=Path('projection-screen-configurator-v21.html').read_text()
terms=["throwRatioMin","Optical throw setting is below","projection-throw').disabled","projection-throw').addEventListener","guided-manual"]
for term in terms:
    print("\n===TERM",term,"===")
    pos=0;n=0
    while True:
        i=s.find(term,pos)
        if i<0:break
        print(s[max(0,i-500):i+1000])
        n+=1;pos=i+len(term)
        if n>=5:break
    print("COUNT>=",n)
