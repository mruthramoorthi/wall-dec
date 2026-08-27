# Wall-Dec Project Improvement & Architecture Roadmap

A strategic, high-impact roadmap for scaling performance, data consistency, and user conversion across the Wall-Dec ERP and Customer Portal.

---

## 1. 🚨 Performance & Bundle Architecture: Route-Based Code Splitting
* **Priority:** Critical (P0)
* **Problem:** The compiled JavaScript bundle is currently **~761 kB in a single file**. When a retail customer browses the catalog on mobile (4G/3G), their device is forced to download the entire Admin ERP codebase (Dealer Master, Bank Master, Employee Master, Stock Inward, Expense Reports, etc.) before the catalog can render.
* **Solution:**
  - Implement `React.lazy()` and `<Suspense fallback={<LoadingSpinner />}>` in `App.jsx`.
  - Separate customer-facing routes (`/catalog`, `/checkout`, `/track-orders`, `/track-advances`) from admin ERP routes (`/admin/*`, `/stock-inward`, `/dealers`, etc.).
* **Expected Impact:** Reduces initial customer bundle size by **65–70%**, enabling sub-second initial paint on mobile devices.

---

## 2. ⚡ Concurrency & Inventory Race Condition Protection
* **Priority:** High (P0)
* **Problem:** Counter sales and online customer checkouts occur simultaneously. If the counter bills the last 5 sheets of a design while an online customer clicks "Buy Now", non-locking database updates can result in **negative stock or phantom orders**.
* **Solution:**
  - Enforce atomic SQL decrements with strict conditional guards in order creation transactions:
    ```sql
    UPDATE stock_master 
    SET available_pcs = available_pcs - :qty 
    WHERE uid = :uid AND available_pcs >= :qty;
    ```
  - If rows affected is `0`, roll back the transaction immediately and return a clean HTTP 409: `"Selected design was just sold out at the counter."`
* **Expected Impact:** 100% elimination of double-booking and negative inventory records.

---

## 3. 🖼️ Automated WebP Image Compression & Thumbnail Pipeline
* **Priority:** High (P1)
* **Problem:** Wall decor is purely visual. Serving uncompressed raw JPEGs/PNGs directly from static disk storage consumes excessive bandwidth and causes choppy 60fps scrolling on long catalog pages.
* **Solution:**
  - Integrate a Node.js image processing pipeline (`sharp`) on upload to automatically generate 3 optimized WebP resolutions:
    1. **Thumbnail (`300px`):** For catalog grid cards and cart drawer items.
    2. **Medium (`800px`):** For quick-view modal dialogs.
    3. **Original / 4K:** Served only when the user activates the zoom / fullscreen lightbox.
  - Enable native `loading="lazy"` on all offscreen catalog images.
* **Expected Impact:** Decreases total network payload by **80%**, drastically speeds up mobile image loading.

---

## 4. 📲 Automated WhatsApp & SMS Notification Engine
* **Priority:** High (P1)
* **Problem:** Indian retail and wholesale decor customers rarely check email for order progress or advance deposit receipts.
* **Solution:**
  - Integrate WhatsApp Business API / Webhook alerts (e.g., Gupshup, Interakt, Twilio) for:
    1. **Advance Received:** *"Hi {Name}, your advance of ₹{Amount} for {Design} has been recorded! View 58mm receipt: {link}"*
    2. **Order Dispatched:** *"Your panels are dispatched via {Courier}! AWB: {awb}. Track live: {link}"*
    3. **Low Stock Alert (Admin):** Automated daily alert to warehouse managers for high-demand panels with `< 10` sheets.
* **Expected Impact:** Dramatically improves customer trust and eliminates manual inquiry calls to the sales team.

---

## 5. 🔄 Real-Time Cart Stock Verification
* **Priority:** Medium (P2)
* **Problem:** A customer may keep items in their cart for 15 minutes before checkout. If stock changes in the meantime, they only discover the issue after entering their full shipping address.
* **Solution:**
  - Add a lightweight pre-flight stock verification hook triggered whenever the Cart Drawer opens or the user navigates to `/checkout`.
  - Automatically display a soft badge: `"⚠️ Only 2 sheets left for Design #11246"` if inventory is running low.
* **Expected Impact:** Reduces checkout drop-offs and eliminates checkout errors.

---

## 6. 📊 Business Intelligence: Search Trends & Lost Demand Analytics
* **Priority:** Medium (P2)
* **Problem:** The ERP knows what has been sold, but has no visibility into what customers are searching for that is currently out of stock.
* **Solution:**
  - Log search queries and image-search uploads with zero or low matching inventory.
  - Provide a **"Demand Insights"** dashboard widget showing top searched-for thickness, colors, and patterns.
* **Expected Impact:** Provides actionable purchasing intelligence for inventory inward decisions.

---

## Recommended Execution Plan

| Phase | Milestone | Focus Area | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Route Code-Splitting & Lazy Loading | Frontend Performance | ✅ **COMPLETED** (761 kB -> 20 kB entry + on-demand page chunks) |
| **Phase 2** | Atomic Database Stock Decrement Guard | Backend Data Integrity | ✅ **COMPLETED** (Row locks + Online order inventory integration) |
| **Phase 3** | Sharp WebP Multi-Resolution Pipeline | Asset Optimization | ✅ **COMPLETED** (On-the-fly WebP conversion + Disk caching + Resolution presets) |
| **Phase 4** | WhatsApp / SMS Webhook Integration | Customer Communication | ⏸️ *On Hold (Pending WhatsApp Provider Selection)* |
| **Phase 5** | Pre-Flight Cart Stock Sync & Demand Logging | UX & Business Analytics | ✅ **COMPLETED** (Live cart inventory guard + Zero-result demand analytics) |
