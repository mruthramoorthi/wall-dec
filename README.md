# Inventory ERP with Billing

Implements all 5 chunks from `docs/05-Build-Checklist.md`: Size Master, Dealer Master, Stock Inward, Billing, Amount Transaction — built per `docs/01-SRS.md` through `docs/04-API-Docs.md`.

## Stack
- **frontend/** — React 18 + Vite
- **backend/** — Node/Express, MVC (models/controllers/routes), MySQL via `mysql2`
- **image-search-service/** — Python FastAPI, perceptual-hash image matching (see note below)

## 1. Database
```
mysql -u root -p < backend/db/schema.sql
```

## 2. Backend
```
cd backend
cp .env.example .env      # edit DB_* to match your MySQL setup
npm install
npm run dev                # http://localhost:4000
```

## 3. Image Search Service
```
cd image-search-service
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
export IMAGE_STORE_PATH=/path/to/your/stock/photos
python build_index.py      # builds the initial index.json
uvicorn main:app --reload --port 8000
```
Re-run `build_index.py` (or `POST /reindex`) whenever new stock photos are added to `IMAGE_STORE_PATH`.

**Note on the matching algorithm:** this uses perceptual hashing (`ImageHash`), not a deep-learning embedding model — it's dependency-light (no model download, no GPU) and works well for "is this the same design we already photographed" duplicate/near-duplicate matching, which is what stock-photo lookup actually is. If you later need broader visual similarity (e.g. matching different photo angles/lighting of the same board), swap `hash_image()` in `build_index.py` for a CNN feature extractor — the `/search` API shape (`[{filename, score}]`) stays the same either way, so nothing else in the stack needs to change.

## 4. Frontend
```
cd frontend
npm install
npm run dev                 # http://localhost:5173, proxies /api to :4000
```

## Verified in this environment
- All backend `.cjs` files pass `node --check` (no syntax errors)
- Backend module graph (`routes/index.cjs` → controllers → models → config) resolves cleanly with `node -e "require(...)"`
- `npm run build` for the frontend completes successfully (51 modules, no errors)
- MySQL and the Python service were **not** available in this sandbox, so the DB queries and image-search endpoint are unverified against a live database/service — run Chunk 1 (Size Master) end-to-end first per the checklist to confirm the DB/API wiring before relying on the rest.

## Design decisions carried over from the docs
- Every table's "current & visible" rows = `WHERE update_datetime IS NULL AND delete_datetime IS NULL` — implemented once in `backend/utils/audit.cjs` and reused by every model.
- Editing never overwrites a row: it stamps `update_datetime` on the old row and inserts a new one with the same `uid`, inside one transaction (`withTransaction` + `markSuperseded`).
- Cross-table references use `uid` (stable UUID), never the numeric `id`, so historical stock/bill rows stay linked after a master record is edited.
- The image-search proxy (`backend/controllers/stockController.cjs`) degrades to `{matches: []}` on any Python-service failure/timeout instead of erroring, so Stock Inward/Billing are never blocked by that service being down.
- Billing's `POST /bill` rejects (422) unless `SUM(payments) === net_amount`, both client-side (for UX) and server-side (source of truth).
