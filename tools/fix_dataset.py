import json, math
from pathlib import Path
base=Path.home()/"workspace/crimson-currency"
pins=json.loads((base/"pins_geocoded.json").read_text())

FIX={
 ("Dreamland Bar-B-Que","101 Bridge Ave."): (33.216312,-87.573406,"101 Bridge Ave, Northport, AL 35476"),
 ("Domino's Pizza","350 McFarland Blvd. (Northport)"): (33.23732,-87.560753,"350 McFarland Blvd, Northport, AL 35476"),
}
HOURS={
 ("Dreamland Bar-B-Que","101 Bridge Ave."): "Sun–Thu: 10:00 AM – 9:00 PM\nFri–Sat: 10:00 AM – 10:00 PM",
 ("Domino's Pizza","350 McFarland Blvd. (Northport)"): "Sun–Thu: 10:30 AM – 12:00 AM\nFri–Sat: 10:30 AM – 1:00 AM",
 ("City Bowls","2310 Gary Fitts St."): "Mon–Sat: 7:00 AM – 7:00 PM\nSun: 10:00 AM – 4:00 PM",
}
NOTES={
 ("Rita's of Tuscaloosa","1201 University Blvd."): "Co-located with PJ's Coffee at the same storefront — Rita's and PJ's share an owner.",
 ("PJ's Coffee","1201 University Blvd."): "Co-located with Rita's Italian Ice at the same storefront — PJ's and Rita's share an owner.",
}
for p in pins:
    key=(p["name"].replace("\u2019","'"), p["address"])
    # names in file use curly ’; normalize keys above use straight '. Build lookup with normalized name
    for (n,a),v in FIX.items():
        if p["name"].replace("\u2019","'")==n and p["address"]==a:
            p["lat"],p["lng"],p["geocode_full"]=v; p["geocode_corrected"]="Verified via Places search: exact name + address match (geocoder street match was wrong for this Northport address)."
    for (n,a),v in HOURS.items():
        if p["name"].replace("\u2019","'")==n and p["address"]==a:
            p["hours"]=v; p["hoursVerified"]=True
    for (n,a),v in NOTES.items():
        if p["name"].replace("\u2019","'")==n and p["address"]==a:
            p["note"]=v
    p.setdefault("hours",None); p.setdefault("hoursVerified",False); p.setdefault("note","")
    # menu label
    p["linkLabel"]="View menu / website" if p["category"] in ("Fast Food / Restaurants","Coffee / Dessert") else "Visit website"

# display jitter for identical coordinates so every pin is clickable
from collections import defaultdict
groups=defaultdict(list)
for i,p in enumerate(pins): groups[(round(p["lat"],5),round(p["lng"],5))].append(i)
for (lat,lng),idxs in groups.items():
    if len(idxs)==1:
        pins[idxs[0]]["displayLat"]=lat; pins[idxs[0]]["displayLng"]=lng
    else:
        for k,i in enumerate(idxs):
            ang=2*math.pi*k/len(idxs)
            pins[i]["displayLat"]=round(lat+0.00028*math.cos(ang),6)
            pins[i]["displayLng"]=round(lng+0.00028*math.sin(ang),6)
        for i in idxs: pins[i]["note"]= (pins[i]["note"]+" " if pins[i]["note"] else "") + "Map pin slightly offset so co-located businesses are each clickable — address shown is the exact address."

for i,p in enumerate(pins,1): p["id"]=i
(base/"locations.json").write_text(json.dumps(pins,indent=2,ensure_ascii=False))
print("total",len(pins),"both",sum(p["acceptsDiningDollars"] for p in pins),"unavailable",sum(p["unavailable"] for p in pins),"hoursVerified",sum(p["hoursVerified"] for p in pins))
lats=[p["lat"] for p in pins]; lngs=[p["lng"] for p in pins]
print("lat range",min(lats),max(lats)); print("lng range",min(lngs),max(lngs))
