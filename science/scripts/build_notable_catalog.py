"""Add the notable south-polar named places to the site catalog from the IAU nomenclature file.

  python scripts/build_notable_catalog.py [path to MOON_nomenclature_center_pts.zip]

Source: IAU Gazetteer of Planetary Nomenclature, Moon, centre points, published by USGS Astrogeology
(file MOON_nomenclature_center_pts.zip; its metadata says "Public domain."). The zip stays in data/raw/iau
(git-ignored); what is committed is data/sites/iau_extract.json (the exact rows used, with the zip's SHA-256)
and the catalog entries derived from it. A test checks that catalog and extract agree.
"""

from __future__ import annotations

import hashlib
import json
import re
import struct
import sys
import zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
ZIP = REPO / "data" / "raw" / "iau" / "MOON_nomenclature_center_pts.zip"
EXTRACT = REPO / "data" / "sites" / "iau_extract.json"
CATALOG = REPO / "data" / "sites" / "catalog.json"

# (IAU feature name, group). Chosen by hand from named places in public NASA material; the IAU row supplies the numbers.
GROUPS = {
    "artemis_iii_regions": "Artemis III candidate-region features (NASA's October 2024 list of nine regions, nearest named feature)",
    "shadowed_craters": "Well-known south-polar craters (permanently shadowed floors, ice research)",
}
PICK = [("Haworth", "artemis_iii_regions"), ("Mons Malapert", "artemis_iii_regions"), ("Mons Mouton", "artemis_iii_regions"),
        ("Nobile", "artemis_iii_regions"), ("de Gerlache", "artemis_iii_regions"), ("Slater", "artemis_iii_regions"),
        ("Shackleton", "shadowed_craters"), ("Shoemaker", "shadowed_craters"), ("Faustini", "shadowed_craters"),
        ("Cabeus", "shadowed_craters"), ("Amundsen", "shadowed_craters"), ("Sverdrup", "shadowed_craters")]


def read_points(z: zipfile.ZipFile) -> list[dict]:
    dbf = z.read("MOON_nomenclature_center_pts.dbf")  # centre latitude and longitude are columns here
    nrec, hlen, rlen = struct.unpack("<IHH", dbf[4:12])
    fields, p = [], 32
    while dbf[p] != 0x0D:
        fields.append((dbf[p:p + 11].split(b"\0")[0].decode(), dbf[p + 16]))
        p += 32
    rows = []
    for i in range(nrec):
        r, off, d = dbf[hlen + i * rlen:hlen + (i + 1) * rlen], 1, {}
        for n, ln in fields:
            d[n] = r[off:off + ln].decode("latin-1").strip()
            off += ln
        rows.append(d)
    return rows


def slug(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main() -> int:
    zp = Path(sys.argv[1]) if len(sys.argv) > 1 else ZIP
    rows = read_points(zipfile.ZipFile(zp))
    extract = []
    for name, group in PICK:
        hits = [r for r in rows if r["name"] == name and float(r["center_lat"]) <= -80]
        if len(hits) != 1:
            raise SystemExit(f"{name!r}: expected exactly one south-polar IAU row, found {len(hits)}")
        r = hits[0]
        extract.append({"name": r["name"], "group": group, "iau_feature_id": int(r["link"].rsplit("/", 1)[1]),
                        "iau_url": r["link"].replace("http://", "https://"), "feature_type": r["type"],
                        "diameter_km": round(float(r["diameter"]), 1), "lat_deg": round(float(r["center_lat"]), 4),
                        "lon_east_deg": round(float(r["center_lon"]), 4), "approval": r["approval"],
                        "origin": r["origin"]})
    sha = hashlib.sha256(zp.read_bytes()).hexdigest()
    EXTRACT.write_text(json.dumps({"source": "IAU Gazetteer of Planetary Nomenclature, Moon, centre points (USGS Astrogeology)",
                                   "file": "MOON_nomenclature_center_pts.zip", "sha256": sha, "licence": "Public domain (per the file's metadata)",
                                   "groups": GROUPS, "features": extract}, indent=1) + "\n", encoding="utf-8")
    cat = json.loads(CATALOG.read_text(encoding="utf-8"))
    keep = [s for s in cat["sites"] if s["kind"] != "named_feature_iau"]
    for e in extract:
        keep.append({
            "site_id": "iau-" + slug(e["name"]), "label": f"{e['name']} ({'massif' if e['feature_type'].startswith('Mons') else 'crater'} centre)",
            "name": e["name"], "lat_deg": e["lat_deg"], "lon_east_deg": e["lon_east_deg"], "convention": "planetocentric",
            "source": f"IAU Gazetteer of Planetary Nomenclature, feature {e['iau_feature_id']}: centre point",
            "precision_m": 1000.0, "kind": "named_feature_iau", "group": e["group"], "iau_url": e["iau_url"],
            "feature_type": e["feature_type"], "diameter_km": e["diameter_km"]})
    cat["sites"] = keep
    cat["note"] = ("Three rule-chosen demonstration points (not candidate sites) and twelve named south-polar places. The named places "
                   "are the IAU's official centre points: a crater centre is its floor, not its rim, and NASA's Artemis III regions are "
                   "15 km areas on or near these features, so none of these is a landing recommendation. Real candidate sites "
                   "would need their own provenance (SDR-001 D-09).")
    cat["groups"] = GROUPS
    CATALOG.write_text(json.dumps(cat, indent=1) + "\n", encoding="utf-8")
    for e in extract:
        print(f"{e['name']:<14}{e['lat_deg']:>9}{e['lon_east_deg']:>10}  {e['diameter_km']:>6} km  feature {e['iau_feature_id']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
