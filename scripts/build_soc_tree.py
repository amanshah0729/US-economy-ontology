"""Build src/data/soc-tree.json from OEWS national May 2024 release."""
import json
from pathlib import Path
import openpyxl

SRC = Path("data/oews/oesm24nat/national_M2024_dl.xlsx")
DST = Path("src/data/soc-tree.json")
DST.parent.mkdir(parents=True, exist_ok=True)

wb = openpyxl.load_workbook(SRC, read_only=True)
ws = wb["national_M2024_dl"]
rows = ws.iter_rows(values_only=True)
header = list(next(rows))
idx = {c: i for i, c in enumerate(header)}

def num(v):
    if v is None or v in ("", "*", "**", "#"):
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None

# Pick cross-industry, total ownership rows (the standard "all industries" view).
records = {}
for r in rows:
    if r[idx["AREA"]] != "99":
        continue
    if r[idx["NAICS"]] != "000000":
        continue
    if r[idx["I_GROUP"]] != "cross-industry":
        continue
    code = r[idx["OCC_CODE"]]
    group = r[idx["O_GROUP"]]
    records[code] = {
        "code": code,
        "title": r[idx["OCC_TITLE"]],
        "group": group,  # total | major | minor | broad | detailed
        "totEmp": num(r[idx["TOT_EMP"]]),
        "aMean": num(r[idx["A_MEAN"]]),
        "aMedian": num(r[idx["A_MEDIAN"]]),
        "aPct10": num(r[idx["A_PCT10"]]),
        "aPct25": num(r[idx["A_PCT25"]]),
        "aPct75": num(r[idx["A_PCT75"]]),
        "aPct90": num(r[idx["A_PCT90"]]),
        "hMean": num(r[idx["H_MEAN"]]),
    }

print(f"loaded {len(records)} cross-industry occupation rows")
counts = {}
for v in records.values():
    counts[v["group"]] = counts.get(v["group"], 0) + 1
print("by group:", counts)

# Parent of an SOC code.
def parent_of(code: str) -> str | None:
    if code == "00-0000":
        return None
    # detailed -> broad: last digit -> 0
    if code[-1] != "0":
        return code[:-1] + "0"
    # broad (XX-XXX0) -> minor (XX-X000)
    if code[-3:] != "000" and code[-2:] == "10" or (code[-1] == "0" and code[-3] != "0"):
        # broad codes end with one zero but the prior digit is nonzero (e.g., 11-1010)
        if code[-2] != "0":
            return code[:-2] + "00"
        # codes like 11-1100 are minor? SOC 2018 minors are XX-X000 (last 3 zeros)
        return code[:-3] + "000"
    # minor (XX-X000) -> major (XX-0000)
    if code.endswith("000"):
        return code[:2] + "-0000"
    # major
    if code.endswith("-0000"):
        return "00-0000"
    return None

# Simpler classification using O_GROUP from data:
def parent_by_group(code: str, group: str) -> str | None:
    if group == "total":
        return None
    if group == "major":
        return "00-0000"
    if group == "minor":
        return code[:2] + "-0000"  # 11-1000 -> 11-0000
    if group == "broad":
        # Minors are XX-X000 or XX-XX00 (e.g., 15-1200 Computer Occupations).
        # Walk up trailing-zero candidates and pick the first that exists.
        for cand in (code[:4] + "000", code[:5] + "00"):
            if cand in records and records[cand]["group"] == "minor":
                return cand
        return code[:4] + "000"
    if group == "detailed":
        # detailed XX-XXXX -> broad XX-XXX0
        return code[:-1] + "0"
    return None

# Build children map
children_of = {code: [] for code in records}
unparented = []
for code, rec in records.items():
    p = parent_by_group(code, rec["group"])
    if p is None:
        continue
    if p in children_of:
        children_of[p].append(code)
    else:
        # Some detailed codes may have parent broad that doesn't exist as a row (e.g., detailed = broad).
        # Try grandparent (minor): replace last 4 digits with 000
        if rec["group"] == "detailed":
            gp = code[:4] + "000"
            if gp in children_of:
                children_of[gp].append(code)
                continue
        unparented.append((code, p, rec["group"]))

print(f"unparented: {len(unparented)}")
if unparented[:5]:
    print("examples:", unparented[:5])

# Render tree
def to_node(code: str) -> dict:
    rec = records[code]
    kids = [to_node(c) for c in sorted(children_of[code])]
    return {
        "code": code,
        "title": rec["title"],
        "group": rec["group"],
        "totEmp": rec["totEmp"],
        "aMean": rec["aMean"],
        "aMedian": rec["aMedian"],
        "aPct10": rec["aPct10"],
        "aPct25": rec["aPct25"],
        "aPct75": rec["aPct75"],
        "aPct90": rec["aPct90"],
        "hMean": rec["hMean"],
        "children": kids,
    }

tree = to_node("00-0000")
# Count nodes
def count(n):
    return 1 + sum(count(c) for c in n["children"])
print(f"tree nodes: {count(tree)}")

with open(DST, "w") as f:
    json.dump(tree, f, separators=(",", ":"))
print(f"wrote {DST}")
