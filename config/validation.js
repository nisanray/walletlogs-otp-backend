/**
 * Input validation schemas using express-validator
 */
const { body } = require('express-validator');

/**
 * Validation schema for send-otp endpoint
 */
const validateSendOtp = [
  body('email')
    .isEmail()
    .withMessage('Invalid email format')
    .normalizeEmail()
    .isLength({ max: 254 })
    .withMessage('Email address too long')
    .trim(),
  
  body('otp')
    .isNumeric()
    .withMessage('OTP must contain only numbers')
    .isLength({ min: 6, max: 6 })
    .withMessage('OTP must be exactly 6 digits')
    .trim()
];

module.exports = {
  validateSendOtp
};