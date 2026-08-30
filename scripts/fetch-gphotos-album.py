#!/usr/bin/env python3
"""Download images from a public Google Photos shared album URL."""

import json
import re
import sys
from pathlib import Path

import requests

USER_AGENT = "reignpropertyholdings-image-import/1.0"


def unescape_html(html: str) -> str:
    return html.replace("\\u003d", "=").replace("\\/", "/")


def extract_photo_urls(html: str) -> list[str]:
    html = unescape_html(html)
    candidates = re.findall(r"https://lh3\.googleusercontent\.com/[^\"'\\s<>]+", html)
    seen: set[str] = set()
    urls: list[str] = []
    for url in candidates:
        url = url.rstrip(",;)")
        # Skip tiny icons / profile avatars; album photos use /pw/ or long paths.
        if "/pw/" not in url and len(url) < 120:
            continue
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls


def title_from_html(html: str) -> str:
    match = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    if not match:
        return ""
    return re.sub(r"\s+", " ", match.group(1)).strip()


def download_image(session: requests.Session, url: str) -> requests.Response:
    """Download bytes, trying a few URL shapes Google Photos uses."""
    attempts = [url]
    if not re.search(r"=[ws]\d", url):
        attempts.append(f"{url}=w0")
        attempts.append(f"{url}=s0")
    last_response = None
    for attempt in attempts:
        response = session.get(attempt, timeout=120)
        last_response = response
        if response.status_code == 200 and response.content:
            return response
    if last_response is None:
        raise RuntimeError(f"Failed to download image: {url}")
    last_response.raise_for_status()
    return last_response


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
