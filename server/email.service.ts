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

    console.log('🔧 Email service configuration:');
    console.log(`   Host: ${config.host}`);
    console.log(`   Port: ${config.port}`);
    console.log(`   User: ${config.auth.user}`);
    console.log(`   Pass: ${config.auth.pass ? '***HIDDEN***' : 'NOT_SET'}`);

    if (config.auth.user && config.auth.pass) {
      try {
        // Nodemailer exposes `createTransport`, not `createTransporter`
        this.transporter = nodemailer.createTransport(config);
        this.isConfigured = true;
        console.log('✅ Email service configured successfully');
      } catch (error) {
        console.error('❌ Error setting up email transporter:', error);
        this.isConfigured = false;
      }
    } else {
      console.warn('❌ Email service not configured. SMTP_USER or SMTP_PASS missing.');
      console.log(`   SMTP_USER: ${process.env.SMTP_USER || 'NOT_SET'}`);
      console.log(`   SMTP_PASS: ${process.env.SMTP_PASS ? 'SET' : 'NOT_SET'}`);
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
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f4f7fb; 
            line-height: 1.6;
          }
          .container { 
            max-width: 900px; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 16px; 
            overflow: hidden; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.08); 
          }
          .content { padding: 40px; }
          .greeting { 
            font-size: 28px; 
            margin-bottom: 12px; 
            color: #1a202c;
            font-weight: 700;
          }
          .intro-text {
            font-size: 15px;
            color: #64748b;
            margin-bottom: 32px;
          }
          .intro-text a {
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
          }
          
          /* Table Styles */
          .table-container {
            border: 3px solid #a8c5e8;
            border-radius: 12px;
            overflow: hidden;
            margin: 24px 0;
            max-width: 100%;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Inter', sans-serif;
            table-layout: fixed;
          }
          thead {
            background: #5b9cf7;
          }
          thead th {
            color: white;
            font-weight: 600;
            font-size: 11px;
            text-align: left;
            padding: 4px 4px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-right: 3px solid #a8c5e8;
          }
          thead th:last-child {
            border-right: none;
          }
          thead th:nth-child(1) {
            width: 22%;
          }
          thead th:nth-child(2) {
            width: 22%;
          }
          thead th:nth-child(3) {
            width: 24%;
          }
          thead th:nth-child(4) {
            width: 16%;
          }
          thead th:nth-child(5) {
            width: 16%;
          }
          tbody tr {
            border-bottom: 3px solid #a8c5e8;
            transition: background-color 0.15s;
          }
          tbody tr:last-child {
            border-bottom: none;
          }
          tbody tr:hover {
            background-color: #f8fafc;
          }
          tbody td {
            padding: 4px 4px;
            font-size: 13px;
            color: #334155;
            border-right: 3px solid #a8c5e8;
          }
          tbody td:last-child {
            border-right: none;
          }
          .service-cell {
            font-weight: 600;
            color: #1e293b;
            font-size: 14px;
          }
          .amount {
            font-weight: 700;
            color: #000000;
            font-size: 16px;
            white-space: nowrap;
          }
          .renewal-date {
            color: #dc2626;
            font-weight: 600;
            font-size: 13px;
          }
          .days-remaining {
            color: #64748b;
            font-size: 11px;
            margin-top: 2px;
          }
          .category-badge {
            color: #64748b;
            font-size: 12px;
            font-weight: 400;
            background: #f1f5f9;
            padding: 4px 10px;
            border-radius: 8px;
            display: inline-block;
          }
          
          /* Summary Section */
          .summary-container {
            display: flex;
            gap: 20px;
            margin: 32px 0;
          }
          .summary-box { 
            flex: 1;
            background: #f8fafc;
            border-radius: 12px; 
            padding: 24px; 
            border: 1px solid #e2e8f0;
          }
          .summary-label {
            font-size: 13px;
            color: #64748b;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }
          .summary-value {
            font-size: 32px;
            font-weight: 700;
            color: #3b82f6;
            line-height: 1.2;
          }
          .summary-subtitle {
            font-size: 13px;
            color: #64748b;
            margin-top: 4px;
          }
          
          /* Responsive */
          @media only screen and (max-width: 600px) {
            .content { padding: 24px; }
            .summary-container { flex-direction: column; }
            table { font-size: 12px; }
            thead th { padding: 12px 12px; font-size: 10px; }
            tbody td { padding: 14px 12px; }
            .amount { font-size: 16px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="content">
            <div class="greeting">Hello ${recipientName},</div>
            <div class="intro-text">
              This is your monthly active subscription in <strong style="color: #3b82f6;">${nextMonth}</strong>
            </div>
            
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SERVICE</th>
                    <th>AMOUNT</th>
                    <th>RENEWAL DATE</th>
                    <th>DEPARTMENT</th>
                    <th>CATEGORY</th>
                  </tr>
                </thead>
                <tbody>
                  ${subscriptions.map(sub => {
                    const renewalDate = new Date(sub.nextRenewal);
                    
                    // Format amount with commas
                    const amount = parseFloat(sub.amount || 0);
                    const formattedAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    
                    // Handle departments
                    let departmentText = '-';
                    if (sub.departments && Array.isArray(sub.departments) && sub.departments.length > 0) {
                      departmentText = sub.departments.join(', ');
                    }
                    
                    return `
                    <tr>
                      <td>
                        <div class="service-cell">${sub.serviceName}</div>
                      </td>
                      <td>
                        <div class="amount">${sub.currency || 'USD'} ${formattedAmount}</div>
                      </td>
                      <td>
                        <div class="renewal-date">${renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </td>
                      <td>
                        <div class="category-badge">${departmentText}</div>
                      </td>
                      <td>
                        <div class="category-badge">${sub.category || 'General'}</div>
                      </td>
                    </tr>
                  `}).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateAdminSummaryEmailHTML(ownerSummaries: any[], totalCount: number, monthName: string): string {
    // Flatten all subscriptions into one array with owner info
    const allSubscriptions = ownerSummaries.flatMap(owner => 
      owner.subscriptions.map((sub: any) => ({
        ...sub,
        ownerName: owner.ownerName,
        ownerEmail: owner.ownerEmail
      }))
    );
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Admin Summary - Monthly Subscription Reminders</title>
        <link rel="preconnect" href="https://fonts.googleapis.com">
        <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
            margin: 0; 
            padding: 20px; 
            background-color: #f4f7fb; 
            line-height: 1.6;
          }
          .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background-color: white; 
            border-radius: 16px; 
            overflow: hidden; 
            box-shadow: 0 2px 8px rgba(0,0,0,0.08); 
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 24px;
            text-align: center;
          }
          .header h1 {
            font-size: 24px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .header p {
            font-size: 14px;
            opacity: 0.9;
          }
          .content { padding: 32px 24px; }
          .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 32px;
            text-align: center;
          }
          .summary-card h2 {
            font-size: 36px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .summary-card p {
            font-size: 14px;
            opacity: 0.9;
          }
          .table-container {
            border: 3px solid #a8c5e8;
            border-radius: 12px;
            overflow: hidden;
            margin: 24px 0;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            font-family: 'Inter', sans-serif;
          }
          thead {
            background: #5b9cf7;
          }
          thead th {
            color: white;
            font-weight: 600;
            font-size: 11px;
            text-align: left;
            padding: 8px 6px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-right: 3px solid #a8c5e8;
          }
          thead th:last-child {
            border-right: none;
          }
          tbody tr {
            border-bottom: 3px solid #a8c5e8;
            transition: background-color 0.15s;
          }
          tbody tr:last-child {
            border-bottom: none;
          }
          tbody tr:hover {
            background-color: #f8fafc;
          }
          tbody td {
            padding: 8px 6px;
            font-size: 13px;
            color: #334155;
            border-right: 3px solid #a8c5e8;
          }
          tbody td:last-child {
            border-right: none;
          }
          .service-cell {
            font-weight: 600;
            color: #1e293b;
            font-size: 14px;
          }
          .amount {
            font-weight: 700;
            color: #000000;
            font-size: 15px;
            white-space: nowrap;
          }
          .renewal-date {
            color: #dc2626;
            font-weight: 600;
            font-size: 13px;
          }
          .category-badge {
            color: #64748b;
            font-size: 12px;
            font-weight: 500;
            background: #f1f5f9;
            padding: 4px 10px;
            border-radius: 6px;
            display: inline-block;
          }
          .owner-name {
            font-weight: 600;
            color: #1e293b;
            font-size: 13px;
          }
          .footer { 
            background-color: #f7fafc; 
            padding: 20px; 
            text-align: center; 
            font-size: 12px; 
            color: #64748b; 
            border-top: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📊 Admin Summary - Monthly Reminders</h1>
            <p>Subscription renewals for ${monthName}</p>
          </div>
          
          <div class="content">
            <div class="summary-card">
              <h2>${totalCount}</h2>
              <p>Total Subscriptions Renewing in ${monthName}</p>
            </div>
            
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th>SERVICE NAME</th>
                    <th>AMOUNT</th>
                    <th>RENEWAL DATE</th>
                    <th>CATEGORY</th>
                    <th>DEPARTMENT</th>
                    <th>OWNER NAME</th>
                  </tr>
                </thead>
                <tbody>
                  ${allSubscriptions.map((sub: any) => {
                    const renewalDate = new Date(sub.nextRenewal);
                    const amount = parseFloat(sub.amount || 0);
                    const formattedAmount = amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    
                    // Handle departments - check both departments and department fields
                    let departmentText = '-';
                    if (sub.departments && Array.isArray(sub.departments) && sub.departments.length > 0) {
                      departmentText = sub.departments.join(', ');
                    } else if (sub.department && Array.isArray(sub.department) && sub.department.length > 0) {
                      departmentText = sub.department.join(', ');
                    } else if (typeof sub.departments === 'string' && sub.departments) {
                      departmentText = sub.departments;
                    } else if (typeof sub.department === 'string' && sub.department) {
                      departmentText = sub.department;
                    }
                    
                    return `
                      <tr>
                        <td><div class="service-cell">${sub.serviceName}</div></td>
                        <td><div class="amount">${sub.currency || 'USD'} ${formattedAmount}</div></td>
                        <td><div class="renewal-date">${renewalDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div></td>
                        <td><div class="category-badge">${sub.category || 'General'}</div></td>
                        <td><div class="category-badge">${departmentText}</div></td>
                        <td><div class="owner-name">${sub.ownerName}</div></td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="footer">
            <p><strong>SubsTracker Admin Notification</strong></p>
            <p style="margin-top: 8px;">This summary was automatically generated and sent to all administrators.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  // Send department head notification email
  async sendDepartmentHeadNotification(
    departmentName: string, 
    departmentHeadName: string, 
    email: string,
    subscriptions: Array<{serviceName: string, nextRenewal: string, amount: number, currency: string, department?: string, category?: string}> = []
  ): Promise<boolean> {
    // Calculate next month name for subject
    const today = new Date();
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const monthName = nextMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    
    const subject = `📅 ${departmentName} Department - Subscription Renewals for ${monthName}`;
    
    // Build subscription table rows
    let subscriptionRows = '';
    if (subscriptions.length > 0) {
      subscriptions.forEach((sub) => {
        const renewalDate = new Date(sub.nextRenewal).toLocaleDateString('en-US', { 
          day: '2-digit', 
          month: 'short', 
          year: 'numeric' 
        });
        
        // Show only the specific department (not all departments)
        // Since we filtered by this department, just show this department name
        const deptDisplay = departmentName;
        
        subscriptionRows += `
          <tr style="border-bottom: 1px solid #e0e7ff;">
            <td style="padding: 14px 12px; color: #1e293b; font-size: 14px; font-weight: 500;">${sub.serviceName}</td>
            <td style="padding: 14px 12px; color: #1e293b; font-size: 14px; font-weight: 600;">${sub.currency} ${sub.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            <td style="padding: 14px 12px; color: #dc2626; font-size: 14px; font-weight: 500;">${renewalDate}</td>
            <td style="padding: 14px 12px; color: #64748b; font-size: 13px;">${deptDisplay}</td>
            <td style="padding: 14px 12px; color: #64748b; font-size: 13px;">${sub.category || '-'}</td>
          </tr>
        `;
      });
    } else {
      subscriptionRows = `
        <tr>
          <td colspan="5" style="padding: 24px; text-align: center; color: #94a3b8; font-size: 14px;">
            No subscriptions renewing in ${monthName} for this department.
          </td>
        </tr>
      `;
    }
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 800px; margin: 40px auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.07);">
          <!-- Header with gradient -->
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: bold;">
              📅 ${departmentName} Department - Renewals for ${monthName}
            </h1>
          </div>
          
          <!-- Content -->
          <div style="padding: 40px 30px;">
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 16px 0;">
              Hello <strong>${departmentHeadName}</strong>,
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
              As the <strong>Head of the ${departmentName} Department</strong>, here are your subscriptions renewing in <strong>${monthName}</strong>:
            </p>
            
            <!-- Subscriptions Table -->
            <div style="margin: 32px 0;">
              <h2 style="color: #667eea; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
                Upcoming Renewals (${subscriptions.length})
              </h2>
              <div style="overflow-x: auto; border-radius: 8px; border: 1px solid #e2e8f0;">
                <table style="width: 100%; border-collapse: collapse; background-color: #ffffff;">
                  <thead>
                    <tr style="background: linear-gradient(to right, #3b82f6, #2563eb);">
                      <th style="padding: 16px 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">SERVICE</th>
                      <th style="padding: 16px 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">AMOUNT</th>
                      <th style="padding: 16px 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">RENEWAL DATE</th>
                      <th style="padding: 16px 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">DEPARTMENT</th>
                      <th style="padding: 16px 12px; text-align: left; color: #ffffff; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">CATEGORY</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${subscriptionRows}
                  </tbody>
                </table>
              </div>
            </div>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 24px 0;">
              As the department head, please ensure these subscriptions are properly managed and renewed on time.
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
              If you have any questions or need assistance, please contact your administrator.
            </p>
            
            <p style="color: #334155; font-size: 16px; line-height: 1.6; margin: 0;">
              Best regards,<br>
              <strong>Subscription Management System</strong>
            </p>
          </div>
          
          <!-- Footer -->
          <div style="background-color: #f8fafc; padding: 20px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              This is an automated notification. Please do not reply to this email.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendEmail({ to: email, subject, html });
  }
}

export const emailService = new EmailService();