#!/usr/bin/env python3
"""CLI to call ClaudeSwarm tRPC endpoints (no dependencies beyond stdlib)."""

import argparse
import json
import sys
import urllib.request
import urllib.error
import urllib.parse

DEFAULT_BASE = "http://localhost:3000/api/trpc"


def trpc_query(base_url: str, procedure: str, input_data=None):
    url = f"{base_url}/{procedure}"
    if input_data is not None:
        url += "?" + urllib.parse.urlencode({"input": json.dumps(input_data)})
    req = urllib.request.Request(url, method="GET")
    req.add_header("Content-Type", "application/json")
    return _do_request(req)


def trpc_mutation(base_url: str, procedure: str, input_data=None):
    url = f"{base_url}/{procedure}"
    body = json.dumps(input_data if input_data is not None else {}).encode()
    req = urllib.request.Request(url, data=body, method="POST")
    req.add_header("Content-Type", "application/json")
    return _do_request(req)


def _do_request(req: urllib.request.Request):
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode())
            result = data.get("result", {}).get("data", data)
            if isinstance(result, dict):
                return result.get("json", result)
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            err = json.loads(body)
            msg = (
                err.get("error", {}).get("json", {}).get("message")
                or err.get("error", {}).get("message")
                or body
            )
        except json.JSONDecodeError:
            msg = body
        print(f"Error {e.code}: {msg}", file=sys.stderr)
        sys.exit(1)
    except urllib.error.URLError as e:
        print(f"Connection error: {e.reason}", file=sys.stderr)
        sys.exit(1)


def cmd_workers(args):
    result = trpc_query(args.base_url, "workers")
    print(json.dumps(result, indent=2))


def cmd_destroy_worker(args):
    result = trpc_mutation(args.base_url, "destroyWorker", {"port": args.port})
    print(f"Worker on port {args.port} destroyed.")
    if result:
        print(json.dumps(result, indent=2))


def cmd_start_worker(args):
    env = {}
    if args.env:
        for pair in args.env:
            if "=" not in pair:
                print(f"Invalid env format '{pair}', expected KEY=VALUE", file=sys.stderr)
                sys.exit(1)
            k, v = pair.split("=", 1)
            env[k] = v

    result = trpc_mutation(
        args.base_url,
        "startWorker",
        {"title": args.title, "preset": args.preset, "env": env},
    )
    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser(description="ClaudeSwarm tRPC CLI")
    parser.add_argument(
        "--base-url",
        default=DEFAULT_BASE,
        help=f"tRPC base URL (default: {DEFAULT_BASE})",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("workers", help="List all workers")

    destroy = sub.add_parser("destroy-worker", help="Destroy a worker by port")
    destroy.add_argument("port", type=int, help="Port of the worker to destroy")

    start = sub.add_parser("start-worker", help="Start a new worker")
    start.add_argument("title", help="Worker title")
    start.add_argument("--preset", default="default", help="Preset name (default: default)")
    start.add_argument(
        "-e", "--env", action="append", metavar="KEY=VALUE",
        help="Environment variable (can be repeated)",
    )

    args = parser.parse_args()

    if args.command == "workers":
        cmd_workers(args)
    elif args.command == "destroy-worker":
        cmd_destroy_worker(args)
    elif args.command == "start-worker":
        cmd_start_worker(args)


if __name__ == "__main__":
    main()
