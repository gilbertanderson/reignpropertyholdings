#!/usr/bin/env python3
"""Download images from a public Google Photos shared album URL."""

import json
import re
import sys
from pathlib import Path

import requests

USER_AGENT = "reignpropertyholdings-image-import/1.0"


def extract_photo_urls(html: str) -> list[str]:
    patterns = [
        r"https://lh3\.googleusercontent\.com/[a-zA-Z0-9\-_=/]+",
        r"https://lh3\.googleusercontent\.com/[^\"'\\s<>]+",
    ]
    seen: set[str] = set()
    urls: list[str] = []
    for pattern in patterns:
        for match in re.findall(pattern, html):
            url = match.replace("\\u003d", "=").split("\\")[0].rstrip(",")
            if url in seen:
                continue
            seen.add(url)
            urls.append(url)
    # Album cover duplicates first/last in older scrapers; keep unique only.
    return urls


def normalize_download_url(url: str) -> str:
    """Return a URL suitable for downloading full-size bytes."""
    if re.search(r"=[ws]\d", url):
        return url
    if url.endswith("-no"):
        return url
    return f"{url}=w0"


def title_from_html(html: str) -> str:
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()


def download_album(album_url: str, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    response = session.get(album_url, timeout=60, allow_redirects=True)
    response.raise_for_status()

    urls = extract_photo_urls(response.text)
    if not urls:
        raise RuntimeError("No googleusercontent image URLs found in album page")

    # Reverse so order matches the album UI (gist convention).
    urls = list(reversed(urls))

    saved: list[dict] = []
    for index, url in enumerate(urls, start=1):
        fetch_url = normalize_download_url(url)
        image = session.get(fetch_url, timeout=120)
        if image.status_code == 400 and fetch_url != url:
            image = session.get(url, timeout=120)
        if image.status_code == 400 and "=w0" not in url:
            image = session.get(f"{url}=s0", timeout=120)
        image.raise_for_status()
        ext = "jpg"
        if "image/webp" in image.headers.get("content-type", ""):
            ext = "webp"
        elif "image/png" in image.headers.get("content-type", ""):
            ext = "png"
        filename = f"{index:02d}.{ext}"
        path = out_dir / filename
        path.write_bytes(image.content)
        saved.append(
            {
                "file": filename,
                "source_url": url,
                "bytes": len(image.content),
            }
        )

    metadata = {
        "album_url": album_url,
        "final_url": response.url,
        "title": title_from_html(response.text),
        "count": len(saved),
        "files": saved,
    }
    (out_dir / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    return metadata


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: fetch-gphotos-album.py <album_url> <output_dir>", file=sys.stderr)
        sys.exit(1)

    album_url = sys.argv[1]
    out_dir = Path(sys.argv[2])
    metadata = download_album(album_url, out_dir)
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
