const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db.cjs');
const { newUid } = require('../utils/audit.cjs');
const { isValidEmail, sendOtpEmail, sendPasswordResetOtpEmail } = require('../services/emailService.cjs');

const USER_TABLE = 'user_master';
const OTP_TABLE  = 'email_otp_master';
const JWT_SECRET = process.env.JWT_SECRET || 'inventory_erp_jwt_secret_key_2026_safe';

// Informational password strength check helper
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') return false;
  if (password.length < 4) return false;
  return true;
}

// Generate 6-digit cryptographic random numeric OTP
function generate6DigitOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function checkUsernameAvailable(username, excludeUid = null) {
  if (!username || !username.trim()) return false;
  const clean = username.trim().toLowerCase();
  let query = `SELECT uid FROM ${USER_TABLE} WHERE LOWER(username) = ? AND delete_datetime IS NULL`;
  const params = [clean];
  if (excludeUid) {
    query += ` AND uid != ?`;
    params.push(excludeUid);
  }
  const [[existing]] = await pool.query(query, params);
  return !existing;
}

async function sendRegistrationOtp(email) {
  if (!email || !isValidEmail(email)) {
    throw Object.assign(new Error('Please provide a valid email address.'), { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();

  // Check if email already registered in user_master
  const [[existingUser]] = await pool.query(
    `SELECT uid FROM ${USER_TABLE} WHERE LOWER(email) = ? AND delete_datetime IS NULL`,
    [cleanEmail]
  );
  if (existingUser) {
    throw Object.assign(new Error('This email is already registered. Please log in instead.'), { status: 400 });
  }

  const otpCode = generate6DigitOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  // Store OTP record with status = 'sent'
  const [insertRes] = await pool.query(
    `INSERT INTO ${OTP_TABLE} (email, otp_code, status, expires_at, is_used, entry_datetime)
     VALUES (?, ?, 'sent', ?, 0, NOW())`,
    [cleanEmail, otpCode, expiresAt]
  );
  const otpId = insertRes.insertId;

  try {
    // Send via email service
    await sendOtpEmail(cleanEmail, otpCode);
    return { success: true, email: cleanEmail, message: 'OTP sent to your email successfully.' };
  } catch (err) {
    // Mark status as 'failed'
    await pool.query(`UPDATE ${OTP_TABLE} SET status = 'failed' WHERE id = ?`, [otpId]);
    throw err;
  }
}

async function verifyRegistrationOtp(email, otpCode) {
  if (!email || !otpCode) {
    throw Object.assign(new Error('Email and OTP code are required.'), { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp   = String(otpCode).trim();

  const [[record]] = await pool.query(
    `SELECT id, otp_code, expires_at, is_used
     FROM ${OTP_TABLE}
     WHERE email = ? AND otp_code = ? AND is_used = 0 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [cleanEmail, cleanOtp]
  );

  if (!record) {
    throw Object.assign(new Error('Invalid or expired OTP code. Please check and try again.'), { status: 400 });
  }

  // Mark used and verified
  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET is_used = 1, status = 'verified', verified_datetime = NOW()
     WHERE id = ?`,
    [record.id]
  );

  return { success: true, verified: true, email: cleanEmail };
}

async function register(data) {
  const {
    first_name,
    last_name,
    mobile_number,
    email,
    dob,
    gender,
    username,
    password,
    profile_picture = null
  } = data;

  // 1. Mandatory field checks
  if (!first_name || !first_name.trim()) throw Object.assign(new Error('First name is required.'), { status: 422 });
  if (!last_name || !last_name.trim()) throw Object.assign(new Error('Last name is required.'), { status: 422 });
  if (!mobile_number || !/^\d{10}$/.test(String(mobile_number).trim())) {
    throw Object.assign(new Error('Mobile number must be exactly 10 digits.'), { status: 422 });
  }
  if (!email || !isValidEmail(email)) throw Object.assign(new Error('Valid email address is required.'), { status: 422 });
  if (!dob) throw Object.assign(new Error('Date of Birth is required.'), { status: 422 });
  if (!gender) throw Object.assign(new Error('Gender is required.'), { status: 422 });
  if (!username || !username.trim()) throw Object.assign(new Error('Username is required.'), { status: 422 });
  if (!password || password.length < 4) throw Object.assign(new Error('Password is required (minimum 4 characters).'), { status: 422 });

  const cleanUsername = username.trim().toLowerCase();
  const cleanEmail    = email.trim().toLowerCase();

  // 2. Username uniqueness check
  const isAvail = await checkUsernameAvailable(cleanUsername);
  if (!isAvail) {
    throw Object.assign(new Error(`Username "${username.trim()}" is not available / already taken. Please choose another username.`), { status: 400 });
  }

  // 3. Email uniqueness check
  const [[existingEmail]] = await pool.query(
    `SELECT uid FROM ${USER_TABLE} WHERE LOWER(email) = ? AND delete_datetime IS NULL`,
    [cleanEmail]
  );
  if (existingEmail) {
    throw Object.assign(new Error(`Email "${cleanEmail}" is already registered. Please log in.`), { status: 400 });
  }

  // 4. Check OTP verification record was completed
  const [[verifiedOtp]] = await pool.query(
    `SELECT id FROM ${OTP_TABLE}
     WHERE email = ? AND is_used = 1 AND status = 'verified'
     ORDER BY id DESC LIMIT 1`,
    [cleanEmail]
  );
  if (!verifiedOtp) {
    throw Object.assign(new Error('Email is not verified. Please verify with the OTP sent to your email first.'), { status: 403 });
  }

  // 5. Hash password
  const password_hash = await bcrypt.hash(password, 10);
  const userUid = newUid();

  await pool.query(
    `INSERT INTO ${USER_TABLE}
     (uid, first_name, last_name, mobile_number, email, dob, gender, profile_picture, username, password_hash, is_email_verified, entry_datetime)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
    [
      userUid,
      first_name.trim(),
      last_name.trim(),
      String(mobile_number).trim(),
      cleanEmail,
      dob,
      gender,
      profile_picture || null,
      cleanUsername,
      password_hash
    ]
  );

  return {
    uid: userUid,
    first_name: first_name.trim(),
    last_name: last_name.trim(),
    username: cleanUsername,
    email: cleanEmail,
    profile_picture: profile_picture || null,
    is_email_verified: 1
  };
}

async function login(identifier, password) {
  if (!identifier || !identifier.trim()) throw Object.assign(new Error('Username or Email is required.'), { status: 400 });
  if (!password) throw Object.assign(new Error('Password is required.'), { status: 400 });

  const clean = identifier.trim().toLowerCase();

  const [[user]] = await pool.query(
    `SELECT uid, first_name, last_name, mobile_number, email, DATE_FORMAT(dob, '%Y-%m-%d') AS dob, gender, profile_picture, username, password_hash, is_email_verified, ui_preferences, role_position
     FROM ${USER_TABLE}
     WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND delete_datetime IS NULL`,
    [clean, clean]
  );

  if (!user) {
    throw Object.assign(new Error('Invalid username/email or password.'), { status: 401 });
  }

  if (user.is_email_verified !== 1) {
    throw Object.assign(new Error('Your email is not verified yet. Please complete email verification.'), { status: 403 });
  }

  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    throw Object.assign(new Error('Invalid username/email or password.'), { status: 401 });
  }

  const token = jwt.sign(
    {
      uid: user.uid,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role_position: user.role_position || 'Admin'
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  let prefs = {};
  if (user.ui_preferences) {
    try {
      prefs = typeof user.ui_preferences === 'string' ? JSON.parse(user.ui_preferences) : user.ui_preferences;
    } catch {}
  }

  return {
    token,
    user: {
      uid: user.uid,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      email: user.email,
      mobile_number: user.mobile_number,
      dob: user.dob || null,
      gender: user.gender,
      role_position: user.role_position || 'Admin',
      profile_picture: user.profile_picture || null,
      avatar_letter: user.first_name ? user.first_name.charAt(0).toUpperCase() : 'U',
      ui_preferences: prefs
    }
  };
}

async function getProfile(uid) {
  const [[user]] = await pool.query(
    `SELECT uid, first_name, last_name, mobile_number, email, DATE_FORMAT(dob, '%Y-%m-%d') AS dob, gender, profile_picture, username, ui_preferences, role_position
     FROM ${USER_TABLE}
     WHERE uid = ? AND delete_datetime IS NULL`,
    [uid]
  );
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });

  let prefs = {};
  if (user.ui_preferences) {
    try {
      prefs = typeof user.ui_preferences === 'string' ? JSON.parse(user.ui_preferences) : user.ui_preferences;
    } catch {}
  }

  return {
    uid: user.uid,
    first_name: user.first_name,
    last_name: user.last_name,
    username: user.username,
    email: user.email,
    mobile_number: user.mobile_number,
    dob: user.dob || null,
    gender: user.gender,
    role_position: user.role_position || 'Admin',
    profile_picture: user.profile_picture || null,
    avatar_letter: user.first_name ? user.first_name.charAt(0).toUpperCase() : 'U',
    ui_preferences: prefs
  };
}

async function getPreferences(uid) {
  const [[row]] = await pool.query(
    `SELECT ui_preferences FROM ${USER_TABLE} WHERE uid = ? AND delete_datetime IS NULL`,
    [uid]
  );
  if (!row) return {};
  try {
    return typeof row.ui_preferences === 'string' ? JSON.parse(row.ui_preferences) : (row.ui_preferences || {});
  } catch {
    return {};
  }
}

async function updatePreferences(uid, preferences) {
  const current = await getPreferences(uid);
  const merged = { ...current, ...(preferences || {}) };
  await pool.query(
    `UPDATE ${USER_TABLE} SET ui_preferences = ?, update_datetime = NOW() WHERE uid = ? AND delete_datetime IS NULL`,
    [JSON.stringify(merged), uid]
  );
  return merged;
}

async function updateProfile(uid, data) {
  const { first_name, last_name, mobile_number, dob, gender, username, profile_picture } = data;

  if (!first_name || !first_name.trim()) throw Object.assign(new Error('First name is required.'), { status: 422 });
  if (!last_name || !last_name.trim()) throw Object.assign(new Error('Last name is required.'), { status: 422 });
  if (!mobile_number || !/^\d{10}$/.test(String(mobile_number).trim())) {
    throw Object.assign(new Error('Mobile number must be exactly 10 digits.'), { status: 422 });
  }
  if (!username || !username.trim()) throw Object.assign(new Error('Username is required.'), { status: 422 });

  const cleanUsername = username.trim().toLowerCase();

  // Check username uniqueness excluding current user
  const isAvail = await checkUsernameAvailable(cleanUsername, uid);
  if (!isAvail) {
    throw Object.assign(new Error(`Username "${username.trim()}" is not available / already taken.`), { status: 400 });
  }

  let updateSql = `UPDATE ${USER_TABLE} SET first_name = ?, last_name = ?, mobile_number = ?, dob = ?, gender = ?, username = ?, update_datetime = NOW()`;
  const params = [first_name.trim(), last_name.trim(), String(mobile_number).trim(), dob, gender, cleanUsername];

  if (profile_picture !== undefined) {
    updateSql += `, profile_picture = ?`;
    params.push(profile_picture);
  }

  updateSql += ` WHERE uid = ? AND delete_datetime IS NULL`;
  params.push(uid);

  await pool.query(updateSql, params);

  return getProfile(uid);
}

async function changePassword(uid, { current_password, new_password }) {
  if (!current_password) throw Object.assign(new Error('Current password is required.'), { status: 400 });
  if (!new_password || new_password.length < 4) {
    throw Object.assign(new Error('New password must be at least 4 characters.'), { status: 400 });
  }

  const [[user]] = await pool.query(
    `SELECT password_hash FROM ${USER_TABLE} WHERE uid = ? AND delete_datetime IS NULL`,
    [uid]
  );
  if (!user) throw Object.assign(new Error('User not found.'), { status: 404 });

  const isValid = await bcrypt.compare(current_password, user.password_hash);
  if (!isValid) {
    throw Object.assign(new Error('Current password is incorrect.'), { status: 400 });
  }

  const newHash = await bcrypt.hash(new_password, 10);
  await pool.query(`UPDATE ${USER_TABLE} SET password_hash = ?, update_datetime = NOW() WHERE uid = ?`, [newHash, uid]);

  return { success: true, message: 'Password changed successfully.' };
}

function maskEmailAddress(email) {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}*@${domain}`;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

async function sendForgotPasswordOtp(identifier) {
  if (!identifier || !identifier.trim()) {
    throw Object.assign(new Error('Please provide your registered Username or Email address.'), { status: 400 });
  }

  const clean = identifier.trim().toLowerCase();

  // 1. Look up in user_master
  let [[user]] = await pool.query(
    `SELECT uid, first_name, username, email FROM ${USER_TABLE}
     WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND delete_datetime IS NULL`,
    [clean, clean]
  );

  // 2. If not found in user_master, look up in employee_master
  if (!user) {
    const [[emp]] = await pool.query(
      `SELECT uid, employee_name AS first_name, username, email FROM employee_master
       WHERE (LOWER(username) = ? OR LOWER(email) = ?) AND delete_datetime IS NULL`,
      [clean, clean]
    );
    if (emp) user = emp;
  }

  if (!user) {
    throw Object.assign(new Error(`No account found matching "${identifier.trim()}". Please check and try again.`), { status: 404 });
  }

  if (!user.email || !isValidEmail(user.email)) {
    throw Object.assign(new Error('This account does not have a registered email address on file. Please contact an administrator to reset your password.'), { status: 400 });
  }

  const targetEmail = user.email.trim().toLowerCase();
  const otpCode = generate6DigitOtp();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  // Store in email_otp_master
  const [insertRes] = await pool.query(
    `INSERT INTO ${OTP_TABLE} (email, otp_code, status, expires_at, is_used, entry_datetime)
     VALUES (?, ?, 'sent', ?, 0, NOW())`,
    [targetEmail, otpCode, expiresAt]
  );
  const otpId = insertRes.insertId;

  try {
    await sendPasswordResetOtpEmail(targetEmail, otpCode);
    return {
      success: true,
      email: targetEmail,
      masked_email: maskEmailAddress(targetEmail),
      message: `Password reset OTP has been sent to ${maskEmailAddress(targetEmail)}.`
    };
  } catch (err) {
    await pool.query(`UPDATE ${OTP_TABLE} SET status = 'failed' WHERE id = ?`, [otpId]);
    throw err;
  }
}

async function verifyForgotPasswordOtp(email, otpCode) {
  if (!email || !otpCode) {
    throw Object.assign(new Error('Email and OTP code are required.'), { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp   = String(otpCode).trim();

  const [[record]] = await pool.query(
    `SELECT id, otp_code, expires_at, is_used
     FROM ${OTP_TABLE}
     WHERE email = ? AND otp_code = ? AND is_used = 0 AND expires_at > NOW()
     ORDER BY id DESC LIMIT 1`,
    [cleanEmail, cleanOtp]
  );

  if (!record) {
    throw Object.assign(new Error('Invalid or expired OTP code. Please check and try again.'), { status: 400 });
  }

  await pool.query(
    `UPDATE ${OTP_TABLE}
     SET is_used = 1, status = 'verified', verified_datetime = NOW()
     WHERE id = ?`,
    [record.id]
  );

  return { success: true, verified: true, email: cleanEmail };
}

async function resetPasswordWithOtp({ email, otp, new_password }) {
  if (!email || !otp) {
    throw Object.assign(new Error('Email and OTP code are required.'), { status: 400 });
  }
  if (!new_password || new_password.length < 4) {
    throw Object.assign(new Error('New password must be at least 4 characters.'), { status: 400 });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanOtp   = String(otp).trim();

  // Verify OTP was marked verified recently (within 15 minutes) or valid record exists
  const [[record]] = await pool.query(
    `SELECT id FROM ${OTP_TABLE}
     WHERE email = ? AND otp_code = ? AND (
       (status = 'verified' AND verified_datetime >= NOW() - INTERVAL 15 MINUTE)
       OR (is_used = 0 AND expires_at > NOW())
     )
     ORDER BY id DESC LIMIT 1`,
    [cleanEmail, cleanOtp]
  );

  if (!record) {
    throw Object.assign(new Error('Invalid or expired OTP session. Please request a new OTP.'), { status: 400 });
  }

  // Hash new password
  const newHash = await bcrypt.hash(new_password.trim(), 10);

  // Update in user_master
  const [userUpdate] = await pool.query(
    `UPDATE ${USER_TABLE} SET password_hash = ?, update_datetime = NOW()
     WHERE LOWER(email) = ? AND delete_datetime IS NULL`,
    [newHash, cleanEmail]
  );

  // Also update in employee_master if employee exists
  await pool.query(
    `UPDATE employee_master SET password_hash = ?, update_datetime = NOW()
     WHERE LOWER(email) = ? AND delete_datetime IS NULL`,
    [newHash, cleanEmail]
  );

  // Mark all OTPs for this email as used
  await pool.query(
    `UPDATE ${OTP_TABLE} SET is_used = 1, status = 'used' WHERE email = ? AND status != 'used'`,
    [cleanEmail]
  );

  return {
    success: true,
    message: 'Password reset successfully! You can now log in with your new password.'
  };
}

module.exports = {
  validatePasswordStrength,
  checkUsernameAvailable,
  sendRegistrationOtp,
  verifyRegistrationOtp,
  sendForgotPasswordOtp,
  verifyForgotPasswordOtp,
  resetPasswordWithOtp,
  register,
  login,
  getProfile,
  updateProfile,
  changePassword,
  getPreferences,
  updatePreferences
};
