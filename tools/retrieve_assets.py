"""Prepare a private asset cache from the user's installed game (Python 3.12)."""
import argparse
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parents[1]


def steam_libraries(roots):
    """Read Steam's library list, including libraries on other drives."""
    found = []
    for root in roots:
        root = Path(root)
        if root not in found:
            found.append(root)
        vdf = root / 'steamapps/libraryfolders.vdf'
        if vdf.is_file():
            for value in re.findall(r'"path"\s+"([^"\r\n]+)"', vdf.read_text(encoding='utf-8')):
                library = Path(value.replace('\\\\', '\\'))
                if library not in found:
                    found.append(library)
    return found


def valid_game(folder):
    data = Path(folder) / 'Card Shop Simulator_Data'
    return (data / 'sharedassets1.assets').is_file() and (data / 'Managed/Assembly-CSharp.dll').is_file()


def discover_game():
    roots = []
    if os.name == 'nt':
        import winreg
        try:
            with winreg.OpenKey(winreg.HKEY_CURRENT_USER, r'Software\Valve\Steam') as key:
                roots.append(winreg.QueryValueEx(key, 'SteamPath')[0])
        except OSError:
            pass
    roots.append(Path(os.environ.get('ProgramFiles(x86)', r'C:\Program Files (x86)')) / 'Steam')
    for library in steam_libraries(roots):
        game = library / 'steamapps/common/TCG Card Shop Simulator'
        if valid_game(game):
            return game
    return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--game', type=Path, help='Game installation folder; otherwise detect Steam libraries')
    parser.add_argument('--detect-only', action='store_true', help='Print installation path without changing anything')
    parser.add_argument('--output', type=Path, default=ROOT, help='Writable local cache root')
    args = parser.parse_args()
    game = args.game or (Path(os.environ['TCG_GAME_DIR']) if os.environ.get('TCG_GAME_DIR') else discover_game())
    if not game and not args.detect_only:
        entered = input('Game installation folder (containing Card Shop Simulator_Data): ').strip().strip('"')
        game = Path(entered) if entered else None
    if not game or not valid_game(game):
        raise SystemExit('Game assets were not found. Pass --game with your installation folder, or set TCG_GAME_DIR.')
    game = game.resolve()
    if args.detect_only:
        print(game)
        return
    # Extraction finishes in staging before any working cache files are replaced.
    # No save, draft, cover or history files are copied, overwritten or collected.
    output = args.output.resolve()
    cache = output / 'data'
    cache.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='asset-staging-', dir=cache) as staging:
        stage = Path(staging)
        subprocess.run([sys.executable, str(ROOT / 'tools/extract_catalog.py'), '--game', str(game), '--output', str(stage)], check=True)
        catalog = json.loads((stage / 'data/catalog.json').read_text(encoding='utf-8'))
        render = json.loads((stage / 'public/assets/render-data.json').read_text(encoding='utf-8'))
        if not catalog.get('cards') or not render.get('styles'):
            raise RuntimeError('Extracted cache is incomplete. Existing cache was not changed.')
        target = output / 'public/assets'
        target.mkdir(parents=True, exist_ok=True)
        for source in (stage / 'public/assets').iterdir():
            if source.is_file():
                temp = target / (source.name + '.tmp')
                shutil.copyfile(source, temp)
                os.replace(temp, target / source.name)
        os.replace(stage / 'data/catalog.json', cache / 'catalog.json')
    print(f'Retrieved {len(catalog["cards"]):,} variants from {game}.')
    print('Local cache ready. If Card Vault is already running, restart its server to load the new catalog.')


if __name__ == '__main__':
    main()
