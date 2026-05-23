"""Pull OEWS employment + annual mean wage from BLS for 5 NAICS industries.

50 series in one POST: 5 industries x (all-occupations + 4 specific SOCs) x 2 datatypes.
"""
import json, os, urllib.request

KEY = open(".env").read().strip().split("=", 1)[1]

# (NAICS, label, [(SOC, label), ...])
INDUSTRIES = [
    ("722500", "Restaurants & Other Eating Places (NAICS 7225)", [
        ("000000", "All occupations"),
        ("353031", "Waiters and Waitresses"),
        ("352014", "Cooks, Restaurant"),
        ("353023", "Fast Food and Counter Workers"),
        ("119051", "Food Service Managers"),
    ]),
    ("621200", "Offices of Dentists (NAICS 6212)", [
        ("000000", "All occupations"),
        ("291021", "Dentists, General"),
        ("292021", "Dental Hygienists"),
        ("319091", "Dental Assistants"),
        ("436013", "Medical Secretaries"),
    ]),
    ("812100", "Personal Care Services (NAICS 8121)", [
        ("000000", "All occupations"),
        ("395012", "Hairdressers/Cosmetologists"),
        ("395094", "Skincare Specialists"),
        ("395092", "Manicurists and Pedicurists"),
        ("411011", "First-Line Supv Retail Sales"),
    ]),
    ("484100", "General Freight Trucking (NAICS 4841)", [
        ("000000", "All occupations"),
        ("533032", "Heavy and Tractor-Trailer Truck Drivers"),
        ("433071", "Dispatchers"),
        ("537062", "Laborers/Freight Movers"),
        ("119199", "Managers, All Other"),
    ]),
    ("561700", "Services to Buildings & Dwellings (NAICS 5617)", [
        ("000000", "All occupations"),
        ("372011", "Janitors and Cleaners"),
        ("372012", "Maids and Housekeeping Cleaners"),
        ("371011", "First-Line Supv Housekeeping"),
        ("373011", "Landscaping/Groundskeeping"),
    ]),
]

# OEWS national series: OEU + N + 0000000 + NAICS(6) + SOC(6) + datatype(2)
# 01 = employment, 04 = annual mean wage
series, label_map = [], {}
for naics, ind_label, socs in INDUSTRIES:
    for soc, soc_label in socs:
        for dt in ("01", "04"):
            sid = f"OEUN0000000{naics}{soc}{dt}"
            series.append(sid)
            label_map[sid] = (naics, ind_label, soc, soc_label, dt)

assert len(series) == 50, len(series)

body = {
    "seriesid": series,
    "startyear": "2024",
    "endyear": "2025",
    "registrationkey": KEY,
    "catalog": False,
}
req = urllib.request.Request(
    "https://api.bls.gov/publicAPI/v2/timeseries/data/",
    data=json.dumps(body).encode(),
    headers={"Content-Type": "application/json"},
)
resp = json.loads(urllib.request.urlopen(req, timeout=60).read())
print("status:", resp["status"], "msgs:", resp.get("message"))

# Flatten: latest value per series
out = {}
for s in resp["Results"]["series"]:
    sid = s["seriesID"]
    naics, ind_label, soc, soc_label, dt = label_map[sid]
    val = s["data"][0]["value"] if s["data"] else None
    key = (naics, ind_label, soc, soc_label)
    out.setdefault(key, {})[dt] = val

# Print grouped table
DT = {"01": "employment", "04": "annual_mean_wage"}
for (naics, ind_label, soc, soc_label), v in out.items():
    print(f"{naics}|{soc}|{ind_label} > {soc_label}: emp={v.get('01')} mean_wage=${v.get('04')}")

with open("data/bls_oews_sample.json", "w") as f:
    json.dump({"by_series": {sid: s for sid, s in zip(series, resp["Results"]["series"])}, "labels": {f"{a}|{b}|{c}|{d}|{e}": list(v) for v, (a,b,c,d,e) in [(k, label_map[k]) for k in label_map]}}, f, indent=2, default=str)
print("\nSaved raw response to data/bls_oews_sample.json")
