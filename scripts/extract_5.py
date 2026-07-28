import csv

src = 'Demo_CSV-1.csv'
dst = 'Demo_5_products.csv'

with open(src, 'r', encoding='utf-8', errors='replace', newline='') as f:
    rows = list(csv.reader(f))

header = rows[0]
out = [header]
seen = []
for row in rows[1:]:
    if not row or not row[0]:
        # continuation row (extra image) — keep if its handle is in `seen`
        continue
    h = row[0]
    if h in seen:
        out.append(row)
    elif len(seen) < 5:
        seen.append(h)
        out.append(row)

# Now also pull continuation image rows for the 5 selected handles
for row in rows[1:]:
    if row and row[0] == '' :
        # continuation: belongs to previous handle row's handle
        continue
# Simpler: re-walk preserving order, including continuation rows belonging to selected handles
out = [header]
current_handle = None
keep_current = False
for row in rows[1:]:
    if not row:
        continue
    if row[0]:
        current_handle = row[0]
        keep_current = current_handle in seen
        if keep_current:
            out.append(row)
    else:
        if keep_current:
            out.append(row)

with open(dst, 'w', encoding='utf-8', newline='') as f:
    csv.writer(f).writerows(out)

print('handles:', seen)
print('rows written:', len(out))
