const companyModel = require('../models/companyModel.cjs');

exports.get = async (req, res, next) => {
  try {
    const company = await companyModel.get();
    res.json({ data: company });
  } catch (err) { next(err); }
};

exports.upsert = async (req, res, next) => {
  try {
    const { company_name, mobile_number, address, pincode, state, city, area } = req.body;
    const missing = [];
    if (!company_name?.trim()) missing.push('company_name');
    if (!mobile_number?.trim()) missing.push('mobile_number');
    if (!address?.trim()) missing.push('address');
    if (!pincode?.trim()) missing.push('pincode');
    if (!state?.trim()) missing.push('state');
    if (!city?.trim()) missing.push('city');
    if (!area?.trim()) missing.push('area');
    if (missing.length) {
      return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
    }
    if (!/^\d{10}$/.test(mobile_number?.trim())) {
      return res.status(400).json({ error: 'Mobile number must be exactly 10 digits' });
    }
    // Validate GST fields if registered
    if (req.body.is_gst_registered) {
      if (!req.body.gstin?.trim()) {
        return res.status(400).json({ error: 'GSTIN is required for GST-registered company' });
      }
      for (const field of ['cgst_percent', 'sgst_percent', 'igst_percent']) {
        const val = Number(req.body[field] || 0);
        if (val < 0 || val > 100) {
          return res.status(400).json({ error: `${field} must be between 0 and 100` });
        }
      }
    }
    const company = await companyModel.upsert(req.body);
    res.json({ data: company });
  } catch (err) { next(err); }
};

exports.testSmtp = async (req, res, next) => {
  try {
    const { testSmtpConnection } = require('../services/emailService.cjs');
    const result = await testSmtpConnection(req.body);
    res.json(result);
  } catch (err) { next(err); }
};
