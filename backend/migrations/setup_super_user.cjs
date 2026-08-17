const pool = require('../config/db.cjs');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

async function setupSuperUser() {
  try {
    const [rows] = await pool.query(
      "SELECT uid, username, email, role_position FROM user_master WHERE role_position = 'Super User' AND delete_datetime IS NULL"
    );

    const superUsername = 'superuser';
    const superPassword = 'SuperUser@2026';
    const superEmail = 'superuser@local.erp';
    const passwordHash = await bcrypt.hash(superPassword, 10);

    const [[existing]] = await pool.query(
      "SELECT uid, username FROM user_master WHERE username = ? OR role_position = 'Super User'",
      [superUsername]
    );

    if (existing) {
      await pool.query(
        `UPDATE user_master 
         SET username = ?, password_hash = ?, role_position = 'Super User', is_email_verified = 1, update_datetime = NOW()
         WHERE uid = ?`,
        [superUsername, passwordHash, existing.uid]
      );
      // console.log('Updated existing account to Super User with uid:', existing.uid);
    } else {
      const uid = uuidv4();
      await pool.query(
        `INSERT INTO user_master 
         (uid, first_name, last_name, username, email, password_hash, role_position, is_email_verified, entry_datetime)
         VALUES (?, 'Super', 'Administrator', ?, ?, ?, 'Super User', 1, NOW())`,
        [uid, superUsername, superEmail, passwordHash]
      );
      // console.log('Created new Super User account with uid:', uid);
    }

    // console.log('\n==========================================');
    // console.log(' SUPER USER CREDENTIALS CONFIGURED');
    // console.log('==========================================');
    // console.log(' Username : superuser');
    // console.log(' Password : ' + superPassword);
    // console.log(' Role     : Super User');
    // console.log('==========================================\n');

    process.exit(0);
  } catch (err) {
    // console.error('Error configuring Super User:', err);
    process.exit(1);
  }
}

setupSuperUser();
