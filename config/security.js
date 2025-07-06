/**
 * Security configuration for production environment
 */

/**
 * Get CORS configuration based on environment
 * @returns {object} CORS configuration object
 */
function getCorsConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (isProduction) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS 
      ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
      : ['https://walletlogs.com', 'https://www.walletlogs.com'];
    
    return {
      origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
      optionsSuccessStatus: 200,
      methods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
    };
  }
  
  // Development configuration - more permissive
  return {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID']
  };
}

/**
 * Get Helmet security configuration
 * @returns {object} Helmet configuration object
 */
function getHelmetConfig() {
  return {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false, // Allow embedding for email clients
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    }
  };
}

/**
 * Get rate limiting configuration based on environment
 * @returns {object} Rate limiting configuration
 */
function getRateLimitConfig() {
  const isProduction = process.env.NODE_ENV === 'production';
  
  return {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || (isProduction ? 15 * 60 * 1000 : 60 * 1000), // 15 minutes in prod, 1 minute in dev
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || (isProduction ? 10 : 5), // 10 requests per window in prod, 5 in dev
    message: {
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      // Skip rate limiting for health checks
      return req.path === '/health';
    }
  };
}

module.exports = {
  getCorsConfig,
  getHelmetConfig,
  getRateLimitConfig
};