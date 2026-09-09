#!/usr/bin/env python3
"""Record 线探 station up/down votes into data/votes.json."""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data" / "votes.json"
MAX_LOG = 500
VOTER_MAX = 80


def utcnow() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def empty_store() -> dict:
    return {"updatedAt": "", "stations": {}, "ballots": {}, "log": []}


class FileLock:
    def __init__(self, path: Path) -> None:
        self.path = str(path) + ".lock"
        self.fp = None

    def __enter__(self):
        self.fp = open(self.path, "a+b")
        if self.fp.tell() == 0:
            self.fp.write(b"0")
            self.fp.flush()
        self.fp.seek(0)
        if os.name == "nt":
            import msvcrt

            msvcrt.locking(self.fp.fileno(), msvcrt.LK_LOCK, 1)
        else:
            import fcntl

            fcntl.flock(self.fp.fileno(), fcntl.LOCK_EX)
        return self

    def __exit__(self, *exc) -> None:
        try:
            self.fp.seek(0)
            if os.name == "nt":
                import msvcrt

                msvcrt.locking(self.fp.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                import fcntl

                fcntl.flock(self.fp.fileno(), fcntl.LOCK_UN)
        finally:
            self.fp.close()


def load_store() -> dict:
    if not DATA.exists():
        return empty_store()
    try:
        data = json.loads(DATA.read_text(encoding="utf-8"))
    except Exception:
        return empty_store()
    if not isinstance(data, dict):
        return empty_store()
    data.setdefault("stations", {})
    data.setdefault("ballots", {})
    data.setdefault("log", [])
    return data


def save_store(data: dict) -> None:
    DATA.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(DATA)


def normalize_id(raw) -> str:
    return str(int(raw))


def normalize_voter(raw) -> str:
    voter = "".join(ch for ch in str(raw or "").strip() if ch.isalnum() or ch in "-_")
    return voter[:VOTER_MAX] or "anon"


def public_payload(data: dict, voter: str = "") -> dict:
    mine = {}
    if voter:
        raw = (data.get("ballots") or {}).get(voter) or {}
        mine = {str(k): v for k, v in raw.items() if v in ("up", "down")}
    stations = {}
    for sid, row in (data.get("stations") or {}).items():
        stations[str(sid)] = {
            "up": int((row or {}).get("up") or 0),
            "down": int((row or {}).get("down") or 0),
        }
    return {"updatedAt": data.get("updatedAt") or "", "stations": stations, "mine": mine}


def apply_vote(station_id, direction: str, voter: str) -> dict:
    sid = normalize_id(station_id)
    if direction not in ("up", "down"):
        raise ValueError("dir must be up or down")
    voter = normalize_voter(voter)
    with FileLock(DATA):
        data = load_store()
        stations = data.setdefault("stations", {})
        ballots = data.setdefault("ballots", {})
        mine = ballots.setdefault(voter, {})
        prev = mine.get(sid)
        counts = stations.setdefault(sid, {"up": 0, "down": 0})
        counts["up"] = int(counts.get("up") or 0)
        counts["down"] = int(counts.get("down") or 0)
        if prev == direction:
            counts[prev] = max(0, counts[prev] - 1)
            mine.pop(sid, None)
            now_dir = ""
        else:
            if prev in ("up", "down"):
                counts[prev] = max(0, counts[prev] - 1)
            counts[direction] += 1
            mine[sid] = direction
            now_dir = direction
        if not mine:
            ballots.pop(voter, None)
        if counts["up"] == 0 and counts["down"] == 0:
            stations.pop(sid, None)
        data["updatedAt"] = utcnow()
        log = data.setdefault("log", [])
        log.append(
            {
                "id": int(sid),
                "dir": now_dir or "cancel",
                "prev": prev or "",
                "voter": voter,
                "at": data["updatedAt"],
            }
        )
        data["log"] = log[-MAX_LOG:]
        save_store(data)
        return {"id": int(sid), "up": counts["up"], "down": counts["down"], "mine": now_dir}


def cmd_dump(voter: str) -> dict:
    with FileLock(DATA):
        return public_payload(load_store(), normalize_voter(voter) if voter else "")


def cmd_get(station_id, voter: str) -> dict:
    sid = normalize_id(station_id)
    payload = cmd_dump(voter)
    row = payload["stations"].get(sid) or {"up": 0, "down": 0}
    return {
        "id": int(sid),
        "up": row["up"],
        "down": row["down"],
        "mine": payload["mine"].get(sid) or "",
        "updatedAt": payload["updatedAt"],
    }


class VoteHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args) -> None:
        sys.stderr.write("votes: " + (fmt % args) + "\n")

    def _send(self, code: int, payload) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.rstrip("/") != "/api/votes":
            self._send(404, {"error": "not found"})
            return
        q = parse_qs(parsed.query)
        voter = (q.get("voter") or [""])[0]
        sid = (q.get("id") or [""])[0]
        try:
            if sid:
                self._send(200, cmd_get(sid, voter))
            else:
                self._send(200, cmd_dump(voter))
        except Exception as err:
            self._send(400, {"error": str(err)})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path.rstrip("/") != "/api/votes":
            self._send(404, {"error": "not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        raw = self.rfile.read(max(0, min(length, 65536))) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
            self._send(200, apply_vote(body.get("id"), body.get("dir"), body.get("voter")))
        except Exception as err:
            self._send(400, {"error": str(err)})


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="线探投票记录")
    sub = parser.add_subparsers(dest="cmd", required=True)
    dump = sub.add_parser("dump")
    dump.add_argument("--voter", default="")
    getp = sub.add_parser("get")
    getp.add_argument("--id", required=True)
    getp.add_argument("--voter", default="")
    vote = sub.add_parser("vote")
    vote.add_argument("--id", required=True)
    vote.add_argument("--dir", required=True, choices=["up", "down"])
    vote.add_argument("--voter", default="anon")
    serve = sub.add_parser("serve")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=4174)
    args = parser.parse_args(argv)

    if args.cmd == "dump":
        json.dump(cmd_dump(args.voter), sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if args.cmd == "get":
        json.dump(cmd_get(args.id, args.voter), sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    if args.cmd == "vote":
        json.dump(apply_vote(args.id, args.dir, args.voter), sys.stdout, ensure_ascii=False)
        sys.stdout.write("\n")
        return 0
    httpd = ThreadingHTTPServer((args.host, args.port), VoteHandler)
    sys.stderr.write(f"votes http://{args.host}:{args.port}/api/votes\n")
    httpd.serve_forever()
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except BrokenPipeError:
        raise SystemExit(0)
