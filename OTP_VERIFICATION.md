# Email OTP Verification System

## Overview
This system implements a secure email verification process using One-Time Passwords (OTP) during user signup.

## How It Works

### User Flow:
1. **Step 1: Enter Email**
   - User enters their email address
   - System validates email format
   - Checks if email is already registered

2. **Step 2: Receive & Verify OTP**
   - System generates a 6-digit OTP
   - OTP is sent to the user's email
   - OTP expires in 10 minutes
   - User enters the OTP to verify their email

3. **Step 3: Complete Signup**
   - After email verification, user enters:
     - Full name
     - Password (with strong policy enforcement)
     - Confirm password
   - Account is created with verified email

## Security Features

### Email Validation:
- Proper email format with valid domain
- Domain must have valid TLD (at least 2 characters)
- Local part validation (max 64 characters)

### Password Policy:
- Minimum 8 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character (!@#$%^&*)
- Password is hashed with bcrypt before storage

### OTP Security:
- 6-digit random OTP
- Expires after 10 minutes
- One-time use only (marked as used after verification)
- Cleaned up after successful signup
- Old OTPs (>24 hours) automatically cleaned up

## API Endpoints

### POST /api/send-otp
```json
Request:
{
  "email": "user@example.com"
}

Response (Success):
{
  "message": "OTP sent successfully to your email"
}
```

### POST /api/verify-otp
```json
Request:
{
  "email": "user@example.com",
  "otp": "123456"
}

Response (Success):
{
  "message": "Email verified successfully"
}
```

### POST /api/signup
```json
Request:
{
  "fullName": "John Doe",
  "email": "user@example.com",
  "password": "SecurePass123!",
  "tenantId": "tenant-xyz123"
}

Response (Success):
{
  "message": "Signup successful"
}
```

## Database Collections

### otps Collection
```json
{
  "email": "user@example.com",
  "otp": "123456",
  "expiresAt": "2025-11-18T10:30:00Z",
  "createdAt": "2025-11-18T10:20:00Z",
  "verified": false,
  "verifiedAt": null
}
```

## Email Configuration

Set these environment variables in your `.env` file:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@yourapp.com
```

### Gmail Setup (Recommended):
1. Enable 2-Factor Authentication in your Google Account
2. Generate an App Password: https://myaccount.google.com/apppasswords
3. Use the app password as `SMTP_PASS`

## Maintenance

### Cleanup Script
Run periodically to remove expired OTPs:
```bash
node scripts/cleanupOTPs.js
```

This removes:
- Expired OTPs (past expiration time)
- Old OTPs (>24 hours, regardless of status)

## Development Mode

If email service is not configured, the system will:
- Still generate and store OTPs
- Log OTP to console for testing
- Return OTP in response (only in development mode)

## Testing

1. **Without Email Service:**
   - Check server console for OTP
   - Use the logged OTP for verification

2. **With Email Service:**
   - Enter real email address
   - Check email inbox for OTP
   - Enter OTP within 10 minutes

## Error Handling

Common errors and solutions:

- **"Invalid email format"**: Check email follows proper format
- **"Email already registered"**: Use different email or login
- **"OTP expired"**: Request new OTP
- **"Invalid OTP"**: Check for typos, request new OTP if needed
- **"Email not verified"**: Complete OTP verification first
- **"Password does not meet security requirements"**: Follow password policy
