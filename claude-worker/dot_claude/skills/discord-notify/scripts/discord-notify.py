#!/usr/bin/env python3

import argparse
import json
import mimetypes
import os
import pathlib
import socket
import sys
import urllib.request
import uuid


USER_AGENT = "Mozilla/5.0"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Send a Discord webhook message and optionally attach a file."
    )
    parser.add_argument("message", help="Message body to send")
    parser.add_argument("file", nargs="?", help="Optional file to attach")
    return parser.parse_args()


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(f"error: missing required environment variable {name}", file=sys.stderr)
        raise SystemExit(1)
    return value


def build_content(user_id: str, message: str) -> str:
    return f"<@{user_id}> {message}"


def send_json(webhook_url: str, payload: dict[str, object]) -> None:
    data = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        webhook_url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(request):
        pass


def send_file(webhook_url: str, payload: dict[str, object], file_path: pathlib.Path) -> None:
    if not file_path.is_file():
        print(f"error: file not found: {file_path}", file=sys.stderr)
        raise SystemExit(1)

    boundary = f"----CursorDiscordNotify{uuid.uuid4().hex}"
    mime_type = mimetypes.guess_type(file_path.name)[0] or "application/octet-stream"
    payload_json = json.dumps(payload).encode("utf-8")
    file_data = file_path.read_bytes()

    body = b"".join(
        [
            f"--{boundary}\r\n".encode("utf-8"),
            b'Content-Disposition: form-data; name="payload_json"\r\n',
            b"Content-Type: application/json\r\n\r\n",
            payload_json,
            b"\r\n",
            f"--{boundary}\r\n".encode("utf-8"),
            (
                f'Content-Disposition: form-data; name="file"; filename="{file_path.name}"\r\n'
            ).encode("utf-8"),
            f"Content-Type: {mime_type}\r\n\r\n".encode("utf-8"),
            file_data,
            b"\r\n",
            f"--{boundary}--\r\n".encode("utf-8"),
        ]
    )

    request = urllib.request.Request(
        webhook_url,
        data=body,
        headers={
            "Content-Type": f"multipart/form-data; boundary={boundary}",
            "User-Agent": USER_AGENT,
        },
    )
    with urllib.request.urlopen(request):
        pass


def main() -> None:
    args = parse_args()
    webhook_url = require_env("DISCORD_WEBHOOK_URL")
    user_id = require_env("DISCORD_USER_ID")
    hostname = socket.gethostname()
    payload = {
        "content": build_content(user_id, args.message),
        "username": hostname,
    }

    if args.file:
        send_file(webhook_url, payload, pathlib.Path(args.file))
    else:
        send_json(webhook_url, payload)


if __name__ == "__main__":
    main()