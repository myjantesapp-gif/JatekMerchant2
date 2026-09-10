"""Mocked transport tests, NOT Android device evidence."""
import argparse
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from check import run, raw_to_png
from matrix import EXPECTED_STEPS


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = {
            "delivery": {"mode": "native", "runtimeVersion": "1", "updateId": "embedded",
                         "channel": "qa", "sourceCommit": "test", "evidence": "test"},
            "deviceProfile": {"size": [100, 200], "statusHeight": 20,
                              "masks": [], "approvedBy": "test"},
            "screens": {screen: {"route": route, "expectedText": screen}
                        for screen, route in [("home", "/"), ("commerce", "/restaurant/1"),
                                              ("secondary", "/cart")]},
        }
        self.raw = struct.pack("<IIII", 100, 200, 1, 0) + bytes([255] * 80000)
        self.calls = []
        self.frame = 0
        self.launch_error = False
        self.missing_adb = False

    def transport(self, command, **kwargs):
        self.calls.append(command[3:])
        cmd = command[3:]
        if self.missing_adb:
            raise FileNotFoundError("adb unavailable")
        output = b""
        if cmd[:2] == ["shell", "getprop"]:
            output = b"34" if cmd[-1] == "ro.build.version.sdk" else b"test-device"
        elif cmd[:3] == ["shell", "pm", "path"]:
            output = b"package:/data/app/base.apk"
        elif cmd[0] == "pull":
            Path(cmd[-1]).write_bytes(b"test-apk")
        elif cmd[:3] == ["shell", "am", "start"]:
            output = b"Error: Activity not started" if self.launch_error else b"Status: ok"
        elif cmd[:2] == ["shell", "cat"]:
            screen = EXPECTED_STEPS[self.frame][1]
            output = f'<hierarchy><node package="ma.jatek.app" text="{screen}"/></hierarchy>'.encode()
            self.frame += 1
        elif cmd == ["exec-out", "screencap"]:
            output = self.raw
        return subprocess.CompletedProcess(command, 0, output, b"")

    def execute(self, name):
        config_file = self.root / f"{name}.json"
        config_file.write_text(json.dumps(self.config))
        self.frame = 0
        with patch("check.subprocess.run", side_effect=self.transport), patch("check.time.sleep"):
            result = run(argparse.Namespace(config=str(config_file), serial="test",
                                            output=str(self.root / name)))
        return result, json.loads((self.root / name / "result.json").read_text())

    def test_native_runner_records_all_navigation_and_cold_starts(self):
        code, report = self.execute("native")
        self.assertEqual(code, 0)
        self.assertEqual([(s["name"], s["screen"]) for s in report["steps"]], list(EXPECTED_STEPS))
        self.assertEqual(self.calls.count(["shell", "input", "keyevent", "4"]), 2)
        self.assertEqual(self.calls.count(["shell", "am", "force-stop", "ma.jatek.app"]), 5)
        for name, _ in EXPECTED_STEPS:
            self.assertEqual((self.root / "native" / f"{name}.png").read_bytes(), raw_to_png(self.raw))

    def test_ota_preserves_binary_and_copies_baseline(self):
        self.execute("native")
        self.config["delivery"].update(mode="ota", updateId="update-2",
                                        beforeReport=str(self.root / "native/result.json"))
        code, report = self.execute("ota")
        self.assertEqual(code, 0)
        self.assertEqual(report["status"], "PASS")
        self.assertTrue((self.root / "ota/before-ota-result.json").is_file())

    def test_unchanged_ota_is_error(self):
        self.execute("native")
        self.config["delivery"].update(mode="ota", beforeReport=str(self.root / "native/result.json"))
        code, report = self.execute("ota")
        self.assertEqual(code, 1)
        self.assertIn("different loaded updateId", report["error"])

    def test_missing_adb_retains_error_report(self):
        self.missing_adb = True
        code, report = self.execute("missing-adb")
        self.assertEqual(code, 1)
        self.assertEqual(report["status"], "ERROR")

    def test_am_error_is_not_ignored_when_exit_code_is_zero(self):
        self.launch_error = True
        code, report = self.execute("bad-launch")
        self.assertEqual(code, 1)
        self.assertIn("Android launch failed", report["error"])

    def test_placeholder_configuration_fails_before_device_access(self):
        self.config["screens"]["commerce"]["route"] = "/restaurant/REPLACE_WITH_ID"
        code, _ = self.execute("placeholder")
        self.assertEqual(code, 1)
        self.assertEqual(self.calls, [])