#!/usr/bin/env python3
"""Download images from a public Google Photos shared album URL."""

import json
import re
import sys
from pathlib import Path

import requests

USER_AGENT = "reignpropertyholdings-image-import/1.0"


def unescape_html(html: str) -> str:
    return (
        html.replace("\\u003d", "=")
        .replace("\\u0026", "&")
        .replace("\\/", "/")
        .replace("&amp;", "&")
    )


def extract_photo_urls(html: str) -> list[str]:
    html = unescape_html(html)
    patterns = [
        r"https://lh3\.googleusercontent\.com/pw/[A-Za-z0-9_\-]+(?:=[A-Za-z0-9_\-]+)?",
        r"https://lh3\.googleusercontent\.com/[a-zA-Z0-9\-_=/]+",
        r"https://lh3\.googleusercontent\.com/[^\"'\\s<>]+",
    ]
    seen: set[str] = set()
    urls: list[str] = []
    for pattern in patterns:
        for url in re.findall(pattern, html):
            url = url.rstrip(",;)")
            if "/pw/" not in url and len(url) < 120:
                continue
            if url in seen:
                continue
            seen.add(url)
            urls.append(url)

    # Prefer the longest unique /pw/ URLs — short matches are usually truncated.
    pw_urls = [u for u in urls if "/pw/" in u]
    if pw_urls:
        by_prefix: dict[str, str] = {}
        for url in pw_urls:
            base = url.split("=", 1)[0]
            if base not in by_prefix or len(url) > len(by_prefix[base]):
                by_prefix[base] = url
        urls = list(by_prefix.values())

    return urls


def title_from_html(html: str) -> str:
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()


def download_image(session: requests.Session, url: str) -> requests.Response:
    """Download bytes, trying a few URL shapes Google Photos uses."""
    attempts = [url]
    base = url.split("=", 1)[0]
    if base != url:
        attempts.insert(0, base)
    if not re.search(r"=[ws]\d", url):
        attempts.extend([f"{base}=w0", f"{base}=s0", f"{base}=w2560-h2560"])
    last_response = None
    for attempt in attempts:
        response = session.get(attempt, timeout=120)
        last_response = response
        if response.status_code == 200 and len(response.content) > 1000:
            return response
    if last_response is None:
        raise RuntimeError(f"Failed to download image: {url}")
    last_response.raise_for_status()
    return last_response


def write_debug(html: str, out_dir: Path, error: Exception) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    matches = extract_photo_urls(html)
    debug = {
        "error": str(error),
        "match_count": len(matches),
        "matches": sorted(matches, key=len, reverse=True)[:15],
    }
    (out_dir / "debug.json").write_text(json.dumps(debug, indent=2) + "\n")


def download_album(album_url: str, out_dir: Path) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    session = requests.Session()
    session.headers["User-Agent"] = USER_AGENT

    response = session.get(album_url, timeout=60, allow_redirects=True)
    response.raise_for_status()
    html = response.text

    urls = extract_photo_urls(html)
    if not urls:
        write_debug(html, out_dir, RuntimeError("no urls"))
        raise RuntimeError("No googleusercontent image URLs found in album page")

    urls = list(reversed(urls))

    saved: list[dict] = []
    try:
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
            saved.append(
                {
                    "file": filename,
                    "source_url": url,
                    "bytes": len(image.content),
                }
            )
    except Exception as err:
        write_debug(html, out_dir, err)
        raise

    metadata = {
        "album_url": album_url,
        "final_url": response.url,
        "title": title_from_html(html),
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
