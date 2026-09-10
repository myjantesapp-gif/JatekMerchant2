"""Fail closed unless all four native/OTA Android matrix cells have evidence.

The runner already records the result of each check.  This module deliberately
does not trust those recorded booleans, though: the RGBA evidence and the UI
hierarchy are re-checked while assembling the release matrix.
"""
import json
import math
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET

from check import inspect_pixels, raw_to_png, screen_matches


EXPECTED_STEPS = (
    ("01-home-cold", "home"),
    ("02-navigate-commerce", "commerce"),
    ("02-back-home", "home"),
    ("02-cold-commerce", "commerce"),
    ("02-restart-home", "home"),
    ("03-navigate-secondary", "secondary"),
    ("03-back-home", "home"),
    ("03-cold-secondary", "secondary"),
    ("03-restart-home", "home"),
)
MATRIX_CELLS = {(api, delivery, navigation)
                for api in (34, 35) for delivery in ("native", "ota")
                for navigation in ("0", "2")}
DELIVERY_FIELDS = ("runtimeVersion", "updateId", "channel", "sourceCommit", "evidence")
PACKAGE = "ma.jatek.app"


def _read_json(path, description):
    try:
        return json.loads(path.read_text())
    except Exception as exc:
        raise ValueError(f"Invalid {description}: {path}: {exc}") from exc


def _required_delivery(config, result_path):
    delivery = config.get("delivery")
    if not isinstance(delivery, dict):
        raise ValueError(f"Missing delivery metadata: {result_path}")
    mode = delivery.get("mode")
    if mode not in ("native", "ota"):
        raise ValueError(f"Invalid delivery.mode: {result_path}")
    for field in DELIVERY_FIELDS:
        value = delivery.get(field)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Missing delivery.{field}: {result_path}")
    return delivery, mode


def _validate_screen_xml(xml_path, screen, config, result_path):
    screens = config.get("screens")
    if not isinstance(screens, dict) or not isinstance(screens.get(screen), dict):
        raise ValueError(f"Missing screen configuration for {screen}: {result_path}")
    expected_text = screens[screen].get("expectedText")
    if not isinstance(expected_text, str) or not expected_text.strip():
        raise ValueError(f"Missing expected text for {screen}: {result_path}")
    try:
        expected = re.compile(expected_text)
        root = ET.fromstring(xml_path.read_text())
    except Exception as exc:
        raise ValueError(f"Invalid UI evidence: {xml_path}: {exc}") from exc

    if not screen_matches(ET.tostring(root, encoding="unicode"), expected):
        raise ValueError(f"Screen evidence does not match {screen}: {xml_path}")


def _validate_step(result_path, step, expected_name, expected_screen, config):
    if not isinstance(step, dict):
        raise ValueError(f"Invalid step in {result_path}")
    if step.get("name") != expected_name or step.get("screen") != expected_screen:
        raise ValueError(
            f"Unexpected step mapping in {result_path}: "
            f"{step.get('name')} -> {step.get('screen')}"
        )
    if step.get("passed") is not True or step.get("screenMatched") is not True:
        raise ValueError(f"Failed step: {result_path}: {expected_name}")

    evidence_dir = result_path.parent
    evidence = {}
    for extension in ("png", "rgba", "xml"):
        evidence[extension] = evidence_dir / f"{expected_name}.{extension}"
        if not evidence[extension].is_file() or not evidence[extension].stat().st_size:
            raise ValueError(f"Missing evidence: {evidence[extension]}")

    _validate_screen_xml(evidence["xml"], expected_screen, config, result_path)
    if evidence["png"].read_bytes() != raw_to_png(evidence["rgba"].read_bytes()):
        raise ValueError(f"PNG does not represent the measured frame: {evidence['png']}")
    try:
        measured = inspect_pixels(
            evidence["rgba"].read_bytes(), config["deviceProfile"]
        )
    except Exception as exc:
        raise ValueError(f"Invalid RGBA evidence: {evidence['rgba']}: {exc}") from exc
    if measured["passed"] is not True:
        raise ValueError(f"RGBA measurement failed: {evidence['rgba']}")

    # A report must describe the bytes that it archives.  In particular, do
    # not accept a hand-edited `passed` or ratio while the capture is bad.
    if step.get("passed") is not measured["passed"]:
        raise ValueError(f"RGBA result disagrees with report: {evidence['rgba']}")
    for field in ("checkedPixels", "nonWhitePixels"):
        if step.get(field) != measured[field]:
            raise ValueError(f"RGBA {field} disagrees with report: {evidence['rgba']}")
    ratio = step.get("nonWhiteRatio")
    if not isinstance(ratio, (int, float)) or isinstance(ratio, bool):
        raise ValueError(f"Missing RGBA nonWhiteRatio: {evidence['rgba']}")
    if not math.isclose(ratio, measured["nonWhiteRatio"], rel_tol=1e-12, abs_tol=1e-12):
        raise ValueError(f"RGBA ratio disagrees with report: {evidence['rgba']}")


def _validate_ota_identity(result_path, report, config, delivery):
    if not isinstance(delivery.get("beforeReport"), str) or not delivery["beforeReport"].strip():
        raise ValueError(f"Missing delivery.beforeReport: {result_path}")
    copied_path = result_path.parent / "before-ota-result.json"
    if not copied_path.is_file() or not copied_path.stat().st_size:
        raise ValueError(f"Missing OTA baseline copy: {copied_path}")
    before = _read_json(copied_path, "copied OTA baseline")
    if not isinstance(before, dict) or before.get("status") != "PASS":
        raise ValueError(f"OTA baseline must have passed: {copied_path}")
    if before.get("device") != report.get("device"):
        raise ValueError("OTA baseline must use the same device/system/navigation")
    if before.get("apkSha256") != report.get("apkSha256"):
        raise ValueError("OTA check changed the native binary")
    if before.get("config", {}).get("deviceProfile") != config["deviceProfile"]:
        raise ValueError("OTA baseline must use the same approved pixel profile")

    before_config = before.get("config")
    before_delivery = before_config.get("delivery") if isinstance(before_config, dict) else None
    if not isinstance(before_delivery, dict):
        raise ValueError(f"OTA baseline is missing delivery metadata: {copied_path}")
    if before_delivery.get("updateId") == delivery["updateId"]:
        raise ValueError("OTA check requires a different loaded updateId")
    if before_delivery.get("runtimeVersion") != delivery["runtimeVersion"]:
        raise ValueError("OTA runtime differs from baseline")

    # check.py copies the parsed beforeReport into the output directory.  If
    # that source is still available, compare the complete JSON object so a
    # copied report cannot silently be substituted after the run.
    source_name = delivery.get("beforeReport")
    if source_name:
        candidates = [Path(source_name), result_path.parent / source_name]
        source_path = next(
            (candidate for candidate in candidates if candidate.is_file()), None
        )
        if source_path is not None:
            source = _read_json(source_path, "OTA baseline source")
            if source != before:
                raise ValueError("Copied OTA baseline differs from delivery.beforeReport")


def validate(paths):
    cells = set()
    for path in paths:
        path = Path(path)
        report = _read_json(path, "matrix result")
        if not isinstance(report, dict) or report.get("status") != "PASS":
            raise ValueError(f"Incomplete/failed run: {path}")
        steps = report.get("steps")
        if not isinstance(steps, list) or len(steps) != len(EXPECTED_STEPS):
            raise ValueError(f"Expected exactly 9 steps: {path}")
        config = report.get("config")
        if not isinstance(config, dict):
            raise ValueError(f"Missing config: {path}")
        delivery, mode = _required_delivery(config, path)
        profile = config.get("deviceProfile")
        if not isinstance(profile, dict):
            raise ValueError(f"Missing device profile: {path}")
        for step, (expected_name, expected_screen) in zip(steps, EXPECTED_STEPS):
            _validate_step(path, step, expected_name, expected_screen, config)
        device = report.get("device")
        if not isinstance(device, dict):
            raise ValueError(f"Missing device metadata: {path}")
        api = device.get("api")
        if isinstance(api, bool) or not isinstance(api, int) or api < 34:
            raise ValueError("Android API below 34")
        navigation = str(device.get("navigationMode", "")).strip()
        if navigation not in ("0", "2"):
            raise ValueError("Unknown navigation mode; expected 0 (three buttons) or 2 (gestures)")
        if not isinstance(report.get("apkSha256"), dict) or not report["apkSha256"]:
            raise ValueError(f"Missing APK identity metadata: {path}")
        if mode == "ota":
            _validate_ota_identity(path, report, config, delivery)
        cells.add((34 if api == 34 else 35, mode, navigation))
    missing = MATRIX_CELLS - cells
    if missing:
        raise ValueError(f"Missing matrix cells: {sorted(missing)}")


if __name__ == "__main__":
    try:
        validate(sys.argv[1:])
        print("PASS: Android 14 and 15+; native/OTA and gesture/three-button evidence present")
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        sys.exit(1)