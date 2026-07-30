# Open Food Facts → IOTRONCS Retail Importer

Production-grade streaming importer for the [Open Food Facts](https://world.openfoodfacts.org/data)
dataset into the `erp_master_catalog` PostgreSQL table.

---

## Features

| Feature | Details |
|---|---|
| **Streaming** | pandas `chunksize=10000` — never loads the full 12 GB into RAM |
| **Parallel inserts** | `ThreadPoolExecutor` with configurable worker count |
| **Upsert** | PostgreSQL `ON CONFLICT DO UPDATE` — idempotent re-runs |
| **ETA / progress** | Rolling rows/sec + estimated time remaining |
| **Failed rows** | Bad rows → `failed_rows.csv`, import never stops |
| **Retry** | Each batch retries up to 3× with exponential back-off |
| **Zero hardcoding** | All credentials from `.env` |

---

## Quick Start

### 1 · Install dependencies (inside the backend virtualenv)

```bash
cd BusinessOSAI/backend
.\.venv\Scripts\activate          # Windows
pip install -r importer/requirements.txt
```

### 2 · Run the importer

```bash
cd BusinessOSAI/backend/importer

# Default (uses config.py defaults + .env credentials):
python main.py

# Specify a different file:
python main.py --file "D:\en.openfoodfacts.org.products (1).csv\en.openfoodfacts.org.products (1).csv"

# Validate only — no DB writes:
python main.py --dry-run

# Faster with more workers:
python main.py --workers 8 --batch 5000

# Skip (not update) existing barcodes:
python main.py --dup insert
```

---

## Folder Structure

```
importer/
├── main.py          ← CLI entry point  (argparse)
├── importer.py      ← Core streaming + thread-pool orchestration
├── mapper.py        ← TSV column → DB column mapping
├── validator.py     ← Per-row cleaning and validation
├── database.py      ← SQLAlchemy engine + pg_insert upsert
├── config.py        ← All settings (reads ../.env)
├── utils.py         ← ProgressTracker, ETA, line counter
├── logger.py        ← Logging setup + FailedRowSink CSV
├── requirements.txt
└── README.md
```

---

## Configuration

All settings live in `config.py → ImporterConfig`.  
Override via CLI flags or by editing the dataclass defaults.

| Option | Default | CLI flag |
|---|---|---|
| `input_file` | path in config.py | `--file` |
| `chunk_size` | 10 000 | `--chunk` |
| `batch_size` | 2 000 | `--batch` |
| `max_workers` | 4 | `--workers` |
| `duplicate_mode` | `upsert` | `--dup` |
| `database_url` | from `.env` | `--db` |

---

## Column Mapping

The importer reads **only** the columns it needs from the 215-column TSV.
All other columns are ignored at the pandas `usecols` stage (zero wasted RAM).

| OFF Column | DB Field |
|---|---|
| `code` | `barcode` |
| `product_name` | `name` |
| `brands` | `brand` |
| `categories` | `category` (first token) |
| `image_url` | `image_url` |
| `generic_name` | `short_description` |
| `ingredients_text`, `allergens`, `traces`, `countries`, `packaging`, `url`, nutrition fields | `specifications` (JSON blob) |
| `manufacturer` / `brands` | `supplier` |

---

## Output Files

| File | Description |
|---|---|
| `import.log` | Full structured log with timing |
| `failed_rows.csv` | Rows that failed validation with reason |

---

## Performance Expectations

| Setup | Throughput |
|---|---|
| 4 workers, batch 2000, SSD, local Postgres | ~15 000 – 25 000 rows/sec |
| 1 worker, batch 500, HDD | ~3 000 – 5 000 rows/sec |

1 048 756 rows at 20 000 rows/sec ≈ **~52 minutes**.

---

## Duplicate Handling

| Mode | Behaviour |
|---|---|
| `upsert` | Insert new; UPDATE existing rows with fresh data |
| `insert` | Insert new; silently skip existing barcodes |
| `skip` | Same as `insert` |

---

## Re-running

The importer is **idempotent**.  Re-running with `--dup upsert` (default)
will update existing rows with any changed OFF data and insert any newly
appeared barcodes.
