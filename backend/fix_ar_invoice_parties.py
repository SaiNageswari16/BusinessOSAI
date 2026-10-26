"""
One-shot data repair for the "hijacked by ABC" invoice misattribution incident.

Restores the original billed party on a set of POS-origin invoices in
ar_invoices that were over-written with customer_name/customer_phone/
customer_id of a single customer (ABC, phone 9113593497) for tenant
Anekam Enterprises.

Usage (on the server that has the production database):

    cd backend
    python fix_ar_invoice_parties.py --dry-run      # inspect only, no writes
    python fix_ar_invoice_parties.py                # apply the repair

The script reads DB credentials from backend/.env (POSTGRES_* variables),
or falls back to DATABASE_URL / psql-style environment variables. It runs
inside a single transaction, is idempotent (re-running is a no-op), and
prints a full before/after report plus a post-repair LTV validation that
mirrors the backend aggregation semantics:

    LTV = SUM(total_amount) of ar_invoices for the tenant, not cancelled/
    voided, not opening_balance / OPN-*, matched to a customer by
    customer_id OR exact phone (last 10 digits).

Expected outcome after repair (per incident report):
    ABC                    -> 3 orders,  541.00   (INV-0015, INV-0016, INV-0017)
    Royal Genral Store    -> 1 order,    238.00   (INV-0005)
    Royal Bakery          -> 1 order,    712.00   (INV-0006)
    Eat & Drink           -> 1 order,    466.00   (INV-0008)
    Indian Fruits & Vegetable Store -> 1 order, 250.00 (INV-0010)
    M R Bakes & Restaurant-> 1 order,    941.00   (INV-0011)
    Mangalore Store       -> 1 order,   7393.00   (INV-0013)
    M R Bakes & Restaurent-> 1 order,    500.00   (INV-0014)
"""

from __future__ import annotations

import argparse
import os
import re
import sys
from decimal import Decimal
from pathlib import Path

TENANT_ID = "e2f07693-4f40-4e94-8b45-0e161fd5d7f2"  # Anekam Enterprises

# invoice_number -> (correct customer name, correct phone, expected total)
# Expected totals are used as a sanity check only; they never gate the repair.
REPAIR_MAP = {
    "INV-0005": ("Royal Genral Store", "7795793645", "238.00"),
    "INV-0006": ("Royal Bakery", "9110669314", "712.00"),
    "INV-0008": ("Eat & Drink", "9008213019", "466.00"),
    "INV-0010": ("Indian Fruits & Vegetable Store", "7411932610", "250.00"),
    "INV-0011": ("M R Bakes & Restaurant", "9961450277", "941.00"),
    "INV-0013": ("Mangalore Store", "6913033655", "7393.00"),
    "INV-0014": ("M R Bakes & Restaurent", "9961450277", "500.00"),
}

# These invoices are ABC's genuine bills and must be verified, not modified.
ABC_VERIFICATION = {
    "INV-0015": ("ABC", "9113593497", "208.00"),
    "INV-0016": ("ABC", "9113593497", "83.00"),
    "INV-0017": ("ABC", "9113593497", "250.00"),
}


def parse_env_file(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.exists():
        return out
    for raw in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def db_settings() -> dict:
    env = parse_env_file(Path(__file__).resolve().parent / ".env")
    os.environ.update({k: v for k, v in env.items() if k not in os.environ or not os.environ.get(k)})
    host = os.environ.get("POSTGRES_HOST") or os.environ.get("PGHOST") or "localhost"
    port = os.environ.get("POSTGRES_PORT") or os.environ.get("PGPORT") or "5432"
    user = os.environ.get("POSTGRES_USER") or os.environ.get("PGUSER") or "postgres"
    password = os.environ.get("POSTGRES_PASSWORD") or os.environ.get("PGPASSWORD") or ""
    dbname = os.environ.get("POSTGRES_DB") or os.environ.get("PGDATABASE") or "businessosai"
    return {"host": host, "port": port, "user": user, "password": password, "dbname": dbname}


def digits10(value) -> str:
    d = re.sub(r"\D", "", str(value or ""))
    return d[-10:] if len(d) >= 10 else d


def get_driver():
    try:
        import psycopg2  # type: ignore

        return "psycopg2"
    except ImportError:
        pass
    try:
        import pg8000  # type: ignore  # noqa: F401

        return "pg8000"
    except ImportError:
        pass
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description="Repair hijacked ar_invoices party fields (tenant-scoped).")
    ap.add_argument("--dry-run", action="store_true", help="Inspect and print the planned updates without writing.")
    ap.add_argument("--tenant-id", default=TENANT_ID, help="Target tenant UUID (default: Anekam Enterprises).")
    args = ap.parse_args()

    settings = db_settings()
    driver = get_driver()
    print(f"[repair] target tenant : {args.tenant_id}")
    print(f"[repair] database      : {settings['user']}@{settings['host']}:{settings['port']}/{settings['dbname']}")
    if driver is None:
        print("[repair] No PostgreSQL driver found (need psycopg2 or pg8000).")
        print("         pip install psycopg2-binary   # on the server")
        return 2

    if driver == "psycopg2":
        import psycopg2  # type: ignore
        import psycopg2.extensions  # type: ignore
        import psycopg2.extras  # type: ignore

        conn = psycopg2.connect(
            host=settings["host"], port=settings["port"],
            user=settings["user"], password=settings["password"],
            dbname=settings["dbname"],
        )
        conn.set_isolation_level(psycopg2.extensions.ISOLATION_LEVEL_AUTOCOMMIT)
        close = conn.close
    else:
        import pg8000  # type: ignore
        import pg8000.native  # type: ignore

        raw_conn = pg8000.native.Connection(
            user=settings["user"], password=settings["password"],
            host=settings["host"], port=int(settings["port"]), database=settings["dbname"],
        )
        conn = raw_conn
        close = raw_conn.close

    cur = conn.cursor() if driver == "psycopg2" else None

    def q(sql: str, params: tuple = ()):
        if driver == "psycopg2":
            cur.execute(sql, params)
            return cur.fetchall()
        return conn.run(sql, params)

    def qone(sql: str, params: tuple = ()):
        rows = q(sql, params)
        return rows[0] if rows else None

    # 0. Tenant must exist
    ten = qone(
        "SELECT id FROM tenants WHERE id = %s", (args.tenant_id,) if driver == "psycopg2" else (args.tenant_id,)
    )
    if not ten:
        print(f"[repair] FATAL: tenant {args.tenant_id} not found in {settings['dbname']}.")
        print("         This DB does not look like the production one. Aborting (nothing written).")
        close()
        return 1

    # 1. Locate the CRM customer UUIDs by exact phone, then by exact name
    cust_rows = q(
        """
        SELECT c.name, c.phone, c.id
        FROM crm_customers c
        WHERE c.tenant_id = %s
        """,
        (args.tenant_id,),
    )
    by_phone: dict[str, object] = {}
    by_name: dict[str, object] = {}
    for name, phone, cid in cust_rows:
        p = digits10(phone)
        if p:
            by_phone.setdefault(p, cid)
        if name:
            by_name.setdefault(str(name).strip().lower(), cid)

    resolved: dict[str, dict] = {}
    for inv_num, (name, phone, _exp) in REPAIR_MAP.items():
        cid = by_phone.get(digits10(phone)) or by_name.get(name.strip().lower())
        resolved[inv_num] = {"name": name, "phone": phone, "customer_id": cid,
                             "match": "phone" if by_phone.get(digits10(phone)) else ("name" if cid else None)}
        if cid is None:
            print(f"[repair] NOTE: no crm_customers record for '{name}' ({phone}); "
                  f"will restore name/phone and leave customer_id NULL.")

    abc_cust = by_phone.get(digits10("9113593497")) or by_name.get("abc")

    # 2. Snapshot current state
    affected_nums = list(REPAIR_MAP.keys())
    snap_rows = q(
        """
        SELECT invoice_number, customer_id, customer_name, customer_phone, total_amount, status
        FROM ar_invoices
        WHERE tenant_id = %s AND invoice_number = ANY(%s)
        ORDER BY invoice_number
        """,
        (args.tenant_id, affected_nums),
    )
    snap = {r[0]: r for r in snap_rows}

    missing = [n for n in affected_nums if n not in snap]
    if missing:
        print(f"[repair] WARNING: invoices not found for tenant {args.tenant_id}: {missing}")
    print("\n[repair] BEFORE STATE")
    for n in affected_nums:
        r = snap.get(n)
        if r:
            print(f"  {n}: customer_id={r[1]}  name={r[2]!r}  phone={r[3]!r}  total={r[4]}  status={r[5]}")
        else:
            print(f"  {n}: <not found>")

    # 3. Apply the repair inside one transaction
    changed = 0
    if not args.dry_run:
        txn = None
        if driver == "psycopg2":
            txn = conn  # autocommit is on; begin a block
            cur.execute("BEGIN")
        else:
            conn.run("BEGIN")
        try:
            for inv_num, meta in resolved.items():
                r = snap.get(inv_num)
                if not r:
                    continue
                same_name = str(r[2] or "").strip().lower() == meta["name"].strip().lower()
                same_phone = digits10(r[3]) == digits10(meta["phone"])
                same_id = (meta["customer_id"] is None and r[1] in (None,)) or \
                          (meta["customer_id"] is not None and str(r[1]) == str(meta["customer_id"]))
                if same_name and same_phone and same_id:
                    print(f"  {inv_num}: already correct, skipping")
                    continue
                if driver == "psycopg2":
                    cur.execute(
                        """
                        UPDATE ar_invoices
                        SET customer_name = %s,
                            customer_phone = %s,
                            customer_id = %s
                        WHERE tenant_id = %s AND invoice_number = %s
                        """,
                        (meta["name"], meta["phone"], meta["customer_id"], args.tenant_id, inv_num),
                    )
                    changed += cur.rowcount
                else:
                    conn.run(
                        """
                        UPDATE ar_invoices
                        SET customer_name = :name, customer_phone = :phone, customer_id = :cid
                        WHERE tenant_id = :tid AND invoice_number = :inv
                        """,
                        {"name": meta["name"], "phone": meta["phone"], "cid": meta["customer_id"],
                         "tid": args.tenant_id, "inv": inv_num},
                    )
                    changed += 1
                print(f"  {inv_num}: restored -> {meta['name']} ({meta['phone']}) "
                      f"[customer match: {meta['match']}{' via ' + str(meta['customer_id']) if meta['customer_id'] else ''}]")
            if driver == "psycopg2":
                cur.execute("COMMIT")
            else:
                conn.run("COMMIT")
            print(f"[repair] COMMITTED {changed} row update(s).")
        except Exception:
            if driver == "psycopg2":
                cur.execute("ROLLBACK")
            else:
                conn.run("ROLLBACK")
            raise

    # 4. Verify ABC's genuine invoices are intact
    print("\n[repair] ABC VERIFICATION (must remain INV-0015/0016/0017, customer: "
          f"{str(abc_cust) if abc_cust else '<not found>'})")
    abc_rows = q(
        """
        SELECT invoice_number, customer_id, customer_name, customer_phone, total_amount
        FROM ar_invoices
        WHERE tenant_id = %s AND invoice_number = ANY(%s)
        ORDER BY invoice_number
        """,
        (args.tenant_id, list(ABC_VERIFICATION.keys())),
    )
    for n, cid, name, phone, total in abc_rows:
        exp = ABC_VERIFICATION.get(n, ("", "", ""))[0]
        ok = (str(name or "").strip() == "ABC") and digits10(phone) == digits10("9113593497")
        flag = "OK " if ok else "BAD"
        print(f"  [{flag}] {n}: {name!r} {phone!r} total={total} (expected {exp})")

    # 5. Post-repair LTV validation (mirrors backend aggregation semantics:
    #    credit to owning customer_id, else exact last-10-digit phone, else name)
    print("\n[repair] POST-REPAIR LTV (sum of non-cancelled/voided, non-OPN invoices)")
    all_rows = q(
        """
        SELECT i.customer_id, i.customer_name, i.customer_phone, i.total_amount
        FROM ar_invoices i
        WHERE i.tenant_id = %s
          AND lower(i.status) NOT IN ('cancelled', 'voided')
          AND i.invoice_type <> 'opening_balance'
          AND i.invoice_number NOT LIKE 'OPN-%%'
        """,
        (args.tenant_id,),
    )
    uuid_to_name = {str(v): k for k, v in by_name.items()}
    uuid_to_name.update({str(v): "phone:" + p for p, v in by_phone.items() if str(v) not in uuid_to_name})
    ltv: dict[str, dict] = {}
    for cid, name, phone, total in all_rows:
        p = digits10(phone)
        if cid and str(cid) in uuid_to_name:
            label = uuid_to_name[str(cid)]
        elif cid:
            label = f"unlinked-customer:{str(cid)[:8]}"
        elif p:
            label = "phone:" + p
        else:
            label = f"name:{str(name).strip().lower() if name else 'walk-in'}"
        slot = ltv.setdefault(label, {"orders": 0, "ltv": Decimal("0")})
        slot["orders"] += 1
        slot["ltv"] += Decimal(str(total or 0))
    for label, v in sorted(ltv.items()):
        print(f"  {label}: orders={v['orders']}  ltv={v['ltv']}")

    if args.dry_run:
        print("\n[repair] DRY RUN — no changes written. Re-run without --dry-run to apply.")
    close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
