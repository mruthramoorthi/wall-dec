require('dotenv').config();
const express = require('express');
const cors = require('cors');
const routes = require('./routes/index.cjs');
const { errorHandler } = require('./middleware/errorHandler.cjs');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api', routes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Inventory ERP API listening on port ${PORT}`));
