"""Read existing Factorio data and copy catalog icons; never launch the game.

Run only when updating the game catalog. Exported assets are retained in this
prototype so previewing/building it needs no Factorio installation.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import struct

ROOT = Path(__file__).resolve().parent.parent
ANCESTORS = {
    'item': 'ItemPrototype', 'fluid': 'FluidPrototype', 'virtual': 'VirtualSignalPrototype',
    'entity': 'EntityPrototype', 'recipe': 'RecipePrototype', 'space-location': 'SpaceLocationPrototype',
    'asteroid-chunk': 'AsteroidChunkPrototype', 'quality': 'QualityPrototype',
}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--data-root', type=Path, required=True)
    parser.add_argument('--dump', type=Path, required=True)
    parser.add_argument('--api', type=Path, required=True)
    args = parser.parse_args()
    raw = json.loads(args.dump.read_text(encoding='utf-8'))
    api = json.loads(args.api.read_text(encoding='utf-8'))
    prototypes = {p['name']: p for p in api['prototypes']}

    def inherits(name, ancestor):
        while name:
            if name == ancestor:
                return True
            name = prototypes[name].get('parent')
        return False

    indexes = {}
    for signal_type, ancestor in ANCESTORS.items():
        indexes[signal_type] = {}
        for p in api['prototypes']:
            if 'typename' in p and inherits(p['name'], ancestor):
                indexes[signal_type].update(raw.get(p['typename'], {}))

    output = ROOT / 'public' / 'signals'
    output.mkdir(parents=True, exist_ok=True)
    copied = {}

    def icon_layers(prototype, signal_type):
        layers = prototype.get('icons') or ([{'icon': prototype['icon'], 'icon_size': prototype.get('icon_size', 64)}] if prototype.get('icon') else [])
        if not layers and signal_type == 'recipe':
            product = prototype.get('main_product')
            results = prototype.get('results', [])
            if not product and len(results) == 1:
                product = results[0].get('name')
            if product:
                for kind in ('item', 'fluid'):
                    if product in indexes[kind]:
                        return icon_layers(indexes[kind][product], kind)
        result = []
        for layer in layers:
            match = re.fullmatch(r'__([^/]+)__/(.+)', layer.get('icon', ''))
            if not match:
                continue
            source = args.data_root / match[1] / match[2]
            if not source.is_file():
                continue
            key = layer['icon']
            if key not in copied:
                filename = hashlib.sha256(key.encode()).hexdigest()[:16] + '.png'
                data = source.read_bytes()
                width, height = struct.unpack('>II', data[16:24])
                shutil.copyfile(source, output / filename)
                copied[key] = {'src': '/signals/' + filename, 'width': width, 'height': height}
            result.append({**copied[key], 'size': layer.get('icon_size', prototype.get('icon_size', 64)), 'scale': layer.get('scale'), 'shift': layer.get('shift', [0, 0])})
        return result

    groups = {}
    current = None
    catalog = (ROOT / 'source-python' / 'catalog.py').read_text(encoding='utf-8')
    for line in catalog.splitlines():
        group = re.match(r'class (\w+):', line)
        if group:
            current = groups.setdefault(group[1], [])
        member = re.match(r"    (\w+): Final\[Signal\] = Signal\('([^']+)', '([^']+)'\)", line)
        if not member:
            continue
        python_name, name, signal_type = member.groups()
        ts_name = re.sub(r'_([a-z0-9])', lambda m: m[1].upper(), python_name)
        current.append({'python': python_name, 'typescript': ts_name, 'name': name, 'type': signal_type,
                        'icons': icon_layers(indexes[signal_type].get(name, {}), signal_type)})
    (output / 'catalog.json').write_text(json.dumps(groups, separators=(',', ':')) + '\n', encoding='utf-8')
    members = [m for g in groups.values() for m in g]
    print(f'{len(copied)} icon assets; {sum(bool(m["icons"]) for m in members)}/{len(members)} signals have icons.')


if __name__ == '__main__':
    main()
