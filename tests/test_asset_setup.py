"""Portable setup tests using synthetic Steam libraries, never game files."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('retrieve_assets', Path(__file__).resolve().parents[1] / 'tools/retrieve_assets.py')
assets = importlib.util.module_from_spec(spec)
spec.loader.exec_module(assets)


class AssetSetupTests(unittest.TestCase):
    def test_secondary_steam_library_and_spaces(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / 'Steam'
            library = Path(tmp) / 'Other Steam Library'
            (root / 'steamapps').mkdir(parents=True)
            escaped = str(library).replace('\\', '\\\\')
            (root / 'steamapps/libraryfolders.vdf').write_text('"libraryfolders" { "1" { "path" "' + escaped + '" } }', encoding='utf-8')
            self.assertEqual(assets.steam_libraries([root, root]), [root, library])

    def test_requires_both_assets_and_game_assembly(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            data = root / 'Card Shop Simulator_Data'
            (data / 'Managed').mkdir(parents=True)
            (data / 'sharedassets1.assets').touch()
            self.assertFalse(assets.valid_game(root))
            (data / 'Managed/Assembly-CSharp.dll').touch()
            self.assertTrue(assets.valid_game(root))
            self.assertFalse(assets.valid_game(data))


if __name__ == '__main__':
    unittest.main()
