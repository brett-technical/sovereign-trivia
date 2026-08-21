import re, json, sys

SRC = sys.argv[1]
lines = open(SRC, encoding='utf-8').read().split('\n')

HEADER = ['Country','Capital City','Official/Major Languages',
          'Currency (Name & Code)','Population','Major Industries']

# locate region sections
regions = []
for i, l in enumerate(lines):
    m = re.match(r'^Sovereign Entities of (?:the )?(.+)$', l.strip())
    if m:
        regions.append((m.group(1), i))

# find the terminator (post-table prose)
end_marker = next(i for i,l in enumerate(lines)
                  if l.startswith('Systematic Observations'))

bounds = []
for idx,(name,start) in enumerate(regions):
    stop = regions[idx+1][1] if idx+1 < len(regions) else end_marker
    bounds.append((name,start,stop))

countries, problems = [], []
for name,start,stop in bounds:
    # header block sits right after the region title
    h = None
    for i in range(start, min(start+6, stop)):
        if lines[i].strip() == 'Country':
            h = i; break
    if h is None:
        problems.append(f'{name}: no table header'); continue
    got = [lines[h+k].strip() for k in range(6)]
    if got != HEADER:
        problems.append(f'{name}: header mismatch {got}')
    data = [l for l in lines[h+6:stop] if l.strip() != '']
    if len(data) % 6:
        problems.append(f'{name}: {len(data)} data lines, not divisible by 6 (remainder {len(data)%6})')
    for j in range(0, len(data) - len(data)%6, 6):
        row = [data[j+k].strip() for k in range(6)]
        countries.append({
            'region': name,
            'country': row[0],
            'capital': row[1],
            'languages': row[2],
            'currency': row[3],
            'population': row[4],
            'industries': re.sub(r'\s*\[cite:[^\]]*\]', '', row[5]).strip(),
        })
    # show any leftover
    if len(data) % 6:
        problems.append(f'{name}: LEFTOVER -> {data[-(len(data)%6):]}')

print(f'REGIONS: {[(n, s, e) for n,s,e in bounds]}')
print(f'TOTAL COUNTRIES: {len(countries)}')
from collections import Counter
print('PER REGION:', dict(Counter(c["region"] for c in countries)))
print('PROBLEMS:', problems if problems else 'none')
json.dump(countries, open(sys.argv[2],'w',encoding='utf-8'), indent=2, ensure_ascii=False)
