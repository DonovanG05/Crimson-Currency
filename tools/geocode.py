import json, subprocess, re
from pathlib import Path
base=Path.home()/"workspace/crimson-currency"
pins=json.loads((base/"pins_pre_geocode.json").read_text())
def clean_addr(a):
    a=a.replace("(Northport)","").replace("(A)","")
    a=re.sub(r"Suite.*|#.*","",a)  # geocode street address only; suite doesn't change coords materially
    a=re.sub(r"\s+"," ",a).strip().strip(",")
    return a
for i,p in enumerate(pins):
    q=f"{clean_addr(p['address'])}, Tuscaloosa, AL"
    try:
        out=subprocess.run(["/opt/hatch/bin/geocode","forward",q,"--city","Tuscaloosa","--state","AL","--lat","33.2098","--lon","-87.5692","--radius","25000","--limit","1"],capture_output=True,text=True,timeout=30)
        data=json.loads(out.stdout.strip().splitlines()[-1]) if out.stdout.strip() else []
        if data:
            d=data[0]
            p["lat"]=float(d["latitude"]); p["lng"]=float(d["longitude"])
            p["geocode_full"]=d.get("full_address",""); p["geocode_match"]=d.get("matched_level",""); p["geocode_relevance"]=d.get("relevance")
        else:
            p["lat"]=None; p["lng"]=None; p["geocode_full"]="NO_RESULT"; print("NO RESULT",p["name"],q,out.stderr[:200])
    except Exception as e:
        p["lat"]=None; p["lng"]=None; p["geocode_full"]=f"ERR {e}"; print("ERR",p["name"],e)
    print(i+1, p["name"], p["address"], "->", p.get("lat"), p.get("lng"), p.get("geocode_full"))
(base/"pins_geocoded.json").write_text(json.dumps(pins,indent=2,ensure_ascii=False))
