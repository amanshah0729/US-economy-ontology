"""Drop redundant 6-digit NAICS rows whose only sibling matches the 5-digit parent."""
import openpyxl
from collections import defaultdict
from pathlib import Path

SRC = Path("data/2022_NAICS_Descriptions_use.xlsx")
DST = Path("data/2022_NAICS_Descriptions_use.xlsx")

wb = openpyxl.load_workbook(SRC)
ws = wb["2022_NAICS_Descriptions"]

rows = list(ws.iter_rows(min_row=2, values_only=True))
header = [c.value for c in ws[1]]

# Index rows by code (as string, stripped). NAICS codes are stored as ints.
by_code = {}
for code, title, desc in rows:
    if code is None:
        continue
    key = str(code).strip()
    by_code[key] = (title, desc)

# Group 6-digit codes by their 5-digit parent.
children = defaultdict(list)
for key in by_code:
    if len(key) == 6:
        children[key[:5]].append(key)

def norm(s):
    if s is None:
        return ""
    # NAICS titles sometimes carry a trailing 'T' marker indicating it has a description.
    return str(s).rstrip("T").strip().lower()

drop = set()
for parent5, kids in children.items():
    if len(kids) != 1:
        continue
    if parent5 not in by_code:
        continue
    kid = kids[0]
    p_title, _ = by_code[parent5]
    k_title, _ = by_code[kid]
    if norm(p_title) == norm(k_title):
        drop.add(kid)

print(f"Dropping {len(drop)} redundant 6-digit rows")

# Rebuild the sheet: delete matching rows in reverse to keep indices valid.
to_delete = []
for idx, row in enumerate(ws.iter_rows(min_row=2, values_only=True), start=2):
    code = row[0]
    if code is None:
        continue
    if str(code).strip() in drop:
        to_delete.append(idx)

for idx in reversed(to_delete):
    ws.delete_rows(idx, 1)

wb.save(DST)
print(f"Saved {DST}. Rows remaining: {ws.max_row - 1}")
