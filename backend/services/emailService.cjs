const nodemailer = require('nodemailer');

// Email regex validator
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).toLowerCase());
}

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  const service = process.env.SMTP_SERVICE;
  const host    = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port    = Number(process.env.SMTP_PORT || 465);
  const user    = process.env.SMTP_USER;
  const rawPass = process.env.SMTP_PASS || '';
  const pass    = rawPass.replace(/\s+/g, ''); // strip spaces from app password

  if (user && pass) {
    if (service === 'gmail' || (user && user.toLowerCase().endsWith('@gmail.com'))) {
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: user.trim(),
          pass: pass.trim()
        }
      });
    } else {
      transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user: user.trim(),
          pass: pass.trim()
        },
        tls: { rejectUnauthorized: false }
      });
    }
  } else {
    // Development / fallback transporter
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: {
        user: 'system.inventory.erp@gmail.com',
        pass: 'temp_secret_pass_123'
      },
      tls: { rejectUnauthorized: false }
    });
  }

  return transporter;
}

async function sendOtpEmail(toEmail, otpCode) {
  if (!isValidEmail(toEmail)) {
    throw Object.assign(new Error('Invalid email address format.'), { status: 400 });
  }

  const senderEmail = process.env.SMTP_USER || 'no-reply@inventory-erp.local';
  const senderName  = 'Inventory ERP';

  const mailOptions = {
    from: process.env.SMTP_FROM || `"${senderName}" <${senderEmail}>`,
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
    const transport = getTransporter();
    const info = await transport.sendMail(mailOptions);
    console.log(`[EmailService] ✅ Email OTP ${otpCode} successfully delivered to ${toEmail}. MessageId: ${info?.messageId || 'sent'}`);
    return { success: true, messageId: info?.messageId };
  } catch (err) {
    console.error(`[EmailService] ❌ SMTP send error for ${toEmail}:`, err.message);
    throw Object.assign(new Error(`Unable to deliver OTP email to "${toEmail}": ${err.message}. Please verify your email address.`), { status: 400 });
  }
}

module.exports = { isValidEmail, sendOtpEmail };
