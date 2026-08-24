import re, html, sys
url = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else None
try:
    import urllib.request
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    raw = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'ignore')
except Exception as e:
    print("FETCH_ERR", e); sys.exit(0)
t = re.sub(r'<script.*?</script>', ' ', raw, flags=re.S | re.I)
t = re.sub(r'<style.*?</style>', ' ', t, flags=re.S | re.I)
t = re.sub(r'<[^>]+>', ' ', t)
t = html.unescape(t)
t = re.sub(r'[ \t]+', ' ', t)
lines = [l.strip() for l in t.splitlines() if l.strip()]
if out:
    open(out, 'w', encoding='utf-8').write('\n'.join(lines))
# print keyword windows
keys = re.compile(r'(free|plan|pro|standard|premium|enterprise|team|\$|api|credits?|month|subscription|token|tier|price|usd|/mo|glb|gltf|fbx|obj|stl|usdz|license|commercial|export)', re.I)
for i, l in enumerate(lines):
    if keys.search(l):
        print(">>", l[:200])
