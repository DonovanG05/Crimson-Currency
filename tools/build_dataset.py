import json, re, subprocess, sys
from pathlib import Path

src = json.loads(Path.home().joinpath("workspace/bama-cash-map/bama_cash_source.json").read_text())

DINING_DOLLARS = {
    "Ajian Sushi","Buffalo Phil's Wings","Domino's Pizza","Glory Bound Gyro Co.",
    "Mediterranean Sandwich Co.","Newk's Express Café","Papa John's",
    "Twelve25 Sports Bar & Entertainment","Rita's of Tuscaloosa","PJ's Coffee","VooDoo Wing Co."
}
# normalize curly apostrophes for matching
def norm(s): return s.replace("\u2019","'").replace("\u2018","'")
DD_NORM = {norm(x) for x in DINING_DOLLARS}

PHONE_RE = re.compile(r"(\d{3}-\d{3}-\d{4})")

pins=[]
for card in src:
    if card["category"]=="On-Campus": continue
    if norm(card["name"])=="Yogurt Mountain": continue  # Donovan: ignore for now
    combined = "\n\n".join(card["info"])
    blocks = [b.strip() for b in combined.split("\n\n") if b.strip()]
    if not blocks: continue
    for block in blocks:
        unavailable = ("Temporarily Unavailable" in block) or ("Temporarily Unavailable" in (card["subtitle"] or ""))
        m = PHONE_RE.search(block)
        phone = m.group(1) if m else ""
        addr = block[:m.start()].strip() if m else block.strip()
        addr = addr.replace("Temporarily Unavailable-","").replace("Temporarily Unavailable;","").strip()
        addr = re.sub(r"[,\s]+$","",addr)
        addr = re.sub(r"\s+"," ",addr)
        if not addr: continue
        payment_both = norm(card["name"]) in DD_NORM
        pins.append({
            "name": card["name"],
            "category": card["category"],
            "area": card["subtitle"].replace("Temporarily Unavailable;","").replace("Temporarily Unavailable","").strip(" ;"),
            "address": addr,
            "phone": phone,
            "website": card["url"],
            "image": card["image"],
            "payment": "Both" if payment_both else "Bama Cash only",
            "acceptsBamaCash": True,
            "acceptsDiningDollars": payment_both,
            "unavailable": bool(unavailable),
        })

print(f"pins before geocode: {len(pins)}")
for p in pins: print(p["name"], "|", p["address"], "|", p["payment"], "| unavailable" if p["unavailable"] else "")
Path.home().joinpath("workspace/crimson-currency/pins_pre_geocode.json").write_text(json.dumps(pins,indent=2,ensure_ascii=False))
