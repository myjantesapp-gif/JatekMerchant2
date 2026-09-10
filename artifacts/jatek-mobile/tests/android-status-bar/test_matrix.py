import json
import struct
import tempfile
import unittest
from pathlib import Path

from check import inspect_pixels, raw_to_png
from matrix import EXPECTED_STEPS, validate


class MatrixValidationTests(unittest.TestCase):
    def setUp(self):
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.profile = {"size": [4, 100], "statusHeight": 10, "masks": []}
        self.config = {
            "delivery": {
                "mode": "native",
                "runtimeVersion": "1",
                "updateId": "embedded",
                "channel": "production",
                "sourceCommit": "abc123",
                "evidence": "build-manifest",
                "beforeReport": "",
            },
            "deviceProfile": self.profile,
            "screens": {
                "home": {"expectedText": "Home"},
                "commerce": {"expectedText": "Shop"},
                "secondary": {"expectedText": "Cart"},
            },
        }
        self.device = {
            "serial": "test-device",
            "api": 34,
            "release": "14",
            "model": "test",
            "fingerprint": "test/fingerprint",
            "navigationMode": "2",
        }

    def tearDown(self):
        self.tempdir.cleanup()

    def _raw(self, dark=False):
        pixels = bytearray([255] * (4 * 100 * 4))
        if dark:
            pixels[:4] = bytes([0, 0, 0, 255])
        return struct.pack("<III", 4, 100, 1) + pixels

    def _step(self, directory, name, screen, raw=None, xml_text=None):
        if raw is None:
            raw = self._raw()
        measurement = inspect_pixels(raw, self.profile)
        (directory / f"{name}.rgba").write_bytes(raw)
        (directory / f"{name}.png").write_bytes(raw_to_png(raw))
        if xml_text is None:
            title = self.config["screens"][screen]["expectedText"]
            xml_text = (
                '<hierarchy><node package="ma.jatek.app" '
                f'text="{title}" content-desc="" /></hierarchy>'
            )
        (directory / f"{name}.xml").write_text(xml_text)
        measurement.update({"name": name, "screen": screen, "screenMatched": True})
        return measurement

    def _report(self, api=34, mode="native", update_id=None, directory=None, navigation="2"):
        directory = directory or self.root / f"{api}-{mode}-{navigation}"
        directory.mkdir(parents=True, exist_ok=True)
        config = json.loads(json.dumps(self.config))
        config["delivery"]["mode"] = mode
        config["delivery"]["updateId"] = update_id or (
            "embedded" if mode == "native" else f"ota-{api}"
        )
        steps = [
            self._step(directory, name, screen)
            for name, screen in EXPECTED_STEPS
        ]
        report = {
            "status": "PASS",
            "config": config,
            "device": {**self.device, "api": api, "navigationMode": navigation},
            "apkSha256": {"base.apk": "a" * 64},
            "steps": steps,
        }
        result = directory / "result.json"
        result.write_text(json.dumps(report))
        return result, report

    def _complete_matrix(self):
        reports = []
        for api, navigation in ((34, "2"), (35, "2"), (34, "0"), (35, "0")):
            native_path, native = self._report(api=api, navigation=navigation)
            reports.append(native_path)
            ota_path, ota = self._report(api=api, mode="ota", navigation=navigation)
            ota["config"]["delivery"]["beforeReport"] = str(native_path)
            (ota_path.parent / "before-ota-result.json").write_text(
                json.dumps(native)
            )
            ota_path.write_text(json.dumps(ota))
            reports.append(ota_path)
        return reports

    def test_requires_exact_ordered_unique_runner_steps(self):
        reports = self._complete_matrix()
        data = json.loads(reports[0].read_text())
        data["steps"][1], data["steps"][2] = data["steps"][2], data["steps"][1]
        reports[0].write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "Unexpected step mapping"):
            validate(reports)

    def test_rechecks_rgba_instead_of_trusting_report_pass(self):
        reports = self._complete_matrix()
        data = json.loads(reports[0].read_text())
        bad = self._raw(dark=True)
        reports[0].parent.joinpath("01-home-cold.rgba").write_bytes(bad)
        reports[0].parent.joinpath("01-home-cold.png").write_bytes(raw_to_png(bad))
        with self.assertRaisesRegex(ValueError, "RGBA measurement failed"):
            validate(reports)
        # Keep the assertion focused on the captured bytes rather than a
        # changed report field: the report still claims the step passed.
        self.assertTrue(data["steps"][0]["passed"])

    def test_rechecks_ui_evidence_for_expected_screen(self):
        reports = self._complete_matrix()
        xml = (
            '<hierarchy><node package="ma.jatek.app" '
            'text="Home" content-desc="" /></hierarchy>'
        )
        reports[0].parent.joinpath("02-navigate-commerce.xml").write_text(xml)
        with self.assertRaisesRegex(ValueError, "Screen evidence"):
            validate(reports)

    def test_requires_ota_copy_and_matching_identity(self):
        reports = self._complete_matrix()
        ota = reports[1]
        ota.parent.joinpath("before-ota-result.json").unlink()
        with self.assertRaisesRegex(ValueError, "Missing OTA baseline copy"):
            validate(reports)

        self._complete_matrix()
        baseline = json.loads(ota.parent.joinpath("before-ota-result.json").read_text())
        baseline["apkSha256"]["base.apk"] = "b" * 64
        ota.parent.joinpath("before-ota-result.json").write_text(json.dumps(baseline))
        with self.assertRaisesRegex(ValueError, "native binary"):
            validate(reports)

    def test_requires_all_api_and_delivery_cells(self):
        reports = self._complete_matrix()
        validate(reports)
        with self.assertRaisesRegex(ValueError, "Missing matrix cells"):
            validate(reports[:3])

    def test_one_navigation_mode_is_not_a_complete_matrix(self):
        reports = self._complete_matrix()
        with self.assertRaisesRegex(ValueError, "Missing matrix cells"):
            validate(reports[:4])

    def test_unknown_navigation_mode_rejected(self):
        reports = self._complete_matrix()
        data = json.loads(reports[0].read_text())
        data["device"]["navigationMode"] = "null"
        reports[0].write_text(json.dumps(data))
        with self.assertRaisesRegex(ValueError, "Unknown navigation mode"):
            validate(reports)

    def test_rejects_unrelated_png(self):
        reports = self._complete_matrix()
        reports[0].parent.joinpath("01-home-cold.png").write_bytes(b"not a screenshot")
        with self.assertRaisesRegex(ValueError, "PNG does not represent"):
            validate(reports)

    def test_other_app_text_cannot_satisfy_matcher(self):
        reports = self._complete_matrix()
        reports[0].parent.joinpath("01-home-cold.xml").write_text(
            '<hierarchy><node package="ma.jatek.app" text="Error"/>'
            '<node package="other.app" text="Home"/></hierarchy>')
        with self.assertRaisesRegex(ValueError, "Screen evidence"):
            validate(reports)


if __name__ == "__main__":
    unittest.main()