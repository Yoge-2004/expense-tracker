#!/usr/bin/env python3
"""Reads the Hugging Face Space run log (SSE dump) and prints REDACTED summaries as annotations.
Temporary diagnostic; the repository is public, so nothing personal may be printed."""
import collections, json, re, subprocess, sys

RAW = sys.argv[1]
EMAIL = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
JWT = re.compile(r"eyJ[\w-]+\.[\w-]+\.[\w-]*")
BEARER = re.compile(r"(?i)bearer\s+\S+")
LONG = re.compile(r"\b[A-Za-z0-9_\-]{28,}\b")
IPV4 = re.compile(r"\b\d{1,3}(?:\.\d{1,3}){3}\b")
KEYVAL = re.compile(r"Key \([^)]*\)=\([^)]*\)")
URLQ = re.compile(r"(https?://[^\s?]+)\?[^\s]*")
HOST = re.compile(r"[\w.-]+\.(?:neon\.tech|hf\.space|huggingface\.co|netlify\.app)")
JDBC = re.compile(r"jdbc:[^\s,;]+")
UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b")

def clean(text, limit=230):
    text = EMAIL.sub("[email]", text)
    text = JWT.sub("[jwt]", text)
    text = BEARER.sub("Bearer [x]", text)
    text = KEYVAL.sub("Key [x]", text)
    text = URLQ.sub(r"\1?[q]", text)
    text = JDBC.sub("jdbc:[redacted]", text)
    text = HOST.sub("[host]", text)
    text = UUID.sub("[uuid]", text)
    text = IPV4.sub("[ip]", text)
    text = LONG.sub("[long]", text)
    return text.strip()[:limit]

def notice(title, body):
    body = body.strip() or "(nothing)"
    subprocess.run([sys.executable, "scripts/ci_notice.py", title], input=body[:3900], text=True)

lines, stamps = [], []
for raw in open(RAW, encoding="utf-8", errors="replace"):
    raw = raw.strip()
    if not raw.startswith("data:"):
        continue
    try:
        obj = json.loads(raw[5:].strip())
    except Exception:
        continue
    text = obj.get("data", "")
    if isinstance(text, str):
        for part in text.splitlines():
            lines.append(part)
            stamps.append(obj.get("timestamp", ""))

if not lines:
    notice("hf-logs overview", "No log lines received (token scope, space asleep, or endpoint changed).")
    sys.exit(0)

level = collections.Counter()
for l in lines:
    m = re.search(r"\b(ERROR|WARN|INFO|DEBUG)\b", l[:60])
    if m:
        level[m.group(1)] += 1

EXC = re.compile(r"((?:[A-Za-z_][\w$]*\.)+[A-Z][\w$]*(?:Exception|Error))(?::\s*(.*))?")
groups = collections.OrderedDict()
order = collections.Counter()
frames = {}
minute = collections.Counter()
i = 0
while i < len(lines):
    l = lines[i]
    m = EXC.search(l)
    if m and not l.lstrip().startswith("at "):
        cls = m.group(1).split(".")[-1]
        msg = re.sub(r"\d+", "N", clean(m.group(2) or "", 160))
        key = (cls, msg)
        order[key] += 1
        ts = stamps[i][:16]
        if ts:
            minute[ts] += 1
        if key not in frames:
            fr = []
            for j in range(i + 1, min(i + 60, len(lines))):
                s = lines[j].strip()
                if s.startswith("at com.example"):
                    fr.append(clean(s, 110))
                if len(fr) >= 4:
                    break
            frames[key] = fr
    i += 1

total_exc = sum(order.values())
span = f"{stamps[0][:19]} .. {stamps[-1][:19]}" if stamps[0] else "unknown"
over = [f"log lines: {len(lines)}   span: {span}",
        "levels: " + ", ".join(f"{k}={v}" for k, v in level.most_common()),
        f"exception mentions: {total_exc}   distinct: {len(order)}"]
if minute:
    over.append("busiest minutes (exceptions): " + ", ".join(f"{k}={v}" for k, v in minute.most_common(5)))
notice("hf-logs 1 overview", "\n".join(over))

top = order.most_common(14)
notice("hf-logs 2 distinct exceptions", "\n".join(f"{n:>5} x {c}: {m}" for (c, m), n in top))

pg = [(k, n) for k, n in order.items() if re.search(r"PSQL|SQL|Postgres|JDBC|Hibernate|DataAccess|Transaction|Connection", k[0] + k[1], re.I)]
pg.sort(key=lambda x: -x[1])
detail = []
for (c, m), n in pg[:5]:
    detail.append(f"{n} x {c}: {m}")
    for f in frames.get((c, m), []):
        detail.append("      " + f)
notice("hf-logs 3 database errors with app frames", "\n".join(detail))

pool_words = ("HikariPool", "Connection is not available", "request timed out", "too many connections", "remaining connection slots",
              "terminating connection", "SSL SYSCALL", "Connection reset", "idle-in-transaction", "pool is empty", "Failed to validate", "Broken pipe", "canceling statement")
pool = collections.Counter()
for l in lines:
    for w in pool_words:
        if w.lower() in l.lower():
            pool[w] += 1
notice("hf-logs 4 pool and connection signals", "\n".join(f"{n:>5} x {w}" for w, n in pool.most_common()) or "none seen")

sql = collections.Counter()
for l in lines:
    m = re.search(r"(?:ERROR|Detail|ERROR:)\s*[:]?\s*((?:operator|function|column|relation|syntax|could not|deadlock|canceling|duplicate|current transaction|value too long|invalid input)[^\n]{0,140})", l, re.I)
    if m:
        sql[re.sub(r"\d+", "N", clean(m.group(1), 150))] += 1
notice("hf-logs 5 postgres error messages", "\n".join(f"{n:>5} x {k}" for k, n in sql.most_common(12)) or "none matched")

req = collections.Counter()
for l in lines:
    m = re.search(r"\b(GET|POST|PUT|PATCH|DELETE)\s+(/api/[^\s?\"]+)", l)
    if m:
        req[m.group(1) + " " + re.sub(r"/\d+", "/{id}", m.group(2))] += 1
if req:
    notice("hf-logs 6 request lines seen", "\n".join(f"{n:>5} x {k}" for k, n in req.most_common(14)))

warn = collections.Counter()
for l in lines:
    m = re.search(r"\b(WARN|ERROR)\b", l[:80])
    if m:
        warn[m.group(1) + " " + re.sub(r"\d+", "N", clean(re.sub(r"^.*?\b(WARN|ERROR)\b\s*(?:\d+\s*---)?\s*", "", l), 200))] += 1
notice("hf-logs 7 warn and error lines", "\n".join(f"{n:>4} x {k}" for k, n in warn.most_common(14)) or "none")

tail = [clean(re.sub(r"^\d{4}-\d\d-\d\dT[\d:.]+(?:Z|[+-]\d\d:?\d\d)?\s*", "", l), 175) for l in lines if l.strip()]
notice("hf-logs 8 first startup lines", "\n".join(tail[:22]))
notice("hf-logs 9 latest lines", "\n".join(tail[-18:]))
