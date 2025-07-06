require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const morgan = require('morgan');
const { v4: uuidv4 } = require('uuid');
const { validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

// Import configurations
const logger = require('./config/logger');
const { getCorsConfig, getHelmetConfig, getRateLimitConfig } = require('./config/security');
const { validateSendOtp } = require('./config/validation');

/**
 * WalletLogs OTP Backend Service
 * Production-ready email OTP service with enhanced security and monitoring
 */
const app = express();

// Trust proxy for accurate IP addresses behind load balancers
app.set('trust proxy', 1);

/**
 * Request ID middleware for tracking requests
 */
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});

/**
 * Security middleware
 */
app.use(helmet(getHelmetConfig()));
app.use(cors(getCorsConfig()));

/**
 * Compression middleware for response optimization
 */
app.use(compression());

/**
 * Body parsing middleware
 */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/**
 * Request logging middleware
 */
const morganFormat = process.env.NODE_ENV === 'production' 
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms :req[x-request-id]'
  : 'dev';

app.use(morgan(morganFormat, {
  stream: {
    write: (message) => logger.info(message.trim(), { component: 'http' })
  }
}));

/**
 * Rate limiting middleware
 */
const limiter = rateLimit(getRateLimitConfig());
app.use('/send-otp', limiter);

/**
 * Enhanced health check endpoint with system information
 * @route GET /health
 */
app.get('/health', (req, res) => {
  const healthInfo = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    requestId: req.id
  };

  // Add memory usage in non-production environments
  if (process.env.NODE_ENV !== 'production') {
    healthInfo.memory = process.memoryUsage();
  }

  logger.info('Health check requested', { 
    requestId: req.id,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.json(healthInfo);
});

/**
 * POST /send-otp endpoint - Send OTP via email
 * @route POST /send-otp
 * @param {string} email - Email address to send OTP to
 * @param {string} otp - 6-digit OTP code
 */
app.post('/send-otp', validateSendOtp, async (req, res) => {
  const startTime = Date.now();
  const { email, otp } = req.body;
  
  logger.info('OTP send request received', {
    requestId: req.id,
    email: email,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorDetails = errors.array().map(err => ({
      field: err.param,
      message: err.msg,
      value: err.value
    }));

    logger.warn('Validation failed for OTP request', {
      requestId: req.id,
      email: email,
      errors: errorDetails,
      ip: req.ip
    });

    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errorDetails.map(err => err.message)
    });
  }

  try {
    // Create transporter
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Add connection timeout and socket timeout
      connectionTimeout: 10000, // 10 seconds
      socketTimeout: 10000, // 10 seconds
    });

    // Verify transporter configuration
    await transporter.verify();

    logger.info('SMTP connection verified', {
      requestId: req.id,
      smtpHost: process.env.SMTP_HOST
    });

    // Enhanced email HTML template
    const htmlTemplate = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <title>WalletLogs - Verification Code</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); }
          .header { background: linear-gradient(135deg, #2563EB, #059669); padding: 30px; text-align: center; }
          .logo { color: white; font-size: 28px; font-weight: bold; margin-bottom: 10px; }
          .header-text { color: white; font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .otp-box { background: linear-gradient(135deg, #f8fafc, #e2e8f0); border: 2px solid #2563EB; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0; }
          .otp-code { font-size: 36px; font-weight: bold; color: #2563EB; letter-spacing: 8px; margin: 20px 0; font-family: monospace; }
          .warning { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0; color: #991b1b; }
          .footer { background: #f8fafc; padding: 20px; text-align: center; color: #6b7280; font-size: 14px; border-top: 1px solid #e5e7eb; }
          .security-tips { background: #f0f9ff; border: 1px solid #0ea5e9; border-radius: 8px; padding: 15px; margin: 20px 0; color: #0c4a6e; }
          @media only screen and (max-width: 600px) {
            .container { width: 100% !important; }
            .content { padding: 20px !important; }
            .otp-code { font-size: 28px !important; letter-spacing: 4px !important; }
          }
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
            
            <div class="security-tips">
              <strong>🛡️ Security Tips:</strong>
              <ul style="margin: 10px 0; padding-left: 20px; line-height: 1.5;">
                <li>Only enter this code on the official WalletLogs website</li>
                <li>WalletLogs staff will never ask for your verification code</li>
                <li>If you didn't request this code, please secure your account immediately</li>
              </ul>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              If you didn't request this code, please ignore this email or contact our support team at support@walletlogs.com
            </p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} WalletLogs. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
            <p style="margin-top: 10px; font-size: 12px;">Request ID: ${req.id}</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Send email with enhanced options
    const mailOptions = {
      from: `"WalletLogs Security" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "🔐 Your WalletLogs Verification Code",
      text: `Your WalletLogs verification code is: ${otp}. This code will expire in 5 minutes. Never share this code with anyone. Request ID: ${req.id}`,
      html: htmlTemplate,
      headers: {
        'X-Request-ID': req.id,
        'X-Priority': '1', // High priority
        'X-MSMail-Priority': 'High'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    const processingTime = Date.now() - startTime;

    logger.info('OTP email sent successfully', {
      requestId: req.id,
      email: email,
      messageId: info.messageId,
      processingTime: `${processingTime}ms`,
      smtpResponse: info.response
    });
    
    res.json({ 
      success: true, 
      message: 'OTP sent successfully',
      timestamp: new Date().toISOString(),
      requestId: req.id
    });
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    logger.error('Failed to send OTP email', {
      requestId: req.id,
      email: email,
      error: error.message,
      stack: error.stack,
      processingTime: `${processingTime}ms`,
      smtpHost: process.env.SMTP_HOST
    });
    
    // Don't expose internal error details to client
    res.status(500).json({ 
      success: false, 
      error: 'Failed to send verification email. Please try again.',
      requestId: req.id,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * Handle 404 for unknown routes
 */
app.use('*', (req, res) => {
  logger.warn('404 - Route not found', {
    requestId: req.id,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found',
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
});

/**
 * Enhanced error handling middleware
 */
app.use((error, req, res, next) => {
  logger.error('Unhandled application error', {
    requestId: req.id,
    error: error.message,
    stack: error.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  res.status(500).json({ 
    success: false, 
    error: 'Internal server error',
    requestId: req.id,
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
let server;

/**
 * Graceful shutdown handling
 */
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}, starting graceful shutdown`);
  
  if (server) {
    server.close((err) => {
      if (err) {
        logger.error('Error during server close', { error: err.message });
        process.exit(1);
      }
      
      logger.info('Server closed successfully');
      process.exit(0);
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
      logger.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

// Register shutdown handlers
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack
  });
  gracefulShutdown('uncaughtException');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason.toString(),
    promise: promise.toString()
  });
  gracefulShutdown('unhandledRejection');
});

/**
 * Start the server
 */
server = app.listen(PORT, () => {
  logger.info('🚀 WalletLogs OTP Backend started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    smtpUser: process.env.SMTP_USER,
    version: process.env.npm_package_version || '1.0.0'
  });
  
  console.log(`🚀 OTP Email Backend running on port ${PORT}`);
  console.log(`📧 SMTP configured for: ${process.env.SMTP_USER}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`🛡️ Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;