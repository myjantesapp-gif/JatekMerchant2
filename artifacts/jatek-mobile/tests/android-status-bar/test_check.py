import struct
import unittest
import json
from pathlib import Path
import re
from check import inspect_pixels
from matrix import validate


class PixelGateTests(unittest.TestCase):
    def setUp(self):
        self.profile = {"size": [100, 200], "statusHeight": 20, "masks": []}
        self.pixels = bytearray([255] * (100 * 200 * 4))

    def raw(self, colorspace=True):
        return struct.pack("<III", 100, 200, 1) + (struct.pack("<I", 0) if colorspace else b"") + self.pixels

    def test_white_bar_passes_both_android_headers(self):
        for modern in (True, False):
            self.assertTrue(inspect_pixels(self.raw(modern), self.profile)["passed"])

    def test_colored_content_under_bar_fails(self):
        self.pixels[:400] = bytes([252, 178, 211, 255] * 100)
        self.assertFalse(inspect_pixels(self.raw(), self.profile)["passed"])

    def test_dark_bar_fails(self):
        self.pixels[:8000] = bytes([0, 0, 0, 255] * 2000)
        self.assertFalse(inspect_pixels(self.raw(), self.profile)["passed"])

    def test_system_icons_can_be_explicitly_masked(self):
        self.pixels[:40] = bytes([0, 0, 0, 255] * 10)
        self.profile["masks"] = [[0, 0, 10, 1]]
        self.assertTrue(inspect_pixels(self.raw(), self.profile)["passed"])

    def test_excessive_masks_rejected(self):
        self.profile["masks"] = [[0, 0, 100, 15]]
        with self.assertRaises(ValueError):
            inspect_pixels(self.raw(), self.profile)

    def test_resolution_change_rejected(self):
        self.profile["size"] = [200, 100]
        with self.assertRaises(ValueError):
            inspect_pixels(self.raw(), self.profile)

    def test_unsupported_pixel_format_rejected(self):
        with self.assertRaises(ValueError):
            inspect_pixels(struct.pack("<III", 100, 200, 4) + self.pixels, self.profile)

    def test_missing_matrix_does_not_pass(self):
        with self.assertRaisesRegex(ValueError, "Missing matrix cells"):
            validate([])

    def test_example_cart_matcher_uses_actual_french_title(self):
        directory = Path(__file__).parent
        config = json.loads((directory / "config.example.json").read_text())
        translations = (directory.parent.parent / "lib/translations.ts").read_text()
        title = re.search(r'cart_title: "([^"]+)"', translations).group(1)
        self.assertRegex(title + " ", config["screens"]["secondary"]["expectedText"])
        self.assertIsNone(re.search(config["screens"]["secondary"]["expectedText"], "Mon panier"))


if __name__ == "__main__":
    unittest.main()