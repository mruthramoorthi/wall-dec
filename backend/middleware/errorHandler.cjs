// Single place that turns thrown errors into the standard error shape
// documented in docs/04-API-Docs.md.
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  if (err.status) {
    return res.status(err.status).json({ error: { field: err.field || null, message: err.message } });
  }
  return res.status(500).json({ error: { field: null, message: 'Internal server error' } });
}

class ApiError extends Error {
  constructor(status, message, field = null) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

module.exports = { errorHandler, ApiError };
