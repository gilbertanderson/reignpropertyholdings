#!/usr/bin/env python3
"""Download a public iCloud shared album by token."""

import json
import re
import sys
from pathlib import Path

import requests

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
HEADERS = {
    "Origin": "https://www.icloud.com",
    "Accept-Language": "en-US,en;q=0.8",
    "User-Agent": USER_AGENT,
    "Content-Type": "text/plain",
    "Accept": "*/*",
    "Referer": "https://www.icloud.com/sharedalbum/",
    "Connection": "keep-alive",
}

BASE62 = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"


def extract_token(url_or_token: str) -> str:
    url_or_token = url_or_token.strip()
    if "icloud.com" in url_or_token:
        match = re.search(r"/photos/([^/?#]+)", url_or_token)
        if match:
            return match.group(1)
        match = re.search(r"#([^/?#]+)", url_or_token)
        if match:
            return match.group(1)
    return url_or_token


def base62_to_int(value: str) -> int:
    total = 0
    for char in value:
        total = total * 62 + BASE62.index(char)
    return total


def base_url_for_token(token: str) -> str:
    partition = base62_to_int(token[1:3]) if token[0] == "A" else base62_to_int(token[1:3])
    host = f"p{partition:02d}-sharedstreams.icloud.com"
    return f"https://{host}/{token}/sharedstreams/"


def redirected_base_url(base_url: str, token: str) -> str:
    response = requests.post(
        base_url + "webstream",
        headers=HEADERS,
        data='{"streamCtag":null}',
        timeout=60,
    )
    if response.status_code == 330:
        host = response.json().get("X-Apple-MMe-Host")
        if host:
            return f"https://{host}/{token}/sharedstreams/"
    return base_url


def largest_derivative(photo: dict) -> dict | None:
    derivatives = photo.get("derivatives") or {}
    if not derivatives:
        return None
    items = []
    for derivative in derivatives.values():
        try:
            size = int(derivative.get("fileSize", 0))
        except (TypeError, ValueError):
            size = 0
        items.append((size, derivative))
    if not items:
        return None
    return max(items, key=lambda item: item[0])[1]


def fetch_album(token: str) -> dict:
    base = redirected_base_url(base_url_for_token(token), token)
    stream = requests.post(
        base + "webstream",
        headers=HEADERS,
        data='{"streamCtag":null}',
        timeout=120,
    )
    stream.raise_for_status()
    data = stream.json()
    guids = [photo["photoGuid"] for photo in data.get("photos", [])]

    chunks = [guids[i:i + 25] for i in range(0, len(guids), 25)]
    url_map: dict[str, str] = {}
    for chunk in chunks:
        asset = requests.post(
            base + "webasseturls",
            headers=HEADERS,
            data=json.dumps({"photoGuids": chunk}),
            timeout=120,
        )
        asset.raise_for_status()
        for item_id, item in asset.json().get("items", {}).items():
            url_map[item_id] = f"https://{item['url_location']}{item['url_path']}"

    photos = []
    for photo in data.get("photos", []):
        derivative = largest_derivative(photo)
        if not derivative:
            continue
        checksum = derivative.get("checksum")
        if not checksum or checksum not in url_map:
            continue
        photos.append(
            {
                "photo_guid": photo.get("photoGuid"),
                "caption": (photo.get("caption") or "").strip(),
                "width": int(photo.get("width", 0)),
                "height": int(photo.get("height", 0)),
                "bytes": int(derivative.get("fileSize", 0)),
                "url": url_map[checksum],
            }
        )

    return {
        "token": token,
        "title": data.get("streamName", ""),
        "count": len(photos),
        "photos": photos,
    }


def download_album(url_or_token: str, out_dir: Path) -> dict:
    token = extract_token(url_or_token)
    out_dir.mkdir(parents=True, exist_ok=True)
    meta = fetch_album(token)
    files = []
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT})

    for index, photo in enumerate(meta["photos"], start=1):
        response = session.get(photo["url"], timeout=120)
        response.raise_for_status()
        filename = f"{index:02d}.jpg"
        path = out_dir / filename
        path.write_bytes(response.content)
        files.append(
            {
                "file": filename,
                "source_url": photo["url"],
                "bytes": len(response.content),
                "caption": photo.get("caption"),
                "width": photo.get("width"),
                "height": photo.get("height"),
            }
        )

    result = {
        "album_url": url_or_token,
        "token": token,
        "title": meta.get("title"),
        "count": len(files),
        "files": files,
    }
    (out_dir / "metadata.json").write_text(json.dumps(result, indent=2))
    return result


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: fetch-icloud-album.py <url-or-token> <output-dir>", file=sys.stderr)
        sys.exit(1)
    result = download_album(sys.argv[1], Path(sys.argv[2]))
    print(json.dumps({"title": result.get("title"), "count": result.get("count")}, indent=2))


if __name__ == "__main__":
    main()
