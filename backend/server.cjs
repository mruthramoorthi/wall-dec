require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const routes = require('./routes/index.cjs');
const { errorHandler } = require('./middleware/errorHandler.cjs');
const { serveOptimizedImage } = require('./middleware/imageOptimizer.cjs');

const app = express();
app.use(cors());
app.use(express.json());

// Serve optimized and resized WebP images from the image store with on-the-fly caching
app.get('/images/*', serveOptimizedImage);
const IMAGE_STORE = path.join(__dirname, '..', 'image-search-service', 'image-store');
app.use('/images', express.static(IMAGE_STORE));

app.use('/api', routes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => console.log(`Inventory ERP API listening on port ${PORT}`));

// Without this, `node --watch` (used by `npm run dev`) kills the process on
// every file save but the OS doesn't always release the port fast enough
// before the new instance tries to bind — causing an EADDRINUSE that looks
// like "something else" is using the port, when it's actually this same
// server's previous instance still shutting down. Closing the server
// explicitly on SIGTERM/SIGINT lets the port free up immediately.
function shutdown() {
  server.close(() => process.exit(0));
  // Force-exit if close() hangs (e.g. a lingering DB connection) so --watch
  // isn't left waiting indefinitely.
  setTimeout(() => process.exit(0), 2000).unref();
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
