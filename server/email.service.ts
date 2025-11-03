import nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EmailData {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.setupTransporter();
  }

  private setupTransporter() {
    // Default configuration - should be moved to environment variables
    const config: EmailConfig = {
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    };

    if (config.auth.user && config.auth.pass) {
      // Nodemailer exposes `createTransport`, not `createTransporter`
      this.transporter = nodemailer.createTransport(config);
      this.isConfigured = true;
      console.log('Email service configured successfully');
    } else {
      console.warn('Email service not configured. Set SMTP_* environment variables to enable email sending.');
    }
  }

  async sendEmail(emailData: EmailData): Promise<boolean> {
    if (!this.isConfigured || !this.transporter) {
      console.log('📧 EMAIL SERVICE NOT CONFIGURED - Would send email to:', emailData.to);
      console.log('Subject:', emailData.subject);
      return false;
    }

    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  generateReminderEmailHTML(subscriptions: any[], recipientName: string, nextMonth: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Subscription Renewals Reminder</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background-color: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
          .content { padding: 30px 20px; }
          .greeting { font-size: 16px; margin-bottom: 20px; color: #333; }
          .subscription-card { border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 16px; padding: 16px; background-color: #fafafa; }
          .subscription-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
          .service-name { font-weight: 600; font-size: 16px; color: #1a202c; }
          .amount { font-weight: 600; font-size: 16px; color: #38a169; }
          .subscription-details { font-size: 14px; color: #718096; line-height: 1.5; }
          .renewal-date { font-weight: 500; color: #e53e3e; }
          .footer { background-color: #f7fafc; padding: 20px; text-align: center; font-size: 12px; color: #718096; border-top: 1px solid #e2e8f0; }
          .cta-button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
          .summary { background-color: #edf2f7; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .total-amount { font-size: 18px; font-weight: 600; color: #2d3748; text-align: center; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📅 Subscription Renewals Reminder</h1>
          </div>
          <div class="content">
            <div class="greeting">
              Hello ${recipientName},
            </div>
            <p>This is your monthly reminder for subscriptions renewing in <strong>${nextMonth}</strong>.</p>
            
            ${subscriptions.map(sub => `
              <div class="subscription-card">
                <div class="subscription-header">
                  <div class="service-name">${sub.serviceName}</div>
                  <div class="amount">${sub.currency || 'USD'} ${parseFloat(sub.amount || 0).toFixed(2)}</div>
                </div>
                <div class="subscription-details">
                  <div><strong>Vendor:</strong> ${sub.vendor || 'N/A'}</div>
                  <div><strong>Renewal Date:</strong> <span class="renewal-date">${new Date(sub.nextRenewal).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span></div>
                  <div><strong>Billing Cycle:</strong> ${sub.billingCycle || 'Monthly'}</div>
                  ${sub.category ? `<div><strong>Category:</strong> ${sub.category}</div>` : ''}
                </div>
              </div>
            `).join('')}
            
            <div class="summary">
              <div class="total-amount">
                Total Renewals: ${subscriptions.length} subscription${subscriptions.length !== 1 ? 's' : ''}<br>
                Estimated Amount: ${subscriptions.reduce((total, sub) => total + (parseFloat(sub.amount || 0)), 0).toFixed(2)} ${subscriptions[0]?.currency || 'USD'}
              </div>
            </div>
            
            <div style="text-align: center;">
              <a href="${process.env.APP_URL || 'https://your-app-url.com'}/subscriptions" class="cta-button">
                Manage Subscriptions
              </a>
            </div>
            
            <p style="margin-top: 30px; font-size: 14px; color: #718096;">
              <strong>💡 Pro Tip:</strong> Review these renewals to ensure you still need these services and check for any pricing changes.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated reminder from SubsTracker.<br>
            You're receiving this because you're the owner of these subscriptions.</p>
            <p>Need help? Contact support at support@yourcompany.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();