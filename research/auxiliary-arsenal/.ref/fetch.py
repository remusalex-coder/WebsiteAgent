#!/usr/bin/env python3
"""Fetch a URL and dump cleaned text to a file. Usage: fetch.py URL OUTFILE"""
import sys, re, requests

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36"

def clean(html: str) -> str:
    html = re.sub(r"(?is)<script.*?</script>", " ", html)
    html = re.sub(r"(?is)<style.*?</style>", " ", html)
    html = re.sub(r"(?is)<noscript.*?</noscript>", " ", html)
    text = re.sub(r"(?s)<[^>]+>", " ", html)
    text = re.sub(r"&nbsp;", " ", text)
    text = re.sub(r"&amp;", "&", text)
    text = re.sub(r"&lt;", "<", text)
    text = re.sub(r"&gt;", ">", text)
    text = re.sub(r"&quot;", '"', text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n+", "\n\n", text)
    return text.strip()

def main():
    url, out = sys.argv[1], sys.argv[2]
    try:
        r = requests.get(url, headers={"User-Agent": UA}, timeout=25)
        code = r.status_code
        txt = clean(r.text)
        with open(out, "w", encoding="utf-8") as f:
            f.write(f"URL: {url}\nHTTP: {code}\nLEN: {len(txt)}\n\n{txt}\n")
        print(f"OK {code} {len(txt)} -> {out}")
    except Exception as e:
        print(f"ERR {url}: {e}")

if __name__ == "__main__":
    main()
