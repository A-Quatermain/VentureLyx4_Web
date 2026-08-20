"""Own website SEO scanner with private-IP safeguards."""
import re
import time
import socket
import ipaddress
from urllib.parse import urlparse, urljoin
import httpx


def _is_private(hostname: str) -> bool:
    try:
        infos = socket.getaddrinfo(hostname, None)
    except Exception:
        return True  # can't resolve -> treat as unsafe
    for info in infos:
        ip = info[4][0]
        try:
            addr = ipaddress.ip_address(ip)
            if addr.is_private or addr.is_loopback or addr.is_link_local or addr.is_reserved:
                return True
        except ValueError:
            return True
    return False


def _normalize(url: str) -> str:
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url
    return url


async def scan_website(raw_url: str) -> dict:
    url = _normalize(raw_url.strip())
    parsed = urlparse(url)
    host = parsed.hostname or ""

    if not host or "." not in host:
        return {"ok": False, "error": "Please enter a valid website address."}
    if _is_private(host):
        return {"ok": False, "error": "For security, we can only scan public websites (private/internal addresses are blocked)."}

    result = {"ok": True, "url": url, "host": host, "checks": [], "issues": []}

    start = time.time()
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0,
                                     headers={"User-Agent": "VenturelyxSEOScanner/1.0"}) as clientx:
            resp = await clientx.get(url)
            html = resp.text
            elapsed_ms = int((time.time() - start) * 1000)
            final_url = str(resp.url)
    except Exception as e:
        return {"ok": False, "error": f"We couldn't reach that site: {str(e)[:120]}"}

    checks = []

    def add(key, label, passed, detail, severity, fix):
        checks.append({"key": key, "label": label, "passed": passed,
                       "detail": detail, "severity": severity, "fix": fix})

    # HTTPS
    add("https", "Secure connection (HTTPS)", final_url.startswith("https://"),
        "Your site loads over HTTPS." if final_url.startswith("https://") else "Your site is not using HTTPS.",
        "high", "Install an SSL certificate so visitors and Google see your site as secure.")

    # Title
    title_m = re.search(r"<title[^>]*>(.*?)</title>", html, re.I | re.S)
    title = (title_m.group(1).strip() if title_m else "")
    good_title = 10 <= len(title) <= 65
    add("title", "Page title", bool(title) and good_title,
        f'Title: "{title}" ({len(title)} chars)' if title else "No title tag found.",
        "high", "Add a clear 50-60 character title with your main service and city.")

    # Meta description
    meta_m = re.search(r'<meta[^>]+name=["\']description["\'][^>]*>', html, re.I)
    meta_content = ""
    if meta_m:
        c = re.search(r'content=["\'](.*?)["\']', meta_m.group(0), re.I | re.S)
        meta_content = c.group(1).strip() if c else ""
    good_meta = 50 <= len(meta_content) <= 165
    add("meta_description", "Meta description", bool(meta_content) and good_meta,
        f"{len(meta_content)} characters" if meta_content else "No meta description found.",
        "medium", "Write a 120-155 character description that makes people want to click.")

    # H1
    h1s = re.findall(r"<h1[^>]*>(.*?)</h1>", html, re.I | re.S)
    add("h1", "Main heading (H1)", len(h1s) == 1,
        f"{len(h1s)} H1 tag(s) found." if h1s else "No H1 heading found.",
        "medium", "Use exactly one H1 that states what the page is about.")

    # Images alt
    imgs = re.findall(r"<img[^>]*>", html, re.I)
    missing_alt = [i for i in imgs if not re.search(r'alt=["\'][^"\']+["\']', i, re.I)]
    add("image_alt", "Image alt text", len(missing_alt) == 0,
        f"{len(missing_alt)} of {len(imgs)} images missing alt text." if imgs else "No images found.",
        "low", "Add descriptive alt text to images so Google and screen readers understand them.")

    # Canonical
    has_canonical = bool(re.search(r'<link[^>]+rel=["\']canonical["\']', html, re.I))
    add("canonical", "Canonical tag", has_canonical,
        "Canonical tag present." if has_canonical else "No canonical tag found.",
        "low", "Add a canonical link tag to avoid duplicate-content confusion.")

    # Response time
    fast = elapsed_ms < 2500
    add("response_time", "Page speed", fast,
        f"Loaded in {elapsed_ms} ms.",
        "medium" if not fast else "low",
        "Compress images and reduce scripts to load under 2.5 seconds.")

    # Viewport / mobile
    has_viewport = bool(re.search(r'<meta[^>]+name=["\']viewport["\']', html, re.I))
    add("mobile", "Mobile friendly", has_viewport,
        "Viewport meta tag present." if has_viewport else "No mobile viewport tag found.",
        "medium", "Add a responsive viewport meta tag so the site works on phones.")

    # Broken links (sample internal links)
    links = re.findall(r'href=["\'](https?://[^"\']+|/[^"\']*)["\']', html, re.I)
    internal = []
    for l in links[:30]:
        full = urljoin(final_url, l)
        if urlparse(full).hostname == host:
            internal.append(full)
    broken = 0
    if internal:
        sample = list(dict.fromkeys(internal))[:8]
        async with httpx.AsyncClient(follow_redirects=True, timeout=8.0,
                                     headers={"User-Agent": "VenturelyxSEOScanner/1.0"}) as clientx:
            for link in sample:
                try:
                    r = await clientx.head(link)
                    if r.status_code >= 400:
                        broken += 1
                except Exception:
                    broken += 1
    add("broken_links", "Broken links", broken == 0,
        f"{broken} broken link(s) found in sample." if internal else "No internal links sampled.",
        "medium", "Fix or remove links that lead to error pages.")

    # Score
    weight = {"high": 25, "medium": 12, "low": 6}
    total = sum(weight[c["severity"]] for c in checks)
    earned = sum(weight[c["severity"]] for c in checks if c["passed"])
    score = round((earned / total) * 100) if total else 0

    issues = [c for c in checks if not c["passed"]]
    sev_order = {"high": 0, "medium": 1, "low": 2}
    issues.sort(key=lambda c: sev_order[c["severity"]])

    result["checks"] = checks
    result["issues"] = issues
    result["score"] = score
    result["response_ms"] = elapsed_ms
    result["title"] = title
    return result
