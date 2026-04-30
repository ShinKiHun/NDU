"""
NDU site — data builder.

Parses 6 pair × 5 size eoh.txt files into a single data.json that the static
site loads. Also enumerates available FES PNGs and GIFs so the gallery JS
knows what to display.

Run any time analysis output changes:
    python build_data.py
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

NDU_ROOT = Path("/DATA/user_scratch/khshin/NDU")

GAS_OUT = NDU_ROOT / "metadyn" / "uma_1p2_omat" / "analysis" / "output"
SUP_OUT = NDU_ROOT / "metadyn_sup" / "uma_1p2_omat" / "analysis" / "output"
GIF_DIR = NDU_ROOT  # GIFs are at NDU root

OUT_DIR = Path(__file__).resolve().parent
OUT     = OUT_DIR / "data.json"
ASSETS  = OUT_DIR / "assets"

PAIRS = ["PtPd", "AuCu", "RuIr", "CoNi", "CuPd", "FeNi"]
SIZES = [13, 38, 55, 75, 147]
SUPPORTS = ["graphene", "Al2O3"]
FES_VIEWS = ["fes_q4q6.png", "fes_q4co.png", "fes_q6co.png",
             "fes_3d_fes.png", "fes_3d_scatter.png", "fes_extracted.png"]


# ─── eoh.txt parser ────────────────────────────────────────────────────────
def parse_eoh(path: Path) -> dict:
    """Parse one pair's eoh.txt. Returns {bulk: {elem: e}, sizes: {n: {...}}}."""
    text = path.read_text()
    out: dict = {"bulk": {}, "sizes": {}}

    m = re.search(r"E_bulk\[(\w+)\]=(-?[\d.]+)\s+E_bulk\[(\w+)\]=(-?[\d.]+)", text)
    if m:
        out["bulk"][m.group(1)] = float(m.group(2))
        out["bulk"][m.group(3)] = float(m.group(4))

    # Each size block starts with `## size = N (E_mix ref: pure Y=+1.5136, pure X=+1.7519)`
    for block in re.split(r"^## size = ", text, flags=re.MULTILINE)[1:]:
        first_nl = block.find("\n")
        head = block[:first_nl]
        body = block[first_nl + 1:]
        m_n = re.match(r"(\d+)", head)
        if not m_n:
            continue
        n = int(m_n.group(1))
        m_pure = re.search(r"pure\s+(\w+)=([+-]?[\d.]+),\s*pure\s+(\w+)=([+-]?[\d.]+)", head)
        size_block: dict = {"n_atoms": n, "comps": []}
        if m_pure:
            size_block["pure"] = {
                m_pure.group(1): float(m_pure.group(2)),
                m_pure.group(3): float(m_pure.group(4)),
            }
        # Skip header line (`comp ... err`) and blank lines
        for line in body.splitlines():
            line = line.strip()
            if not line or line.startswith("comp") or line.startswith("#"):
                continue
            parts = line.split()
            if len(parts) < 7:
                continue
            try:
                size_block["comps"].append({
                    "comp":   parts[0],
                    "n1":     int(parts[1]),
                    "x":      float(parts[2]),
                    "E_avg":  float(parts[3]),
                    "E_form": float(parts[4]),
                    "E_mix":  float(parts[5]),
                    "err":    float(parts[6]),
                })
            except ValueError:
                continue
        out["sizes"][n] = size_block
    return out


def closest_to_half(comps: list[dict]) -> str | None:
    """Return comp string whose x is closest to 0.5 (1:1 composition)."""
    if not comps:
        return None
    best = min(comps, key=lambda c: abs(c["x"] - 0.5))
    return best["comp"]


# ─── FES PNG enumeration ───────────────────────────────────────────────────
def find_fes(track: str, support: str | None, pair: str, size: int, comp: str) -> list[str]:
    """Return list of FES PNG filenames present for this (track, pair, size, comp)."""
    if track == "gas":
        d = GAS_OUT / pair / str(size) / comp
    else:
        d = SUP_OUT / support / pair / str(size)  # sup has no comp dir (1:1 only)
    if not d.is_dir():
        return []
    return sorted([f.name for f in d.iterdir() if f.suffix == ".png"])


# ─── GIF enumeration ───────────────────────────────────────────────────────
GIF_META_RE = re.compile(r"^([a-z]+)(\d+)(?:_(\w+))?(?:_(uma|pet|sevennet|mace))?\.gif$", re.I)

def parse_gif_name(name: str) -> dict:
    """coni13_gas_uma.gif → {pair, size, substrate, constraint, mlip}.

    substrate ∈ {gas, graphene, Al2O3, unknown}
    constraint ∈ {fix, freetop}  — 'fix' = whole slab fixed (default),
                                   'freetop' = only the top layer relaxed.
    Legacy 'sup'-only filenames have ambiguous substrate → marked 'unknown'.
    """
    base = (name[:-4] if name.lower().endswith(".gif") else name).lower()
    bits = base.split("_")
    if not bits:
        return {"raw": name}
    pair_size = bits[0]
    m = re.match(r"([a-z]+)(\d+)$", pair_size)
    pair = pair_size
    size = None
    if m:
        pair_lc = m.group(1)
        size = int(m.group(2))
        if len(pair_lc) >= 4:
            pair = pair_lc[:2].title() + pair_lc[2:].title()
        else:
            pair = pair_lc.title()
    rest = bits[1:]

    sub_map  = {"gas": "gas", "graphene": "graphene", "al2o3": "Al2O3"}
    mlip_set = {"uma", "pet", "sevennet", "mace"}
    substrate  = None
    constraint = "fix"
    mlip = None
    for r in rest:
        rl = r.lower()
        if rl in sub_map:        substrate  = sub_map[rl]
        elif rl == "freetop":    constraint = "freetop"
        elif rl == "fix":        constraint = "fix"
        elif rl == "sup":        substrate  = substrate or "unknown"
        elif rl in mlip_set:     mlip       = rl
    if substrate is None:
        substrate = "gas"  # default for older filenames lacking a token
    return {
        "pair": pair, "size": size,
        "substrate": substrate, "constraint": constraint,
        "mlip": mlip,
    }


# ─── main ──────────────────────────────────────────────────────────────────
def main() -> None:
    eoh: dict = {}
    print("Parsing EOH ...")
    for pair in PAIRS:
        path = GAS_OUT / pair / "summaries" / "eoh.txt"
        if not path.exists():
            print(f"  [WARN] missing {path}")
            continue
        eoh[pair] = parse_eoh(path)
        sizes = sorted(eoh[pair]["sizes"].keys())
        n_comps = sum(len(eoh[pair]["sizes"][s]["comps"]) for s in sizes)
        print(f"  {pair:6s} sizes={sizes} comps={n_comps} bulk={eoh[pair]['bulk']}")

    # FES inventory — read what's actually staged under site/assets/fes/
    # Each track dir contains <PAIR>_<SIZE>[_<COMP>] subdirs with fes_*.png files
    print("\nFES inventory (from assets/fes/) ...")
    fes: dict = {"gas": {}, "graphene": {}, "Al2O3": {}}
    fes_root = ASSETS / "fes"
    for track in ["gas", "graphene", "Al2O3"]:
        track_dir = fes_root / track
        if not track_dir.is_dir():
            print(f"  [SKIP] {track_dir} not found")
            continue
        for sub in sorted(track_dir.iterdir()):
            if not sub.is_dir():
                continue
            # Names: gas → "PtPd_13_06Pt07Pd" / sup → "PtPd_13"
            parts = sub.name.split("_", 2)
            if len(parts) < 2:
                continue
            pair = parts[0]
            try:
                size = int(parts[1])
            except ValueError:
                continue
            comp = parts[2] if len(parts) >= 3 else None
            files = sorted([f.name for f in sub.iterdir() if f.suffix == ".png"])
            if not files:
                continue
            entry = {
                "files": files,
                "dir":   f"assets/fes/{track}/{sub.name}",
            }
            if comp:
                entry["comp"] = comp
            fes[track].setdefault(pair, {})[str(size)] = entry

    fes_total = sum(len(p) for tr in fes.values() for p in tr.values())
    print(f"  FES (pair,size) entries: {fes_total}")

    # GIF inventory — list assets/gif
    print("\nGIF inventory ...")
    gif_dir = ASSETS / "gif"
    gifs: list = []
    if gif_dir.is_dir():
        for f in sorted(gif_dir.glob("*.gif")):
            meta = parse_gif_name(f.name)
            meta["file"] = f.name
            gifs.append(meta)
            print(f"  {f.name} → {meta}")
    else:
        print(f"  [WARN] {gif_dir} does not exist yet — copy GIFs first")

    # Headline numbers
    n_systems = sum(len(eoh[p]["sizes"][s]["comps"])
                    for p in eoh for s in eoh[p]["sizes"])

    out = {
        "meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "pairs": [p for p in PAIRS if p in eoh],
            "sizes": SIZES,
            "supports": SUPPORTS,
            "n_systems_gas": n_systems,
            "n_pairs": len([p for p in PAIRS if p in eoh]),
            "fes_views": FES_VIEWS,
        },
        "eoh":  eoh,
        "fes":  fes,
        "gifs": gifs,
    }

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n✓ wrote {OUT}  ({OUT.stat().st_size/1024:.1f} KB)")


if __name__ == "__main__":
    main()
