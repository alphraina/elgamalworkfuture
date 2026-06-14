"""
OMTP Log Pusher — OPPO CMMS Machine Monitor
============================================

HOW IT WORKS (fully automatic, zero configuration):

  1. Gets the PC's own IP address (the one used to reach the CMMS server)
  2. Calls GET /api/machine-data/identify?ip=<IP>
       → CMMS looks up the IP in the Machine Registry
       → Returns: lineId, lineName, productModel (from today's shift setup)
  3. Reads D:\\OMTP_LOG\\{MODEL}\\data\\{DATE}.csv every interval seconds
     DATE is auto-detected — works with any OMTP date format:
       23-3-2026  /  23-03-2026  /  2026-03-23  /  20260323
     At midnight the pusher automatically switches to the new day's file.
  4. Pushes new rows to POST /api/machine-data

  If the IP is not registered, falls back to scanning D:\\OMTP_LOG\\ for
  any model folder that has today's CSV, and derives the line number from
  the folder name (TAM30202 → Line 2, TAM30203 → Line 3).

Usage (Windows CMD):
    python omtp_log_pusher.py --api-url https://YOUR_CMMS_URL --api-key YOUR_KEY

Or set environment variables:
    set CMMS_API_URL=https://your-cmms.replit.app
    set CMMS_API_KEY=your-machine-api-key
    python omtp_log_pusher.py
"""

import csv
import io
import time
import os
import re
import sys
import json
import socket
import zipfile
import argparse
import logging
import datetime
import platform
import subprocess
import threading
import ctypes
import ctypes.wintypes
import xml.etree.ElementTree as ET
import requests


def _read_file_bytes(path: str) -> bytes:
    """
    Read a file's raw bytes even if another process (e.g. OMTP) has it open.

    On Windows, Python's built-in open() requests exclusive-compatible access.
    If OMTP keeps the xlsx file open, open() raises PermissionError.
    The fix: call CreateFileW with FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE
    which tells Windows we are happy to share the file with all other openers.
    Falls back to plain open() on non-Windows.
    """
    if platform.system() == "Windows":
        try:
            GENERIC_READ           = 0x80000000
            FILE_SHARE_READ        = 0x00000001
            FILE_SHARE_WRITE       = 0x00000002
            FILE_SHARE_DELETE      = 0x00000004
            OPEN_EXISTING          = 3
            FILE_ATTRIBUTE_NORMAL  = 0x80
            INVALID_HANDLE_VALUE   = ctypes.wintypes.HANDLE(-1).value

            k32 = ctypes.windll.kernel32  # type: ignore[attr-defined]
            handle = k32.CreateFileW(
                path,
                GENERIC_READ,
                FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
                None,
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                None,
            )
            if handle == INVALID_HANDLE_VALUE:
                err = k32.GetLastError()
                raise PermissionError(f"CreateFileW failed (err={err}): {path}")
            try:
                size = ctypes.c_int64(0)
                k32.GetFileSizeEx(handle, ctypes.byref(size))
                file_size = size.value
                if file_size == 0:
                    return b""
                buf = ctypes.create_string_buffer(file_size)
                bytes_read = ctypes.wintypes.DWORD(0)
                ok = k32.ReadFile(handle, buf, file_size, ctypes.byref(bytes_read), None)
                if not ok:
                    raise OSError(f"ReadFile failed: {path}")
                return buf.raw[: bytes_read.value]
            finally:
                k32.CloseHandle(handle)
        except AttributeError:
            pass  # ctypes.windll not available — shouldn't happen on Windows
    return open(path, "rb").read()


log = logging.getLogger("omtp-pusher")


def _setup_logging(log_file: str | None) -> None:
    """
    Configure logging.  When log_file is given (running hidden/windowless),
    write to that file with rotation.  Always write to stdout as well so
    manual console runs still show output.
    """
    fmt = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")
    handlers: list[logging.Handler] = [logging.StreamHandler(sys.stdout)]
    if log_file:
        try:
            from logging.handlers import RotatingFileHandler
            fh = RotatingFileHandler(
                log_file,
                maxBytes=5 * 1024 * 1024,  # 5 MB per file
                backupCount=3,
                encoding="utf-8",
            )
            fh.setFormatter(fmt)
            handlers.append(fh)
        except Exception as e:
            sys.stderr.write(f"[WARN] Could not open log file {log_file}: {e}\n")
    for h in handlers:
        h.setFormatter(fmt)
    logging.basicConfig(level=logging.INFO, handlers=handlers)


def _acquire_single_instance() -> bool:
    """
    Prevent two copies of the pusher running at the same time.
    Uses a named Windows Mutex; always returns True on non-Windows.
    Returns True if this is the only instance, False if another is running.
    """
    if platform.system() != "Windows":
        return True
    try:
        _mutex = ctypes.windll.kernel32.CreateMutexW(  # type: ignore[attr-defined]
            None, True, "Global\\OPPOCMMSOmtpLogPusher"
        )
        ERROR_ALREADY_EXISTS = 183
        if ctypes.windll.kernel32.GetLastError() == ERROR_ALREADY_EXISTS:  # type: ignore[attr-defined]
            return False
        return bool(_mutex)
    except Exception:
        return True  # can't check — allow running

# ── CONFIG ───────────────────────────────────────────────────────────────────

LOG_ROOT      = os.environ.get("OMTP_LOG", r"D:\OMTP_LOG")
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL", "30"))

DEFAULT_COLUMNS = {
    "station":   "OPER",        # station / operator ID
    "result":    "TEST_RESULT", # PASS / FAIL / NG  (overrides pass+fail counts)
    "pass":      "",            # optional pass-count column (empty = unused)
    "fail":      "",            # optional fail-count column (empty = unused)
    "error":     "RESULT_MSG",  # error / result message
    "timestamp": "TEST_TIME",   # test date-time
    "lot":       "LOT_ID",      # device lot ID
    "cycle":     "CYCLETIME",   # cycle time (seconds or ms)
}

# ── IP DETECTION ─────────────────────────────────────────────────────────────

def get_local_ip(server_url: str) -> str:
    """
    Get the local IP that this PC uses to reach the CMMS server.
    Uses a UDP connect trick — no data is actually sent.
    This gives us the correct network interface IP, not 127.0.0.1.
    """
    try:
        host = server_url.replace("https://", "").replace("http://", "").split("/")[0].split(":")[0]
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(2)
        s.connect((host, 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        # Fallback: try resolving hostname
        try:
            return socket.gethostbyname(socket.gethostname())
        except Exception:
            return "0.0.0.0"


# ── CMMS IDENTIFICATION ───────────────────────────────────────────────────────

# Status codes where we should retry (server temporarily unavailable)
_TRANSIENT_CODES = {502, 503, 504, 429}


def _identify(api_url: str, api_key: str, params: dict,
              retries: int = 1, retry_delay: float = 5.0) -> dict | None:
    """
    Shared identify logic. params = {"ip": ...} or {"token": ...}
    Returns the response dict if found=True, else None.
    """
    label = next(f"{k}={v}" for k, v in params.items())
    for attempt in range(1 + retries):
        try:
            r = requests.get(
                f"{api_url}/api/machine-data/identify",
                params=params,
                headers={"X-API-Key": api_key},
                timeout=10,
            )
            if r.ok:
                data = r.json()
                if data.get("found"):
                    return data
                log.warning(f"Not in Machine Registry ({label}): {data.get('message', '')}")
                return None
            elif r.status_code in _TRANSIENT_CODES:
                if attempt < retries:
                    log.warning(
                        f"Identify HTTP {r.status_code} (server may be starting up) — "
                        f"retrying in {retry_delay:.0f}s ({attempt+1}/{retries})..."
                    )
                    time.sleep(retry_delay)
                    continue
                else:
                    log.warning(f"Identify failed after {retries+1} attempts: HTTP {r.status_code}")
            else:
                log.warning(f"Identify failed: HTTP {r.status_code}")
        except requests.exceptions.ConnectionError as e:
            if attempt < retries:
                log.warning(
                    f"Cannot reach CMMS (attempt {attempt+1}/{retries+1}): {e} — "
                    f"retrying in {retry_delay:.0f}s..."
                )
                time.sleep(retry_delay)
                continue
            else:
                log.warning(f"Cannot reach CMMS after {retries+1} attempts: {e}")
        except Exception as e:
            log.warning(f"Could not reach identify endpoint: {e}")
        break
    return None


def identify_by_token(api_url: str, api_key: str, machine_token: str,
                      retries: int = 1, retry_delay: float = 5.0) -> dict | None:
    """
    Identify machine by QR code token — preferred over IP because the token
    never changes even when the PC gets a new IP address.
    """
    return _identify(api_url, api_key, {"token": machine_token}, retries, retry_delay)


def identify_by_ip(api_url: str, api_key: str, local_ip: str,
                   retries: int = 1, retry_delay: float = 5.0) -> dict | None:
    """
    Identify machine by IP address — legacy fallback.
    Returns dict with keys: lineId, lineName, model, machineName, machineCode
    """
    return _identify(api_url, api_key, {"ip": local_ip}, retries, retry_delay)


# ── FALLBACK: FOLDER SCAN ─────────────────────────────────────────────────────

def detect_line_from_folder(folder_name: str) -> int:
    """
    Extract line ID from folder name.
    Rule: take the trailing digits.
      TAM30202 → "30202" → >50 → last 2 digits → 02 → 2
      TAM30203 → "30203" → >50 → last 2 digits → 03 → 3
      LINE3    → "3"     → 3
    """
    m = re.search(r"(\d+)$", folder_name)
    if not m:
        return 0
    digits = m.group(1)
    n = int(digits)
    if 1 <= n <= 50:
        return n
    last2 = int(digits[-2:]) if len(digits) >= 2 else n
    return last2 if last2 > 0 else int(digits[-1]) if digits else 0


def scan_folders(log_root: str) -> list[dict]:
    """
    Fallback: scan D:\\OMTP_LOG\\ for model folders that have today's CSV/xlsx.
    Uses find_today_file() so it works regardless of OMTP's date-format.
    Returns [{model, line_id, csv_path}]
    """
    found = []
    if not os.path.isdir(log_root):
        log.warning(f"Log root not found: {log_root}")
        return found
    for entry in os.scandir(log_root):
        if not entry.is_dir():
            continue
        model = entry.name
        line_id = detect_line_from_folder(model)
        if line_id == 0:
            continue
        data_dir = os.path.join(log_root, model, "data")
        csv_path, stem = find_today_file(data_dir)
        if csv_path is None:
            # File doesn't exist yet — include anyway so the loop waits for it
            csv_path = os.path.join(data_dir, f"{today_date_str()}.csv")
        found.append({"model": model, "line_id": line_id, "csv_path": csv_path})
    return found


# ── XLSX READER (stdlib only, no openpyxl needed) ─────────────────────────────

_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"

def _xlsx_tag(name: str) -> str:
    return f"{{{_NS}}}{name}"

def read_xlsx_rows(raw_bytes: bytes) -> list[dict]:
    """Parse an xlsx (ZIP+XML) file and return rows as list of dicts."""
    with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
        names = set(zf.namelist())

        # ── Shared strings ────────────────────────────────────────────────
        shared = []
        if "xl/sharedStrings.xml" in names:
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in root.findall(_xlsx_tag("si")):
                t_elem = si.find(_xlsx_tag("t"))
                if t_elem is not None:
                    shared.append(t_elem.text or "")
                else:
                    # Rich text — concatenate all <r><t>
                    shared.append("".join(
                        (r.find(_xlsx_tag("t")).text or "")
                        for r in si.findall(_xlsx_tag("r"))
                        if r.find(_xlsx_tag("t")) is not None
                    ))

        # ── Find first worksheet ──────────────────────────────────────────
        sheet_path = next(
            (n for n in sorted(names)
             if re.match(r"xl/worksheets/sheet\d+\.xml", n)),
            None,
        )
        if not sheet_path:
            return []

        root = ET.fromstring(zf.read(sheet_path))
        raw_rows: list[list[str]] = []

        for row_el in root.iter(_xlsx_tag("row")):
            cells: dict[int, str] = {}
            for c in row_el.findall(_xlsx_tag("c")):
                ref = c.get("r", "")
                # Correct A→Z, AA→AZ, BA→... conversion to 0-based index
                col_idx = 0
                for ch in ref:
                    if ch.isalpha():
                        col_idx = col_idx * 26 + (ord(ch.upper()) - ord("A") + 1)
                col_idx -= 1
                t = c.get("t", "")
                v = c.find(_xlsx_tag("v"))
                is_el = c.find(f"{_xlsx_tag('is')}/{_xlsx_tag('t')}")
                if t == "s" and v is not None and v.text is not None:
                    idx = int(v.text)
                    cells[col_idx] = shared[idx] if idx < len(shared) else ""
                elif t == "inlineStr" and is_el is not None:
                    cells[col_idx] = is_el.text or ""
                elif v is not None and v.text is not None:
                    cells[col_idx] = v.text
                else:
                    cells[col_idx] = ""
            if cells:
                max_col = max(cells) + 1
                raw_rows.append([cells.get(i, "") for i in range(max_col)])

        if len(raw_rows) < 2:
            return []

        headers = raw_rows[0]
        return [
            {headers[i]: row[i] if i < len(row) else "" for i in range(len(headers))}
            for row in raw_rows[1:]
        ]


# ── CSV PUSH ──────────────────────────────────────────────────────────────────

def today_date_str() -> str:
    """Return today's date in the legacy non-padded format (used as fallback)."""
    d = datetime.date.today()
    return f"{d.day}-{d.month}-{d.year}"


def find_today_file(data_dir: str) -> tuple[str | None, str]:
    """
    Locate today's CSV or xlsx in *data_dir* regardless of which date-format
    the installed OMTP version uses.

    OMTP versions seen in the wild:
      23-3-2026   (non-zero-padded day/month, the original)
      23-03-2026  (zero-padded day & month)
      2026-03-23  (ISO-ish yyyy-mm-dd)
      20260323    (compact yyyymmdd)
      23032026    (compact ddmmyyyy)

    Returns (path, date_stem) — path is the file that exists today,
    date_stem is the bare name used (without extension).
    Returns (None, "") if no file for today exists yet.
    """
    today = datetime.date.today()
    d, m, y = today.day, today.month, today.year

    candidates = [
        f"{d}-{m}-{y}",          # 23-3-2026
        f"{d:02d}-{m:02d}-{y}",  # 23-03-2026
        f"{y}-{m:02d}-{d:02d}",  # 2026-03-23
        f"{y}{m:02d}{d:02d}",    # 20260323
        f"{d:02d}{m:02d}{y}",    # 23032026
    ]

    if not os.path.isdir(data_dir):
        return None, ""

    for stem in candidates:
        for ext in (".csv", ".xlsx"):
            path = os.path.join(data_dir, f"{stem}{ext}")
            if os.path.exists(path):
                return path, stem

    return None, ""


def _int(val) -> int:
    try:
        return int(val)
    except (ValueError, TypeError):
        return 0


def read_file_rows(csv_path: str) -> list[dict]:
    """
    Read all data rows from a file — handles plain CSV, ZIP+CSV, and xlsx.
    Returns a list of dicts (one per data row, keys = column headers).
    """
    try:
        raw_bytes = _read_file_bytes(csv_path)
    except PermissionError as e:
        log.warning(f"File still locked (sharing denied) — will retry: {e}")
        return []
    except FileNotFoundError:
        log.warning(f"CSV not found: {csv_path}  (waiting for OMTP to create it)")
        return []

    if raw_bytes[:2] == b"PK":
        try:
            with zipfile.ZipFile(io.BytesIO(raw_bytes)) as _zf:
                zf_names = _zf.namelist()
            if "xl/workbook.xml" in zf_names:
                rows = read_xlsx_rows(raw_bytes)
                if rows:
                    log.info(f"xlsx: {len(rows)} rows, cols: {list(rows[0].keys())[:8]}…")
                return rows
            else:
                csv_names = [n for n in zf_names if n.lower().endswith(".csv")]
                if not csv_names:
                    log.warning(f"ZIP has no CSV inside: {csv_path}")
                    return []
                with zipfile.ZipFile(io.BytesIO(raw_bytes)) as zf:
                    raw_bytes = zf.read(csv_names[0])
        except zipfile.BadZipFile:
            log.warning(f"File looks like ZIP but is corrupt: {csv_path}")
            return []

    for enc in ("utf-8-sig", "gbk", "gb2312", "latin-1"):
        try:
            raw_bytes.decode(enc)
            break
        except (UnicodeDecodeError, LookupError):
            continue
    else:
        enc = "latin-1"
    content = raw_bytes.decode(enc, errors="replace")
    rows = list(csv.DictReader(io.StringIO(content)))
    return rows


def push_rows(api_url: str, api_key: str, csv_path: str, col: dict,
              already_sent: int, line_id: int, model: str,
              machine_ip: str | None = None,
              machine_token: str | None = None) -> tuple[int, int]:
    """
    Push new rows from csv_path to the CMMS API.
    already_sent: rows already seen at the top of the file (-1 = seek to current end on first call).
    Returns (rows_pushed, new_position).
    If the file shrank (OMTP rewrote it), resets to 0 so all rows are re-pushed.
    """
    all_rows = read_file_rows(csv_path)
    total = len(all_rows)

    if total == 0:
        return 0, already_sent  # preserve position — file locked or empty

    # First open: start from the current end of the file so only NEW rows are pushed.
    # already_sent == -1 is a sentinel meaning "seek to end on first read".
    if already_sent == -1:
        log.info(f"Opened today's file: {csv_path}")
        log.info(f"Headers: {list(all_rows[0].keys())[:10]}…")
        log.info(f"Skipping {total} existing rows — watching for new rows from now on.")
        return 0, total

    # If file shrank (OMTP rewrote from scratch), reset position
    if total < already_sent:
        log.info(f"File reset detected ({already_sent}→{total} rows) — restarting from row 0")
        already_sent = 0

    new_rows = all_rows[already_sent:]
    if new_rows:
        log.info(f"File: {total} rows total | {already_sent} already seen | {len(new_rows)} new")

    pushed = 0
    for row in new_rows:
        now_utc = datetime.datetime.now(datetime.timezone.utc).isoformat()
        raw_result = row.get(col.get("result", ""), "").strip().upper()
        if raw_result in ("PASS", "OK", "PASSED", "GOOD"):
            status = "pass"
        elif raw_result in ("FAIL", "NG", "FAILED", "BAD", "ERROR", "DEFECT"):
            status = "fail"
        else:
            pc = _int(row.get(col.get("pass", ""), 0)) or 0
            fc = _int(row.get(col.get("fail", ""), 0)) or 0
            status = "fail" if fc > 0 else ("pass" if pc > 0 else "unknown")
        payload = {
            "lineId":    line_id,
            "model":     model,
            "status":    status,
            "passCount": 1 if status == "pass" else 0,
            "failCount": 1 if status == "fail" else 0,
            "station":   row.get(col.get("station", ""), ""),
            "resultMsg": row.get(col.get("error", ""), "") or None,
            "lotId":     row.get(col.get("lot", ""), "") or None,
            "cycleTime": row.get(col.get("cycle", ""), "") or None,
            "testTime":  row.get(col.get("timestamp", ""), "") or now_utc,
        }
        if machine_token:
            payload["machineToken"] = machine_token
        elif machine_ip:
            payload["machine_ip"] = machine_ip
        try:
            r = requests.post(
                f"{api_url}/api/machine-data",
                json=payload,
                headers={"X-API-Key": api_key, "Content-Type": "application/json"},
                timeout=10,
            )
            if r.ok:
                pushed += 1
                already_sent += 1
            else:
                log.warning(f"Push rejected {r.status_code}: {r.text[:80]}")
                break  # stop on rejection — retry next cycle from same position
        except Exception as e:
            log.warning(f"Push error: {e}")
            break
    return pushed, already_sent


# ── STARTUP BANNER ────────────────────────────────────────────────────────────

def show_startup_banner(api_url: str, log_file: str | None) -> None:
    """Spawn a small CMD window for 2 seconds to confirm the pusher is running."""
    if platform.system() != "Windows":
        return
    try:
        log_path = log_file or os.path.join(os.path.dirname(os.path.abspath(__file__)), "omtp_log.txt")
        cmd = (
            "cmd /c "
            "title OPPO CMMS - OMTP Log Pusher & "
            "color 0A & "
            "echo. & "
            "echo   ============================================== & "
            "echo     OPPO CMMS  -  OMTP Log Pusher & "
            "echo   ============================================== & "
            "echo. & "
            f"echo   Server  : {api_url} & "
            f"echo   Log     : {log_path} & "
            "echo. & "
            "echo   Running silently in background... & "
            "echo   This window closes in 2 seconds. & "
            "echo. & "
            "timeout /t 2 /nobreak > nul"
        )
        subprocess.Popen(cmd, creationflags=subprocess.CREATE_NEW_CONSOLE, shell=False)
    except Exception:
        pass


# ── MAIN ──────────────────────────────────────────────────────────────────────

def _heartbeat_loop(api_url: str, api_key: str, machine_token: "str | None",
                    local_ip: str, interval: int = 240) -> None:
    """
    Background daemon thread — pings CMMS every `interval` seconds (default 4 min).
    This keeps the PUSHER ACTIVE badge green even when no CSV rows are being pushed
    (e.g. machine idle, waiting for shift setup, or no OMTP file yet today).
    """
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}
    while True:
        time.sleep(interval)
        try:
            payload: dict = {}
            if machine_token:
                payload["machineToken"] = machine_token
            else:
                payload["machineIp"] = local_ip
            requests.post(
                f"{api_url}/api/machine-data/heartbeat",
                json=payload,
                headers=headers,
                timeout=10,
            )
            log.debug("Heartbeat sent.")
        except Exception:
            log.debug("Heartbeat failed (network issue — will retry).")


def _ensure_machine_identity(api_url: str, api_key: str, local_ip: str,
                              machine_json_path: str) -> "str | None":
    """
    Read cmms_machine.json.  If missing or not linked, query CMMS by IP and save.
    Returns the stored QR token (str) or None (use IP identification instead).
    Compatible with both old-BAT JSON files and new ones written by this function.
    """
    stored: dict = {}
    if os.path.exists(machine_json_path):
        try:
            with open(machine_json_path, "r", encoding="utf-8") as fh:
                stored = json.load(fh)
        except Exception as exc:
            log.warning(f"  [identity] Cannot read {machine_json_path}: {exc}")

    # Linked with a valid non-empty token → use it (IP-independent)
    tok = stored.get("token") or ""
    if stored.get("linked") and tok and tok not in ("null", "None"):
        log.info(f"  Identity : loaded from cmms_machine.json")
        log.info(f"  Machine  : {stored.get('machineName', '?')} ({stored.get('machineCode', '?')})")
        log.info(f"  Line     : {stored.get('lineId')} — {stored.get('lineName', '')}")
        log.info(f"  Mode     : QR Token ✓ (IP-independent)")
        return tok

    # Linked but no token → IP mode (already identified before, no need to re-query)
    if stored.get("linked"):
        log.info(f"  Identity : loaded (IP mode — no QR token set for this machine)")
        log.info(f"  Machine  : {stored.get('machineName', '?')} ({stored.get('machineCode', '?')})")
        return None

    # Not linked yet (first run, or previously unlinked stub) → query CMMS by IP
    log.info(f"  Identity : not yet linked. Querying CMMS by IP {local_ip}...")
    try:
        resp = requests.get(
            f"{api_url}/api/machine-data/identify",
            params={"ip": local_ip},
            headers={"X-API-Key": api_key},
            timeout=15,
        )
        if not resp.ok:
            log.warning(f"  Identity : server returned {resp.status_code}. Running unlinked.")
            return None
        data = resp.json()
        new_token = data.get("token") or ""
        if new_token in ("null", "None"):
            new_token = ""
        entry = {
            "token":       new_token,
            "machineName": data.get("machineName", ""),
            "machineCode": data.get("machineCode", ""),
            "lineId":      data.get("lineId", 0),
            "lineName":    data.get("lineName", ""),
            "setupIp":     local_ip,
            "linked":      bool(data.get("found")),
        }
        try:
            os.makedirs(os.path.dirname(os.path.abspath(machine_json_path)), exist_ok=True)
            with open(machine_json_path, "w", encoding="utf-8") as fh:
                json.dump(entry, fh, indent=2)
        except Exception as exc:
            log.warning(f"  Identity : could not save {machine_json_path}: {exc}")

        if entry["linked"]:
            log.info(f"  Identity : linked!  Machine={entry['machineName']}  Line={entry['lineId']}")
            if new_token:
                log.info(f"  Mode     : QR Token ✓ (saved — stable across IP changes)")
            else:
                log.info(f"  Mode     : IP-based (no QR token set for this machine in Registry)")
            return new_token or None
        else:
            log.warning(f"  Identity : IP {local_ip} not in Machine Registry — running unlinked.")
            log.warning(f"  → In CMMS Machine Registry: find this machine and set IP to {local_ip}")
            log.warning(f"  → Then restart the pusher to link automatically.")
            return None
    except Exception as exc:
        log.warning(f"  Identity : CMMS query failed ({exc}). Running without identity.")
        return None


def main():
    parser = argparse.ArgumentParser(description="OMTP Log Pusher for OPPO CMMS")
    parser.add_argument("--api-url",       default=os.environ.get("CMMS_API_URL", "http://localhost:8080"))
    parser.add_argument("--api-key",       default=os.environ.get("CMMS_API_KEY", ""))
    parser.add_argument("--machine-token", default=None,
                        help="QR code token (legacy — prefer --machine-dir for auto-management)")
    parser.add_argument("--machine-dir",   default=None,
                        help="Folder containing cmms_machine.json (auto read/write identity file)")
    parser.add_argument("--log-root",      default=LOG_ROOT)
    parser.add_argument("--line-id",       type=int, default=0, help="Force line ID (0 = auto)")
    parser.add_argument("--interval",      type=int, default=POLL_INTERVAL)
    parser.add_argument("--column-map",    default=None)
    parser.add_argument("--log-file",      default=None,
                        help="Write log output to this file (used when running hidden/windowless)")
    args, _unknown = parser.parse_known_args()
    if _unknown:
        log.warning(f"Ignoring unrecognized arguments (old BAT version): {_unknown}")

    # Set up logging first — FileHandler added here if --log-file is given
    _setup_logging(args.log_file)

    # Single-instance guard — exit silently if another copy is already running
    if not _acquire_single_instance():
        log.info("Another instance of OMTP Log Pusher is already running. Exiting.")
        sys.exit(0)

    api_url = args.api_url.rstrip("/")
    api_key = args.api_key
    if not api_key:
        log.error("No API key. Use --api-key or set CMMS_API_KEY.")
        sys.exit(1)

    # Show a 2-second visible window only when run manually (not via BAT startup,
    # which already shows its own 2-second window before launching Python)
    if not args.log_file:
        show_startup_banner(api_url, args.log_file)

    col = DEFAULT_COLUMNS.copy()
    if args.column_map:
        col.update(json.loads(args.column_map))

    # ── Get local IP once at startup ─────────────────────────────────
    local_ip = get_local_ip(api_url)
    log.info(f"OMTP Log Pusher starting")
    log.info(f"  API    : {api_url}")
    log.info(f"  This PC: {local_ip}")

    # ── Resolve machine token ─────────────────────────────────────────
    # Always manage cmms_machine.json in the BAT folder (--machine-dir) or,
    # if not provided (old BAT), in the same folder as this script itself.
    # This guarantees the file is created on EVERY run, regardless of BAT version.
    machine_token: str | None = None
    if args.line_id == 0:
        effective_dir = args.machine_dir or os.path.dirname(os.path.abspath(__file__))
        machine_json_path = os.path.join(effective_dir, "cmms_machine.json")
        machine_token = _ensure_machine_identity(api_url, api_key, local_ip, machine_json_path)
        # Backward compat: if old BAT passed --machine-token and JSON gave nothing, use it
        if not machine_token and args.machine_token and args.machine_token not in ("", "null", "None"):
            machine_token = args.machine_token
            log.info(f"  Token  : {machine_token}  (legacy --machine-token flag)")

    # ── Identify machine — token takes priority over IP ───────────────
    identity = None
    if machine_token and args.line_id == 0:
        identity = identify_by_token(api_url, api_key, machine_token,
                                     retries=5, retry_delay=5.0)
        if identity:
            log.info(f"  Machine: {identity.get('machineName') or identity.get('machineCode', '?')} "
                     f"({identity.get('machineCode', '?')})")
            log.info(f"  Line   : {identity.get('lineId')} — {identity.get('lineName', '')}")
            log.info(f"  Model  : {identity.get('model') or '(not set yet — will retry)'}")
            log.info(f"  Mode   : Token-based identification ✓  (stable — IP changes don't matter)")
        else:
            log.warning(f"  Token {machine_token!r} not found in registry. Falling back to IP identification...")
            identity = identify_by_ip(api_url, api_key, local_ip,
                                      retries=5, retry_delay=5.0)
            if identity:
                log.info(f"  Machine: {identity.get('machineName') or identity.get('machineCode', '?')} "
                         f"({identity.get('machineCode', '?')})")
                log.info(f"  Mode   : IP-fallback identification ✓  (token not found in registry)")
            else:
                log.warning(f"  IP {local_ip} not in Machine Registry either. Running in folder-scan mode.")
    elif args.line_id == 0:
        identity = identify_by_ip(api_url, api_key, local_ip,
                                  retries=5, retry_delay=5.0)
        if identity:
            log.info(f"  Machine: {identity.get('machineName') or identity.get('machineCode', '?')} "
                     f"({identity.get('machineCode', '?')})")
            log.info(f"  Line   : {identity.get('lineId')} — {identity.get('lineName', '')}")
            log.info(f"  Model  : {identity.get('model') or '(not set yet — will retry)'}")
            log.info(f"  Mode   : IP-based identification ✓")
        else:
            log.info(f"  Mode   : Folder-scan fallback (IP not in Machine Registry)")
            log.info(f"           TIP: Set machine token in cmms_machine.json for stable identification")

    if args.line_id:
        log.info(f"  Line   : {args.line_id} (forced via --line-id)")
        log.info(f"  Mode   : Manual line override")

    # ── Heartbeat thread — keeps PUSHER ACTIVE on CMMS even when idle ─
    hb_thread = threading.Thread(
        target=_heartbeat_loop,
        args=(api_url, api_key, machine_token, local_ip),
        daemon=True,
    )
    hb_thread.start()
    log.info("  Heartbeat thread started (every 4 min).")

    # ── Main loop ────────────────────────────────────────────────────
    sent_keys: dict[str, int] = {}
    current_date = datetime.date.today()

    while True:
        today = datetime.date.today()

        # ── Day-rollover detection ────────────────────────────────────────
        if today != current_date:
            log.info("=" * 60)
            log.info(
                f"  NEW DAY: {current_date.strftime('%d-%m-%Y')} → {today.strftime('%d-%m-%Y')}"
            )
            log.info("  Resetting row counters — switching to new date file.")
            log.info("=" * 60)
            sent_keys.clear()
            current_date = today

        # Re-fetch identity every loop (model may change between shifts)
        if args.line_id == 0 and identity is not None:
            if machine_token:
                fresh = identify_by_token(api_url, api_key, machine_token)
            else:
                fresh = identify_by_ip(api_url, api_key, local_ip)
            if fresh:
                identity = fresh

        if identity:
            # ── Token/IP mode: CMMS knows this machine ───────────────
            # OMTP creates folders named after the product model (e.g. CPH2025).
            # lineId and model both come from the identify endpoint.
            line_id = identity.get("lineId")
            model   = identity.get("model")

            if not line_id:
                log.warning("Machine registered but no line assigned. Check Machine Registry.")
                time.sleep(args.interval)
                continue

            if not model:
                log.warning(
                    f"No product model set for Line {line_id} today. "
                    f"Team leader: open CMMS → Production Capacity → Shift Setup."
                )
                time.sleep(args.interval)
                continue

            # Find today's CSV — handles any OMTP date-format variant
            data_dir = os.path.join(args.log_root, model, "data")
            csv_path, date_stem = find_today_file(data_dir)
            if csv_path is None:
                log.warning(
                    f"No file for {today.strftime('%d-%m-%Y')} yet in {data_dir}. "
                    f"Waiting for OMTP to create it…"
                )
                time.sleep(args.interval)
                continue

            key = f"{model}:{line_id}"
            if key not in sent_keys:
                sent_keys[key] = -1  # sentinel: push_rows will seek to end on first call
            pushed, sent_keys[key] = push_rows(api_url, api_key, csv_path, col,
                                               sent_keys[key], line_id, model,
                                               machine_ip=local_ip if not machine_token else None,
                                               machine_token=machine_token)
            if pushed:
                log.info(
                    f"Line {line_id} ({identity.get('lineName', '')}) "
                    f"| {model} — pushed {pushed} new rows"
                )

        elif args.line_id:
            # ── Forced line mode ─────────────────────────────────────
            line_id = args.line_id
            targets = scan_folders(args.log_root)
            for t in targets:
                if t["line_id"] != line_id:
                    continue
                key = f"{t['model']}:{line_id}"
                if key not in sent_keys:
                    sent_keys[key] = -1
                pushed, sent_keys[key] = push_rows(api_url, api_key, t["csv_path"], col, sent_keys[key], line_id, t["model"])
                if pushed:
                    log.info(f"Line {line_id} | {t['model']} — pushed {pushed} new rows")

        else:
            # ── Folder-scan fallback: IP not registered ──────────────
            targets = scan_folders(args.log_root)
            if not targets:
                log.warning(f"No model folders found in {args.log_root}. Is OMTP running?")
            for t in targets:
                key = f"{t['model']}:{t['line_id']}"
                if key not in sent_keys:
                    sent_keys[key] = -1
                pushed, sent_keys[key] = push_rows(api_url, api_key, t["csv_path"], col, sent_keys[key], t["line_id"], t["model"])
                if pushed:
                    log.info(f"Line {t['line_id']} | {t['model']} — pushed {pushed} new rows")

            # Retry IP identification every loop (maybe it gets registered later)
            identity = identify_by_ip(api_url, api_key, local_ip)

        time.sleep(args.interval)


if __name__ == "__main__":
    main()
