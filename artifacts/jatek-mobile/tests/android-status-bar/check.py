#!/usr/bin/env python3
"""ADB-only native status-bar regression gate. No third-party Python packages."""
import argparse
import datetime
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
import zlib


def raw_image(raw):
    if len(raw) < 12:
        raise ValueError("Truncated screencap header")
    width, height, fmt = struct.unpack_from("<III", raw)
    offset = len(raw) - width * height * 4
    if not width or not height or fmt != 1 or offset not in (12, 16):
        raise ValueError("Unsupported screencap format; expected RGBA_8888")
    return width, height, offset


def raw_to_png(raw):
    """Archive the exact frame measured, not a second screenshot."""
    width, height, offset = raw_image(raw)
    def chunk(kind, data):
        return (struct.pack(">I", len(data)) + kind + data
                + struct.pack(">I", zlib.crc32(kind + data)))
    rows = b"".join(b"\0" + raw[offset + y * width * 4:offset + (y + 1) * width * 4]
                    for y in range(height))
    return (b"\x89PNG\r\n\x1a\n"
            + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b""))


def screen_matches(xml, pattern):
    nodes = ET.fromstring(xml).iter("node")
    text = "\n".join(n.get("text", "") + " " + n.get("content-desc", "")
                     for n in nodes if n.get("package") == "ma.jatek.app")
    return bool(text and re.search(pattern, text))


def inspect_pixels(raw, profile):
    width, height, offset = raw_image(raw)
    if [width, height] != profile["size"]:
        raise ValueError("Resolution/orientation differs from approved device profile")
    top = profile["statusHeight"]
    if type(top) is not int or not 0 < top < height // 5:
        raise ValueError("Invalid measured statusHeight")
    masks = profile.get("masks", [])
    for x1, y1, x2, y2 in masks:
        if not all(type(v) is int for v in (x1, y1, x2, y2)):
            raise ValueError("Mask coordinates must be integer pixels")
        if not (0 <= x1 < x2 <= width and 0 <= y1 < y2 < top):
            raise ValueError("Mask outside status bar")
    checked = bad = 0
    for y in range(top):
        for x in range(width):
            if any(a <= x < c and b <= y < d for a, b, c, d in masks):
                continue
            checked += 1
            pos = offset + (y * width + x) * 4
            if min(raw[pos:pos + 3]) < 245:
                bad += 1
    if checked < width * top * .5:
        raise ValueError("Masks hide more than half the status bar")
    return {"checkedPixels": checked, "nonWhitePixels": bad,
            "nonWhiteRatio": bad / checked, "passed": bad / checked <= .005}


def run(args):
    config = json.loads(Path(args.config).read_text())
    out = Path(args.output)
    out.mkdir(parents=True, exist_ok=False)  # Never overwrite evidence.
    report = {"startedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
              "status": "ERROR", "config": config, "steps": []}
    (out / "config.json").write_text(json.dumps(config, indent=2))

    def adb(*command, binary=False):
        result = subprocess.run(["adb", "-s", args.serial, *command],
                                capture_output=True, timeout=45, check=True)
        return result.stdout if binary else result.stdout.decode().strip()

    def prop(name):
        return adb("shell", "getprop", name)

    package = "ma.jatek.app"
    def open_route(route, cold=False):
        if cold:
            adb("shell", "am", "force-stop", package)
        launch = adb("shell", "am", "start", "-W", "-a", "android.intent.action.VIEW",
                     "-d", "jatek://" + route, package)
        if re.search(r"Error:|Exception|Status:\s*(?!ok\b)\S+", launch):
            raise ValueError(f"Android launch failed: {launch}")

    def capture(name, screen):
        # Wait for actual route content, not merely for the splash to disappear.
        expected = re.compile(config["screens"][screen]["expectedText"])
        deadline = time.monotonic() + 35
        matched = False
        while time.monotonic() < deadline:
            adb("shell", "rm", "-f", "/sdcard/jatek-status.xml")
            adb("shell", "uiautomator", "dump", "/sdcard/jatek-status.xml")
            xml = adb("shell", "cat", "/sdcard/jatek-status.xml")
            (out / f"{name}.xml").write_text(xml)
            matched = screen_matches(xml, expected)
            if matched:
                break
            time.sleep(1)
        time.sleep(1)  # Let navigation animation finish.
        raw = adb("exec-out", "screencap", binary=True)
        (out / f"{name}.rgba").write_bytes(raw)
        (out / f"{name}.png").write_bytes(raw_to_png(raw))
        measurement = inspect_pixels(raw, config["deviceProfile"])
        measurement.update({"name": name, "screen": screen, "screenMatched": matched})
        measurement["passed"] &= matched
        report["steps"].append(measurement)

    try:
        mode = config["delivery"]["mode"]
        if mode not in ("ota", "native"):
            raise ValueError("delivery.mode must be ota or native")
        for field in ("runtimeVersion", "updateId", "channel", "sourceCommit", "evidence"):
            if not config["delivery"].get(field):
                raise ValueError(f"Missing delivery.{field}")
        if not config["deviceProfile"].get("approvedBy"):
            raise ValueError("Device profile must be visually approved")
        for screen in ("home", "commerce", "secondary"):
            entry = config["screens"][screen]
            if not entry["expectedText"].strip() or "REPLACE_" in entry["expectedText"]:
                raise ValueError("Each route requires a distinctive expectedText")
            re.compile(entry["expectedText"])
            if not re.fullmatch(r"/[A-Za-z0-9_()/.-]*", entry["route"]) or "REPLACE_" in entry["route"]:
                raise ValueError("Each screen requires a valid, configured internal route")
        api = int(prop("ro.build.version.sdk"))
        if api < 34:
            raise ValueError("Android 14/API 34 or newer required")
        report["device"] = {"serial": args.serial, "api": api,
                            "release": prop("ro.build.version.release"),
                            "model": prop("ro.product.model"),
                            "fingerprint": prop("ro.build.fingerprint"),
                            "navigationMode": adb("shell", "settings", "get", "secure", "navigation_mode")}
        (out / "package.txt").write_text(adb("shell", "dumpsys", "package", package))
        (out / "window.txt").write_text(adb("shell", "dumpsys", "window"))
        apks = adb("shell", "pm", "path", package).splitlines()
        if not apks:
            raise ValueError("Jatek is not installed")
        report["apkSha256"] = {}
        for i, apk in enumerate(apks):
            local = out / f"installed-{i}.apk"
            adb("pull", apk.removeprefix("package:"), str(local))
            report["apkSha256"][Path(apk).name] = hashlib.sha256(local.read_bytes()).hexdigest()
            local.unlink()  # Keep identity, not a copy of the installed binary.
        if mode == "ota":
            before = json.loads(Path(config["delivery"]["beforeReport"]).read_text())
            (out / "before-ota-result.json").write_text(json.dumps(before, indent=2))
            if before["status"] != "PASS":
                raise ValueError("OTA baseline must have passed")
            if before["device"] != report["device"]:
                raise ValueError("OTA baseline must use the same device/system/navigation")
            if before["config"]["deviceProfile"] != config["deviceProfile"]:
                raise ValueError("OTA baseline must use the same approved pixel profile")
            if before["apkSha256"] != report["apkSha256"]:
                raise ValueError("OTA check changed the native binary")
            if before["config"]["delivery"]["updateId"] == config["delivery"]["updateId"]:
                raise ValueError("OTA check requires a different loaded updateId")
            if before["config"]["delivery"]["runtimeVersion"] != config["delivery"]["runtimeVersion"]:
                raise ValueError("OTA runtime differs from baseline")
        home = config["screens"]["home"]["route"]
        open_route(home, cold=True)
        capture("01-home-cold", "home")
        for index, screen in enumerate(("commerce", "secondary"), start=2):
            index = f"{index:02d}"
            route = config["screens"][screen]["route"]
            open_route(route)
            capture(f"{index}-navigate-{screen}", screen)
            adb("shell", "input", "keyevent", "4")
            capture(f"{index}-back-home", "home")
            open_route(route, cold=True)
            capture(f"{index}-cold-{screen}", screen)
            open_route(home, cold=True)
            capture(f"{index}-restart-home", "home")
        report["status"] = "PASS" if all(s["passed"] for s in report["steps"]) else "FAIL"
    except Exception as exc:
        report["error"] = str(exc)
    finally:
        (out / "result.json").write_text(json.dumps(report, indent=2))
    print(f'{report["status"]}: {out / "result.json"}')
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--serial", required=True)
    parser.add_argument("--config", required=True)
    parser.add_argument("--output", required=True)
    sys.exit(run(parser.parse_args()))