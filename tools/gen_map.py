#!/usr/bin/env python3
"""Generate the inline SVG world map for index.html ("Where I've Been").

Data:     Natural Earth 1:110m via world-atlas TopoJSON (cached next to this file).
Projection: Equal Earth (Savric et al. 2018) — same as d3.geoEqualEarth.
Output:   splices the SVG between <!-- MAP:BEGIN/END --> markers in index.html
          and writes a standalone tools/world.svg for diffing/preview.

Stdlib only. Visited a new country? Add its numeric ISO id to VISITED (and a
lon/lat to MARKERS if it has no polygon at 110m), then:  python3 tools/gen_map.py
"""
import argparse
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
TOOLS = Path(__file__).resolve().parent
ROOT = TOOLS.parent
CACHE = TOOLS / "countries-110m.json"
INDEX = ROOT / "index.html"
WIDTH = 960.0
DROP = {"010"}  # Antarctica: antimeridian-wrapped ring + dead space
VISITED = {  # insertion order = stagger order (--i); values = display names
    "156": "China",
    "392": "Japan",
    "702": "Singapore",
    "764": "Thailand",
    "360": "Indonesia",
    "840": "United States",
    "250": "France",
    "380": "Italy",
    "040": "Austria",
    "276": "Germany",
    "756": "Switzerland",
}
MARKERS = {"702": (103.8198, 1.3521)}  # visited ids with no 110m polygon -> lon/lat dot
RING_KEEP = {"250": -10.0}  # France: keep rings with centroid lon >= -10 (drops French Guiana)
CLUSTER_PX = 7.0  # merge city dots closer than this many px into one stop
CITIES = [  # (display name, lon, lat) — China entries are provinces at their capitals
    ("Beijing", 116.4074, 39.9042),
    ("Shanghai", 121.4737, 31.2304),
    ("Jiangsu", 118.7969, 32.0603),
    ("Zhejiang", 120.1551, 30.2741),
    ("Guangdong", 113.2644, 23.1291),
    ("Guangxi", 108.3733, 22.9182),
    ("Hong Kong", 114.1694, 22.3193),
    ("Macau", 113.5491, 22.1987),
    ("Taiwan", 121.5654, 25.0330),
    ("Sichuan", 104.0657, 30.5723),
    ("Chongqing", 106.5516, 29.5630),
    ("Guizhou", 106.6302, 26.6477),
    ("Yunnan", 102.8329, 24.8801),
    ("Tibet", 91.1141, 29.6469),
    ("Shaanxi", 108.9402, 34.3416),
    ("Qinghai", 101.7782, 36.6171),
    ("Ningxia", 106.2782, 38.4664),
    ("Bangkok", 100.5018, 13.7563),
    ("Chiang Mai", 98.9853, 18.7883),
    ("Bali", 115.1889, -8.4095),
    ("North Carolina", -78.6382, 35.7796),
    ("New York", -74.0060, 40.7128),
    ("Philadelphia", -75.1652, 39.9526),
    ("Washington, DC", -77.0369, 38.9072),
    ("Denver", -104.9903, 39.7392),
    ("Los Angeles", -118.2437, 34.0522),
    ("Honolulu", -157.8583, 21.3069),
    ("Paris", 2.3522, 48.8566),
    ("Berlin", 13.4050, 52.5200),
    ("Milan", 9.1900, 45.4642),
    ("Venice", 12.3155, 45.4408),
    ("Rome", 12.4964, 41.9028),
    ("Vatican City", 12.4534, 41.9029),
    ("Osaka", 135.5191, 34.6937),
    ("Kyoto", 135.7681, 35.0116),
    ("Nara", 135.8048, 34.7855),
    ("Uji", 135.7997, 34.8894),
    ("Tokyo", 139.6917, 35.6895),
    ("Kamakura", 139.5465, 35.2975),
]
A1, A2, A3, A4 = 1.340264, -0.081106, 0.000893, 0.003796
RAD = math.pi / 180.0
SQ3 = math.sqrt(3.0)

MARK_RE = re.compile(r"[ \t]*<!-- MAP:BEGIN -->.*?<!-- MAP:END -->", re.S)


def load_topo(refresh):
    if refresh or not CACHE.exists():
        print(f"downloading {URL} -> {CACHE}")
        with urllib.request.urlopen(URL) as r:
            CACHE.write_bytes(r.read())
    return json.loads(CACHE.read_text())


def decode_arcs(topo):
    tx, ty = topo["transform"]["translate"]
    sx, sy = topo["transform"]["scale"]
    arcs = []
    for arc in topo["arcs"]:
        x = y = 0
        pts = []
        for dx, dy in arc:
            x += dx
            y += dy
            pts.append((tx + sx * x, ty + sy * y))
        arcs.append(pts)
    return arcs


def ring_points(ring, arcs):
    """Resolve TopoJSON arc indices into a (lon, lat) vertex list."""
    out = []
    for idx in ring:
        a = arcs[idx] if idx >= 0 else list(reversed(arcs[~idx]))
        if out and out[-1] == a[0]:
            out.extend(a[1:])  # drop duplicated joint vertex
        else:
            out.extend(a)
    return out


def geometry_rings(g):
    if g.get("type") == "Polygon":
        return g["arcs"]
    if g.get("type") == "MultiPolygon":
        return [r for poly in g["arcs"] for r in poly]
    return []


def cut_antimeridian(pts, name, log):
    """Split a cyclic ring where consecutive longitudes jump >180deg.

    Without this, Russia/Fiji-style rings project to map-wide streaks. Pieces
    start and end on the +/-180 meridian; the closing chord deviates from the
    projected boundary curve by a sub-pixel amount at 960px. Returns a list of
    open pieces (no duplicate closing vertex).
    """
    if len(pts) > 1 and pts[0] == pts[-1]:
        pts = pts[:-1]
    n = len(pts)
    if n < 3:
        return [pts] if pts else []
    pieces = []
    cur = [pts[0]]
    cuts = 0
    for i in range(n):
        lon1, lat1 = pts[i]
        lon2, lat2 = pts[(i + 1) % n]
        d = lon2 - lon1
        if abs(d) <= 180.0:
            cur.append(pts[(i + 1) % n])
            continue
        if d > 180.0:
            d -= 360.0
        else:
            d += 360.0
        if d == 0.0:
            # +180 followed by -180 (same meridian, opposite sign) — keep the
            # previous side so the ring doesn't smear across the whole map
            cur.append((lon1, lat2))
            continue
        edge = 180.0 if d > 0 else -180.0
        t = (edge - lon1) / d
        latx = lat1 + t * (lat2 - lat1)
        cur.append((edge, latx))  # exit point E
        pieces.append(cur)
        cur = [(-edge, latx)]  # entry point S
        cuts += 1
    pieces.append(cur)
    if not cuts and len(cur) > 3 and cur[-1] == cur[0]:
        cur.pop()  # drop the closing duplicate; 'z' closes the ring
    if cuts:
        # The walk started mid-piece; the last piece is cyclically contiguous
        # with the first (both meet at pts[0]) — merge them so every piece
        # starts and ends on the meridian.
        pieces[0] = pieces[-1] + pieces[0][1:]
        pieces.pop()
        log.append(f"cut {name} at +/-180 ({cuts} cut{'s' if cuts > 1 else ''})")
    return pieces


def project(lon, lat):
    th = math.asin(SQ3 / 2.0 * math.sin(lat * RAD))
    m = 9 * A4 * th ** 8 + 7 * A3 * th ** 6 + 3 * A2 * th ** 2 + A1
    x = 2.0 * SQ3 * (lon * RAD) * math.cos(th) / (3.0 * m)
    y = -(A4 * th ** 9 + A3 * th ** 7 + A2 * th ** 3 + A1 * th)
    return x, y


def num(v, prec):
    s = f"{v:.{prec}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    if s in ("", "-", "-0"):
        s = "0"
    return s


def path_d(piece_px, prec):
    """One ring as 'M x y l dx dy dx dy ... z' (implicit lineto repeats)."""
    x0, y0 = piece_px[0]
    out = ["M" + num(x0, prec), " " + num(y0, prec) + "l"]
    px, py = x0, y0
    for x, y in piece_px[1:]:
        for s in (num(x - px, prec), num(y - py, prec)):
            if out[-1][-1:].isdigit() and (s[0].isdigit() or s[0] == "."):
                out.append(" ")
            out.append(s)
        px, py = x, y
    return "".join(out) + "z"


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--prec", type=int, choices=(0, 1), default=1, help="coordinate decimals (default 1)")
    ap.add_argument("--width", type=float, default=WIDTH, help="map width in px (default 960)")
    ap.add_argument("--refresh", action="store_true", help="re-download the TopoJSON cache")
    ap.add_argument("--stdout", action="store_true", help="print the SVG block instead of writing files")
    args = ap.parse_args()

    topo = load_topo(args.refresh)
    arcs = decode_arcs(topo)

    cut_log = []
    countries = []  # (gid, name, [pieces]) — pieces are (lon, lat) lists
    for g in topo["objects"]["countries"]["geometries"]:
        gid = str(g.get("id") or "").zfill(3)
        if gid in DROP:
            continue
        name = g.get("properties", {}).get("name", gid)
        pieces = []
        for ring in geometry_rings(g):
            pieces.extend(cut_antimeridian(ring_points(ring, arcs), name, cut_log))
        if gid in RING_KEEP:
            lo = RING_KEEP[gid]
            pieces = [p for p in pieces if sum(pt[0] for pt in p) / len(p) >= lo]
        if pieces:
            countries.append((gid, name, pieces))

    seen = {gid for gid, _, _ in countries}
    for gid in VISITED:
        if gid not in seen and gid not in MARKERS:
            sys.exit(f"error: visited id {gid} has no geometry and no MARKERS entry — add lon/lat to MARKERS")

    total_cuts = sum(int(l.split("(")[1].split(" ")[0]) for l in cut_log)
    for l in cut_log:
        print(l)
    assert total_cuts <= 8, f"unexpected cut count: {total_cuts}"

    # Pass 1: global projected bounds -> scale to width.
    xmin = ymin = math.inf
    xmax = ymax = -math.inf
    for _, _, pieces in countries:
        for piece in pieces:
            for lon, lat in piece:
                x, y = project(lon, lat)
                xmin, xmax = min(xmin, x), max(xmax, x)
                ymin, ymax = min(ymin, y), max(ymax, y)
    k = args.width / (xmax - xmin)
    height = round((ymax - ymin) * k)

    # Pass 2: pixels, per-ring filtering + vertex decimation.
    def to_px(piece):
        return [(round((x - xmin) * k, 3), round((y - ymin) * k, 3)) for x, y in (project(lo, la) for lo, la in piece)]

    def shrink(piece):
        xs = [p[0] for p in piece]
        ys = [p[1] for p in piece]
        if max(xs) - min(xs) < 0.75 and max(ys) - min(ys) < 0.75:
            return []
        out = [piece[0]]
        for p in piece[1:-1]:
            lx, ly = out[-1]
            if abs(p[0] - lx) >= 0.35 or abs(p[1] - ly) >= 0.35:
                out.append(p)
        out.append(piece[-1])
        return out if len(out) >= 3 else []

    stats = {"rings": 0, "dropped": 0, "pts": 0}
    paths = {}  # gid -> d string
    for gid, name, pieces in countries:
        ds = []
        for piece in pieces:
            px = shrink(to_px(piece))
            if not px:
                stats["dropped"] += 1
                continue
            ds.append(path_d(px, args.prec))
            stats["rings"] += 1
            stats["pts"] += len(px)
        if ds:
            paths[gid] = "".join(ds)

    names = {gid: name for gid, name, _ in countries}
    lines = []
    for gid in sorted((g for g in paths if g not in VISITED), key=lambda g: names[g]):
        lines.append(f'          <path class="m-land" d="{paths[gid]}"/>')
    for i, (gid, disp) in enumerate(VISITED.items()):
        if gid in paths:
            lines.append(
                f'          <path class="m-visited" style="--i:{i}" data-name="{disp}" tabindex="0" d="{paths[gid]}">'
                f"<title>{disp}</title></path>"
            )
        else:
            lon, lat = MARKERS[gid]
            x, y = project(lon, lat)
            cx, cy = num((x - xmin) * k, args.prec), num((y - ymin) * k, args.prec)
            lines.append(
                f'          <circle class="m-visited m-dot" style="--i:{i}" data-name="{disp}" tabindex="0" '
                f'cx="{cx}" cy="{cy}" r="3.2"><title>{disp}</title></circle>'
            )

    # city / region dots at world resolution — nearby stops merge into one
    # dot whose tooltip lists every name (single-linkage on projected px)
    stops = []
    for name, lon, lat in CITIES:
        x, y = project(lon, lat)
        stops.append({"name": name, "x": (x - xmin) * k, "y": (y - ymin) * k, "taken": False})
    clusters = []
    for s in stops:
        if s["taken"]:
            continue
        s["taken"] = True
        grp = [s]
        grew = True
        while grew:
            grew = False
            for q in stops:
                if q["taken"]:
                    continue
                if any((q["x"] - g["x"]) ** 2 + (q["y"] - g["y"]) ** 2 <= CLUSTER_PX ** 2 for g in grp):
                    q["taken"] = True
                    grp.append(q)
                    grew = True
        clusters.append(grp)
    n_city = 0
    for gi, grp in enumerate(clusters):
        cx = sum(g["x"] for g in grp) / len(grp)
        cy = sum(g["y"] for g in grp) / len(grp)
        label = " · ".join(g["name"] for g in grp)
        r = min(2.2 + 0.35 * (len(grp) - 1), 4.0)
        i = min(11 + gi, 14)  # stagger continues after countries, capped
        lines.append(
            f'          <circle class="m-city" style="--i:{i}" data-name="{label}" tabindex="0" '
            f'cx="{num(cx, args.prec)}" cy="{num(cy, args.prec)}" r="{r:.1f}"><title>{label}</title></circle>'
        )
        n_city += 1

    visited_list = list(VISITED.values())
    aria = (
        f"World map highlighting the {len(visited_list)} countries I have visited: "
        + ", ".join(visited_list[:-1])
        + f", and {visited_list[-1]}."
    ).replace(", and United States.", ", and the United States.") + (
        " Ringed dots mark individual cities and regions." if CITIES else ""
    )
    inner = "\n".join(lines)
    svg = (
        f'<svg class="world-map" viewBox="0 0 {num(args.width, 0)} {height}" role="img" aria-label="{aria}">\n'
        f"{inner}\n"
        f"          </svg>"
    )

    if args.stdout:
        print(svg)
        return

    standalone = TOOLS / "world.svg"
    standalone.write_text(
        svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" ', 1).replace(
            ">\n",
            '><style>.m-land{fill:#d8d5d1;stroke:#bfbcb8;stroke-width:.5}.m-visited{fill:#2563eb}.m-dot{stroke:#fff}.m-city{fill:#fff;stroke:#2563eb;stroke-width:1.4}</style>\n',
            1,
        )
        + "\n",
    )

    block = f"<!-- MAP:BEGIN -->\n        {svg}\n        <!-- MAP:END -->"
    html = INDEX.read_text()
    if not MARK_RE.search(html):
        sys.exit(f"error: <!-- MAP:BEGIN/END --> markers not found in {INDEX}")
    new_html = MARK_RE.sub(lambda m: block, html, count=1)
    if new_html != html:
        INDEX.write_text(new_html)

    n = sum(1 for l in lines if "<path" in l)
    print(
        f"{n} country paths, {len(lines) - n - n_city} country markers, {n_city} city dots "
        f"({len(CITIES)} stops merged), {stats['rings']} rings kept, "
        f"{stats['dropped']} sub-pixel rings dropped, {stats['pts']} vertices, "
        f"{total_cuts} antimeridian cuts; svg {len(svg)} bytes; "
        f"index.html now {len(new_html)} bytes (viewBox 0 0 {num(args.width, 0)} {height})"
    )


if __name__ == "__main__":
    main()
