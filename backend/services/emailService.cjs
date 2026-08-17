const nodemailer = require('nodemailer');
const companyModel = require('../models/companyModel.cjs');

// Email regex validator
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

async function createTransporterFromConfig(config = null) {
  let host = config?.smtp_host;
  let port = config?.smtp_port ? Number(config.smtp_port) : undefined;
  let user = config?.smtp_user;
  let pass = config?.smtp_pass ? config.smtp_pass.replace(/\s+/g, '') : '';
  let fromName = config?.smtp_from_name || 'Inventory ERP';

  // If no explicit config passed, check database company settings
  if (!user || !pass) {
    try {
      const company = await companyModel.get();
      if (company?.smtp_user && company?.smtp_pass) {
        host = company.smtp_host || 'smtp.gmail.com';
        port = Number(company.smtp_port || 587);
        user = company.smtp_user;
        pass = company.smtp_pass.replace(/\s+/g, '');
        fromName = company.smtp_from_name || company.company_name || 'Inventory ERP';
      }
    } catch (e) {
      console.warn('[EmailService] Could not read company SMTP from DB, using env:', e.message);
    }
  }

  // Fallback to .env if still empty
  if (!user || !pass) {
    host = process.env.SMTP_HOST || 'smtp.gmail.com';
    port = Number(process.env.SMTP_PORT || 465);
    user = process.env.SMTP_USER;
    pass = (process.env.SMTP_PASS || '').replace(/\s+/g, '');
    fromName = process.env.SMTP_FROM_NAME || 'Inventory ERP';
  }

  if (user && pass) {
    const isGmail = (user && user.toLowerCase().endsWith('@gmail.com')) || host?.includes('gmail');
    if (isGmail) {
      return {
        transporter: nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: user.trim(),
            pass: pass.trim()
          }
        }),
        fromAddress: `"${fromName}" <${user.trim()}>`,
        user: user.trim()
      };
    } else {
      const isSecure = port === 465;
      return {
        transporter: nodemailer.createTransport({
          host: host || 'smtp.gmail.com',
          port: port || 587,
          secure: isSecure,
          auth: {
            user: user.trim(),
            pass: pass.trim()
          },
          tls: { rejectUnauthorized: false }
        }),
        fromAddress: `"${fromName}" <${user.trim()}>`,
        user: user.trim()
      };
    }
  }

  // Fallback dev transporter
  return {
    transporter: nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'system.inventory.erp@gmail.com',
        pass: 'temp_secret_pass_123'
      },
      tls: { rejectUnauthorized: false }
    }),
    fromAddress: `"${fromName}" <no-reply@inventory-erp.local>`,
    user: 'no-reply@inventory-erp.local'
  };
}

async function testSmtpConnection(customConfig = null) {
  const { transporter, user } = await createTransporterFromConfig(customConfig);
  try {
    await transporter.verify();
    return {
      success: true,
      message: `SMTP connection established & verified successfully for "${user}"!`
    };
  } catch (err) {
    throw Object.assign(new Error(`SMTP connection verification failed: ${err.message}`), { status: 400 });
  }
}

async function sendOtpEmail(toEmail, otpCode) {
  if (!isValidEmail(toEmail)) {
    throw Object.assign(new Error('Invalid email address format.'), { status: 400 });
  }

  const { transporter, fromAddress } = await createTransporterFromConfig();

  const mailOptions = {
    from: fromAddress,
    to: toEmail.trim(),
    subject: `Your Inventory ERP Registration OTP: ${otpCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 24px;">📦 Inventory ERP</h2>
          <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">User Account Registration Verification</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Hello,
        </p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Thank you for registering on <strong>Inventory ERP</strong>. Please use the One-Time Password (OTP) below to verify your email address and activate your account:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #2563eb; background: #eff6ff; padding: 14px 28px; border-radius: 10px; border: 2px dashed #93c5fd;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 25px;">
          ⏱ This OTP is valid for <strong>10 minutes</strong>. Please do not share this verification code with anyone.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          If you did not request this registration code, you can safely ignore this email.
        </p>
      </div>
    `,
    text: `Your Inventory ERP registration OTP is: ${otpCode}. It is valid for 10 minutes.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // console.log(`[EmailService] ✅ Email OTP successfully delivered to ${toEmail}. MessageId: ${info?.messageId || 'sent'}`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    // console.error(`[EmailService] ❌ SMTP send error for ${toEmail}:`, err.message);
    throw Object.assign(new Error(`Unable to deliver OTP email to "${toEmail}": ${err.message}. Please verify your email address.`), { status: 400 });
  }
}

async function sendPasswordResetOtpEmail(toEmail, otpCode) {
  if (!isValidEmail(toEmail)) {
    throw Object.assign(new Error('Invalid email address format.'), { status: 400 });
  }

  const { transporter, fromAddress } = await createTransporterFromConfig();

  const mailOptions = {
    from: fromAddress,
    to: toEmail.trim(),
    subject: `Reset Your Inventory ERP Password - OTP: ${otpCode}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 25px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
        <div style="text-align: center; margin-bottom: 15px;">
          <h2 style="color: #0f172a; margin: 0; font-size: 24px;">🔒 Inventory ERP</h2>
          <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Password Reset Verification Code</p>
        </div>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          Hello,
        </p>
        <p style="font-size: 15px; color: #334155; line-height: 1.6;">
          We received a request to reset the password for your <strong>Inventory ERP</strong> account. Please use the One-Time Password (OTP) below to authorize the password reset:
        </p>
        <div style="text-align: center; margin: 30px 0;">
          <span style="display: inline-block; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #dc2626; background: #fef2f2; padding: 14px 28px; border-radius: 10px; border: 2px dashed #fca5a5;">
            ${otpCode}
          </span>
        </div>
        <p style="font-size: 13px; color: #64748b; text-align: center; margin-bottom: 25px;">
          ⏱ This password reset code is valid for <strong>10 minutes</strong>. If you did not request a password reset, please ignore this email or contact your administrator immediately.
        </p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
          Inventory ERP Security System • Automated Message
        </p>
      </div>
    `,
    text: `Your Inventory ERP password reset OTP is: ${otpCode}. It is valid for 10 minutes.`
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    // console.log(`[EmailService] ✅ Password reset OTP successfully delivered to ${toEmail}. MessageId: ${info?.messageId || 'sent'}`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    // console.error(`[EmailService] ❌ SMTP send error for ${toEmail}:`, err.message);
    throw Object.assign(new Error(`Unable to deliver password reset email to "${toEmail}": ${err.message}. Please verify your email address.`), { status: 400 });
  }
}

module.exports = {
  isValidEmail,
  sendOtpEmail,
  sendPasswordResetOtpEmail,
  testSmtpConnection
};
