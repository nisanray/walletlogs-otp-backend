# WalletLogs OTP Backend Service

Production-ready email OTP service for WalletLogs 2FA authentication with enhanced security, monitoring, and production features.

## Features

### 🔒 Security Enhancements
- **Helmet.js** - Security headers and protection against common vulnerabilities
- **Enhanced CORS** - Environment-specific CORS configuration
- **Robust Rate Limiting** - Express-rate-limit with configurable windows and limits
- **Input Validation** - Comprehensive validation using express-validator
- **Request ID Tracking** - Unique request IDs for tracking and debugging

### 📊 Monitoring and Logging
- **Structured Logging** - Winston logger with file rotation and levels
- **Request Logging** - Morgan middleware for HTTP request logging
- **Enhanced Health Check** - Detailed health endpoint with system information
- **Error Tracking** - Comprehensive error logging with stack traces

### 🚀 Production Features
- **Environment-specific Configuration** - Different settings for dev/prod
- **Graceful Shutdown** - Proper handling of SIGTERM and SIGINT signals
- **Response Compression** - Gzip compression for better performance
- **Better Email Templates** - Enhanced HTML email templates with security tips
- **Connection Timeouts** - SMTP connection and socket timeouts

### 📝 Code Quality
- **JSDoc Documentation** - Comprehensive function and API documentation
- **Error Handling** - Improved error handling without exposing internal details
- **Modular Configuration** - Separated configuration files for better organization

## API Endpoints

### Health Check
```
GET /health
```

**Response:**
```json
{
  "status": "OK",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "uptime": 3600.123,
  "environment": "production",
  "version": "1.0.0",
  "requestId": "req-123456789"
}
```

### Send OTP
```
POST /send-otp
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully",
  "timestamp": "2024-01-20T10:30:00.000Z",
  "requestId": "req-123456789"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Validation failed",
  "details": ["Email and OTP are required"],
  "requestId": "req-123456789",
  "timestamp": "2024-01-20T10:30:00.000Z"
}
```

## Environment Variables

### Required
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port (default: 465)
- `SMTP_USER` - SMTP username
- `SMTP_PASS` - SMTP password

### Optional
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment (development/production)
- `LOG_LEVEL` - Logging level (default: info)
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins for CORS
- `RATE_LIMIT_WINDOW_MS` - Rate limit window in milliseconds
- `RATE_LIMIT_MAX_REQUESTS` - Maximum requests per window

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with required environment variables
4. Start the server:
   ```bash
   # Development
   npm run dev
   
   # Production
   npm run prod
   ```

## Scripts

- `npm start` - Start the server
- `npm run dev` - Start with nodemon for development
- `npm run prod` - Start in production mode
- `npm run logs` - Tail combined logs
- `npm run logs:error` - Tail error logs

## Security Configuration

### Rate Limiting
- **Development**: 5 requests per minute per IP
- **Production**: 10 requests per 15 minutes per IP

### CORS
- **Development**: Allow all origins
- **Production**: Only allow configured origins from `ALLOWED_ORIGINS`

### Logging
- All requests are logged with request IDs
- Errors are logged with full stack traces
- Logs are rotated (5MB max, 5 files)
- Console logging in development, file logging in production

## Monitoring

### Health Check
The `/health` endpoint provides:
- Service status
- Uptime information
- Environment details
- Memory usage (development only)
- Request ID for tracking

### Request Tracking
Every request gets a unique ID that is:
- Logged in all relevant log entries
- Returned in API responses
- Added to email headers
- Used for tracing requests across the system

## Error Handling

The service implements comprehensive error handling:
- Input validation errors with detailed messages
- SMTP connection and timeout errors
- Rate limiting with retry information
- 404 handling for unknown routes
- Global error handling for unexpected errors
- Graceful shutdown on process signals

## Production Deployment

1. Set `NODE_ENV=production`
2. Configure all required environment variables
3. Set up proper CORS origins in `ALLOWED_ORIGINS`
4. Configure appropriate rate limiting values
5. Set up log monitoring and rotation
6. Configure reverse proxy (nginx) if needed
7. Set up health check monitoring

## Backward Compatibility

This enhanced version maintains full backward compatibility with the original API:
- All existing endpoints work exactly as before
- Response formats are unchanged (with addition of optional fields)
- No breaking changes to the API contract

## License

MIT