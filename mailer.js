const nodemailer = require('nodemailer');

let transporter;
function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

async function sendResetEmail(to, name, link) {
  const info = await getTransporter().sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    subject: 'Reset your Goal2Govt password',
    text: `Hi ${name},\n\nReset your password using this link (valid for 1 hour):\n${link}\n\nIf you didn't request this, ignore this email.`,
    html: `<p>Hi ${name},</p><p><a href="${link}">Click here to reset your password</a> (valid for 1 hour).</p><p>If you didn't request this, ignore this email.</p>`,
  });
}

module.exports = { sendResetEmail };
