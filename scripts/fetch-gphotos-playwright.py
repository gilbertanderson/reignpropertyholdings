#!/usr/bin/env python3
"""Download a public Google Photos album using a headless browser."""

import json
import re
import sys
from pathlib import Path

import requests
from playwright.sync_api import sync_playwright

USER_AGENT = "reignpropertyholdings-image-import/1.0"


def collect_image_urls(page_html: str, img_srcs: list[str]) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for source in [page_html, *img_srcs]:
        for match in re.findall(r"https://lh3\.googleusercontent\.com/[^\"'\\s<>]+", source):
            url = match.rstrip(",;)")
            if "/pw/" not in url and len(url) < 120:
                continue
            if url in seen:
                continue
            seen.add(url)
            urls.append(url)

    pw_urls = [u for u in urls if "/pw/" in u]
    if pw_urls:
        by_prefix: dict[str, str] = {}
        for url in pw_urls:
            base = url.split("=", 1)[0]
            if base not in by_prefix or len(url) > len(by_prefix[base]):
                by_prefix[base] = url
        return list(by_prefix.values())
    return urls


def title_from_html(html: str) -> str:
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()


def download_image(session: requests.Session, url: str) -> requests.Response:
    attempts = [url]
    base = url.split("=", 1)[0]
    if base != url:
        attempts.insert(0, base)
    if not re.search(r"=[ws]\d", url):
        attempts.extend([f"{base}=w0", f"{base}=s0"])
    last = None
    for attempt in attempts:
        response = session.get(attempt, timeout=120)
        last = response
        if response.status_code == 200 and len(response.content) > 1000:
            return response
    if last is None:
        raise RuntimeError(f"Failed to download image: {url}")
    last.raise_for_status()
    return last


def download_album(album_url: str, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)
        page.goto(album_url, wait_until="networkidle", timeout=120000)
        page.wait_for_timeout(3000)
        html = page.content()
        img_srcs = page.eval_on_selector_all("img", "els => els.map((e) => e.currentSrc || e.src)")
        final_url = page.url
        title = page.title()
        browser.close()

    urls = collect_image_urls(html, img_srcs)
    if not urls:
        (out_dir / "debug.json").write_text(
            json.dumps({"img_srcs": img_srcs[:20], "html_sample": html[:5000]}, indent=2) + "\n"
        )
        raise RuntimeError("No googleusercontent image URLs found after browser load")

    urls = list(reversed(urls))
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    saved: list[dict] = []
    for index, url in enumerate(urls, start=1):
        image = download_image(session, url)
        ext = "jpg"
        content_type = image.headers.get("content-type", "")
        if "image/webp" in content_type:
            ext = "webp"
        elif "image/png" in content_type:
            ext = "png"
        filename = f"{index:02d}.{ext}"
        path = out_dir / filename
        path.write_bytes(image.content)
        saved.append({"file": filename, "source_url": url, "bytes": len(image.content)})

    metadata = {
        "album_url": album_url,
        "final_url": final_url,
        "title": title or title_from_html(html),
        "count": len(saved),
        "files": saved,
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: fetch-gphotos-playwright.py <album_url> <output_dir>", file=sys.stderr)
        sys.exit(1)
    metadata = download_album(sys.argv[1], Path(sys.argv[2]))
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
