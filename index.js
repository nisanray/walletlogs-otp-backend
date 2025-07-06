require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// Rate limiting (simple in-memory store for demo)
const requestCounts = new Map();
const RATE_LIMIT = 5; // Max 5 requests per minute per IP
const WINDOW_MS = 60 * 1000; // 1 minute

// Simple rate limiting middleware
const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }
  
  const { count, resetTime } = requestCounts.get(ip);
  
  if (now > resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + WINDOW_MS });
    return next();
  }
  
  if (count >= RATE_LIMIT) {
    return res.status(429).json({ 
      success: false, 
      error: 'Too many requests. Please try again later.' 
    });
  }
  
  requestCounts.set(ip, { count: count + 1, resetTime });
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// POST /send-otp endpoint
app.post('/send-otp', rateLimit, async (req, res) => {
  const { email, otp } = req.body;
  
  // Validation
  if (!email || !otp) {
    return res.status(400).json({ 
      success: false, 
      error: 'Email and OTP are required' 
    });
  }
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ 
      success: false, 
      error: 'Invalid email format' 
    });
  }
  
  // OTP validation (should be 6 digits)
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ 
      success: false, 
      error: 'OTP must be 6 digits' 
    });
  }

  try {
    // Create transporter
    let transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT),
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    // Verify transporter configuration
    await transporter.verify();

    // Email HTML template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>WalletLogs - Verification Code</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; }
          .header { background: linear-gradient(135deg, #2563EB, #059669); padding: 30px; text-align: center; }
          .logo { color: white; font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .header-text { color: white; font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .otp-box { background: linear-gradient(135deg, #f8fafc, #e2e8f0); border: 2px solid #2563EB; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
          .otp-code { font-size: 36px; font-weight: bold; color: #2563EB; letter-spacing: 8px; margin: 20px 0; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; color: #991b1b; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="logo">🔐 WalletLogs</div>
            <div class="header-text">Secure Financial Management</div>
          </div>
          
          <div class="content">
            <h2 style="color: #1f2937; margin-bottom: 20px;">Your Verification Code</h2>
            
            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              We received a request to sign in to your WalletLogs account. 
              Please use the verification code below to complete your login:
            </p>
            
            <div class="otp-box">
              <div style="color: #374151; font-size: 14px; margin-bottom: 10px;">Your verification code is:</div>
              <div class="otp-code">${otp}</div>
              <div style="color: #6b7280; font-size: 12px; margin-top: 10px;">This code will expire in 5 minutes</div>
            </div>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> Never share this code with anyone. 
              WalletLogs will never ask for your verification code via phone or email.
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              If you didn't request this code, please ignore this email or contact our support team.
            </p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} WalletLogs. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email
    const info = await transporter.sendMail({
      from: `"WalletLogs Security" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "🔐 Your WalletLogs Verification Code",
      text: `Your WalletLogs verification code is: ${otp}. This code will expire in 5 minutes. Never share this code with anyone.`,
      html: htmlTemplate,
    });

    console.log(`OTP email sent successfully to ${email}. Message ID: ${info.messageId}`);
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error sending OTP email:', error);
    
    // Don't expose internal error details to client
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send verification email. Please try again.' 
    });
  }
});

// Handle 404 for unknown routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ 
    success: false, 
    error: 'Internal server error' 
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 OTP Email Backend running on port ${PORT}`);
  console.log(`📧 SMTP configured for: ${process.env.SMTP_USER}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});
