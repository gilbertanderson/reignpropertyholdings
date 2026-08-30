#!/usr/bin/env python3
"""Download a public Google Photos album using a headless browser."""

import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

USER_AGENT = "reignpropertyholdings-image-import/1.0"


def fullsize_url(url: str) -> str:
    if "=" in url:
        base = url.rsplit("=", 1)[0]
        return f"{base}=w0"
    return f"{url}=w0"


def title_from_html(html: str) -> str:
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()


def download_album(album_url: str, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    captured: list[str] = []

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page(user_agent=USER_AGENT)

        def on_response(response) -> None:
            url = response.url
            if "googleusercontent.com" not in url:
                return
            if response.request.resource_type not in {"image", "xhr", "fetch"}:
                return
            if len(url) < 80:
                return
            captured.append(url)

        page.on("response", on_response)
        page.goto(album_url, wait_until="networkidle", timeout=120000)
        page.wait_for_timeout(2000)

        # Scroll to load the full album grid.
        for _ in range(8):
            page.mouse.wheel(0, 2500)
            page.wait_for_timeout(800)

        html = page.content()
        img_srcs = page.eval_on_selector_all(
            "img",
            "els => els.map((e) => e.currentSrc || e.src).filter(Boolean)",
        )
        final_url = page.url
        title = page.title()
        browser.close()

    urls: list[str] = []
    seen: set[str] = set()
    for url in captured + img_srcs:
        if "googleusercontent.com" not in url:
            continue
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)

    # Prefer /pw/ album photos; drop tiny avatars/icons.
    pw_urls = [u for u in urls if "/pw/" in u]
    if pw_urls:
        by_prefix: dict[str, str] = {}
        for url in pw_urls:
            base = url.split("=", 1)[0]
            if base not in by_prefix or len(url) > len(by_prefix[base]):
                by_prefix[base] = url
        urls = list(by_prefix.values())

    if not urls:
        (out_dir / "debug.json").write_text(
            json.dumps({"captured": captured[:30], "img_srcs": img_srcs[:30]}, indent=2) + "\n"
        )
        raise RuntimeError("No googleusercontent image URLs captured from album")

    urls = list(reversed(urls))

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        saved: list[dict] = []
        for index, url in enumerate(urls, start=1):
            download_url = fullsize_url(url)
            response = context.request.get(download_url, timeout=120000)
            if response.status != 200 or len(response.body()) < 1000:
                for attempt in [url, url.rsplit("=", 1)[0]]:
                    response = context.request.get(attempt, timeout=120000)
                    if response.status == 200 and len(response.body()) >= 1000:
                        download_url = attempt
                        break
            if response.status != 200:
                browser.close()
                raise RuntimeError(f"Failed to download {url}: HTTP {response.status}")
            body = response.body()
            ext = "jpg"
            content_type = response.headers.get("content-type", "")
            if "image/webp" in content_type:
                ext = "webp"
            elif "image/png" in content_type:
                ext = "png"
            filename = f"{index:02d}.{ext}"
            (out_dir / filename).write_bytes(body)
            saved.append({"file": filename, "source_url": download_url, "bytes": len(body)})
        browser.close()

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
