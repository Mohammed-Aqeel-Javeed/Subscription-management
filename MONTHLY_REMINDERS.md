# Monthly Email Reminders System

This system automatically sends email reminders to subscription owners on the 25th of every month, alerting them about subscriptions that will renew in the following month.

## Features

- **Automated Monthly Reminders**: Runs on the 25th of every month
- **Owner-based Grouping**: Groups subscriptions by owner email and sends consolidated reminders
- **Next Month Focus**: Only includes subscriptions renewing in the upcoming month
- **Professional Email Format**: Clean, branded email template with subscription details
- **Manual Trigger**: Admin can manually trigger reminders for testing
- **Audit Trail**: Creates reminder records for tracking

## How It Works

1. **Date Check**: System checks if today is the 25th of the month
2. **Subscription Query**: Finds all subscriptions renewing next month
3. **Owner Grouping**: Groups subscriptions by owner email address
4. **Email Generation**: Creates personalized emails for each owner
5. **Email Sending**: Sends consolidated reminder emails
6. **Record Keeping**: Logs reminder records in the database

## Setup Instructions

### 1. Email Configuration (Optional - currently logs to console)

To enable actual email sending, you'll need to configure SMTP settings:

```bash
# Add these environment variables to your .env file
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=your-email@gmail.com
APP_URL=https://your-subscription-tracker.com
```

### 2. Install Dependencies (if using email service)

```bash
npm install nodemailer
npm install @types/nodemailer --save-dev
```

### 3. Set Up Daily Cron Job

Add this to your server's crontab to run daily at 9 AM:

```bash
# Edit crontab
crontab -e

# Add this line (adjust paths as needed)
0 9 * * * /usr/bin/node /path/to/your/project/scripts/dailyReminderCheck.js
```

### 4. Manual Testing

You can test the system manually using the API endpoints:

```bash
# Check if today is the 25th and run reminders if so
curl http://localhost:5000/api/monthly-reminders/check

# Manually trigger reminders (ignores date check)
curl -X POST http://localhost:5000/api/monthly-reminders/trigger
```

## API Endpoints

### GET /api/monthly-reminders/check
Checks if today is the 25th and runs reminders if so.

**Response:**
```json
{
  "shouldRun": true,
  "result": {
    "success": true,
    "message": "Monthly reminders processed successfully",
    "data": {
      "renewals": [...],
      "emailsSent": 2,
      "emailResults": [...]
    }
  }
}
```

### POST /api/monthly-reminders/trigger
Manually triggers monthly reminders regardless of the date.

**Response:**
```json
{
  "success": true,
  "message": "Monthly reminders processed successfully",
  "data": {
    "renewals": [
      {
        "id": "subscription-id",
        "serviceName": "Netflix",
        "owner": "john@company.com",
        "amount": 15.99,
        "currency": "USD",
        "nextRenewal": "2025-11-15"
      }
    ],
    "emailsSent": 1,
    "emailResults": [...]
  }
}
```

## Email Template

The system generates professional emails with:

- **Header**: Branded header with gradient background
- **Personal Greeting**: Addressed to the owner by name
- **Subscription Cards**: Each subscription displayed as a card with:
  - Service name and amount
  - Vendor information
  - Renewal date (highlighted)
  - Billing cycle and category
- **Summary**: Total renewals count and estimated amount
- **Call-to-Action**: Button to manage subscriptions
- **Footer**: Contact information and unsubscribe options

## Requirements for Subscription Owners

For the system to work properly:

1. **Owner Field**: Each subscription must have an owner assigned
2. **Email Format**: Owner can be either:
   - Direct email address (e.g., "john@company.com")
   - Employee name (system will lookup email - requires employee integration)
3. **Valid Email**: Owner email must be a valid email format
4. **Renewal Date**: Subscription must have a valid `nextRenewal` date

## Current Limitations

1. **Email Service**: Currently logs emails to console instead of sending (easily configurable)
2. **Single Tenant**: Currently processes 'default' tenant only
3. **Employee Lookup**: Name-to-email lookup not yet implemented
4. **Error Handling**: Basic error handling (can be enhanced)

## Future Enhancements

1. **Multi-tenant Support**: Process all tenants automatically
2. **Employee Integration**: Lookup employee emails by name
3. **Email Templates**: Multiple email template options
4. **Frequency Options**: Allow different reminder frequencies
5. **Notification Preferences**: Let users configure their reminder preferences
6. **WhatsApp Integration**: Add WhatsApp reminder support
7. **Email Analytics**: Track email open rates and engagement

## Troubleshooting

### Common Issues

1. **No Reminders Sent**
   - Check if subscriptions have valid owner emails
   - Verify nextRenewal dates are in the future
   - Ensure subscriptions exist for next month

2. **SMTP Errors** (if using email service)
   - Verify SMTP credentials
   - Check firewall/security settings
   - Ensure app passwords are used for Gmail

3. **Cron Job Not Running**
   - Check crontab syntax
   - Verify script permissions
   - Check system logs: `tail -f /var/log/cron`

### Debug Mode

Enable debug logging by setting:
```bash
DEBUG=monthly-reminders
```

## Example Output

When reminders are triggered, you'll see console output like:

```
📧 REMINDER EMAIL TO: john@company.com
Subject: 📅 Subscription Renewals for November 2025
Subscriptions (3):
  1. Netflix - USD 15.99 (11/15/2025)
  2. Spotify - USD 9.99 (11/20/2025)
  3. Adobe Creative Suite - USD 52.99 (11/30/2025)
Total Estimated Amount: USD 78.97
```

This system helps ensure that subscription owners are always aware of upcoming renewals, enabling better budget planning and subscription management.