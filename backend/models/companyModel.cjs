const pool = require('../config/db.cjs');
const { ACTIVE_FILTER, newUid, withTransaction, markSuperseded } = require('../utils/audit.cjs');

const TABLE = 'company_master';

async function get() {
  const [rows] = await pool.query(
    `SELECT uid, company_name, mobile_number, email, website, address, pincode, state, city, area,
            logo_filename, is_gst_registered, gstin, cgst_percent, sgst_percent, igst_percent,
            smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, entry_datetime
     FROM ${TABLE}
     WHERE ${ACTIVE_FILTER}
     ORDER BY entry_datetime ASC LIMIT 1`
  );
  return rows[0] || null;
}

async function upsert(data) {
  const existing = await get();

  const fields = {
    company_name: data.company_name?.trim() || '',
    mobile_number: (data.mobile_number || '').trim(),
    email: data.email ? data.email.trim() : null,
    website: data.website ? data.website.trim() : null,
    address: (data.address || '').trim(),
    pincode: (data.pincode || '').trim(),
    state: (data.state || '').trim(),
    city: (data.city || '').trim(),
    area: (data.area || '').trim(),
    logo_filename: data.logo_filename || (existing?.logo_filename || null),
    is_gst_registered: data.is_gst_registered ? 1 : 0,
    gstin: data.is_gst_registered && data.gstin ? data.gstin.trim().toUpperCase() : null,
    cgst_percent: data.is_gst_registered ? Math.min(100, Math.max(0, Number(data.cgst_percent || 0))) : 0,
    sgst_percent: data.is_gst_registered ? Math.min(100, Math.max(0, Number(data.sgst_percent || 0))) : 0,
    igst_percent: data.is_gst_registered ? Math.min(100, Math.max(0, Number(data.igst_percent || 0))) : 0,
    smtp_host: data.smtp_host ? data.smtp_host.trim() : null,
    smtp_port: data.smtp_port ? Number(data.smtp_port) : 587,
    smtp_user: data.smtp_user ? data.smtp_user.trim() : null,
    smtp_pass: data.smtp_pass ? data.smtp_pass.trim() : (existing?.smtp_pass || null),
    smtp_from_name: data.smtp_from_name ? data.smtp_from_name.trim() : null,
  };

  if (existing) {
    await withTransaction(pool, async (conn) => {
      await markSuperseded(conn, TABLE, existing.uid);
      await conn.query(
        `INSERT INTO ${TABLE}
         (uid, company_name, mobile_number, email, website, address, pincode, state, city, area,
          logo_filename, is_gst_registered, gstin, cgst_percent, sgst_percent, igst_percent,
          smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, entry_datetime)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
        [existing.uid, ...Object.values(fields)]
      );
    });
  } else {
    const uid = newUid();
    await pool.query(
      `INSERT INTO ${TABLE}
       (uid, company_name, mobile_number, email, website, address, pincode, state, city, area,
        logo_filename, is_gst_registered, gstin, cgst_percent, sgst_percent, igst_percent,
        smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_name, entry_datetime)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NOW())`,
      [uid, ...Object.values(fields)]
    );
  }
  return get();
}

module.exports = { get, upsert };
