/*
  Generates a professional, multi-page Trackla Getting Started PDF for the landing page.
  Output: client/public/docs/Trackla-Getting-Started-Guide.pdf

  No external deps; writes a minimal PDF (Type1 Helvetica/Helvetica-Bold).
*/

const fs = require('fs');
const path = require('path');

function sanitizePdfText(input) {
  // This generator uses Type1 Helvetica without custom encodings.
  // Keep text ASCII-ish to avoid "missing glyph" boxes in some viewers.
  return String(input ?? '')
    .replace(/\u2022/g, '-') // bullet
    .replace(/[\u2013\u2014]/g, '-') // en/em dash
    .replace(/[\u2018\u2019]/g, "'") // smart single quotes
    .replace(/[\u201C\u201D]/g, '"') // smart double quotes
    .replace(/\u00A0/g, ' ') // NBSP
    .replace(/\s+/g, ' ')
    .trimEnd();
}

function escapePdfString(input) {
  const safe = sanitizePdfText(input);
  return safe
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');
}

function wrapLine(text, maxChars) {
  const raw = sanitizePdfText(text).replace(/\s+/g, ' ').trim();
  if (!raw) return [''];
  if (raw.length <= maxChars) return [raw];

  const words = raw.split(' ');
  const lines = [];
  let current = '';
  for (const w of words) {
    if (!current) {
      current = w;
      continue;
    }
    if ((current + ' ' + w).length <= maxChars) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function wrapLines(items, maxChars) {
  const out = [];
  for (const item of items) {
    const s = String(item ?? '');
    if (!s.trim()) {
      out.push('');
      continue;
    }
    out.push(...wrapLine(s, maxChars));
  }
  return out;
}

function textBlock(lines, options) {
  const {
    x = 54,
    y = 740,
    font = '/F1',
    fontSize = 11,
    leading = 14,
  } = options || {};

  const ops = [];
  ops.push('BT');
  ops.push(`${font} ${fontSize} Tf`);
  ops.push(`${leading} TL`);
  ops.push(`${x} ${y} Td`);

  for (let i = 0; i < lines.length; i++) {
    const line = escapePdfString(lines[i]);
    ops.push(`(${line}) Tj`);
    if (i !== lines.length - 1) ops.push('T*');
  }

  ops.push('ET');
  return ops.join('\n') + '\n';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function isLikelySubheading(line) {
  const s = String(line ?? '').trim();
  if (!s) return false;
  if (s.startsWith('•') || s.startsWith('-') || s.startsWith('*')) return false;
  // Treat short numbered section headers as subheadings (but not long step instructions)
  if (s.match(/^\d+\)\s+/) && s.length <= 40) return true;
  if (s.match(/^\d+[\).]/)) return false;
  if (s.length > 40) return false;
  // Titles like “Identity”, “Financials”, “Best practice”, “Checklist”
  return !/[.]/.test(s);
}

function drawTextLine(text, options) {
  const { x, y, font = '/F1', fontSize = 11 } = options || {};
  const line = escapePdfString(text);
  return `BT\n${font} ${fontSize} Tf\n${x} ${y} Td\n(${line}) Tj\nET\n`;
}

function renderStyledBody(lines, options) {
  const {
    x = 54,
    y = 718,
    maxY = 58,
    lineLeading = 14,
    bulletIndent = 16,
  } = options || {};

  let cursorY = y;
  const ops = [];

  for (const raw of lines) {
    const line = String(raw ?? '');
    if (!line.trim()) {
      cursorY -= lineLeading;
      if (cursorY < maxY) break;
      continue;
    }

    const trimmed = line.trim();
    const isBullet = trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*');
    const subheading = isLikelySubheading(trimmed);

    const useFont = subheading ? '/F2' : '/F1';
    const useSize = subheading ? 12 : 11;
    const useLead = subheading ? 16 : lineLeading;
    const useX = isBullet ? x + bulletIndent : x;

    ops.push(drawTextLine(trimmed, { x: useX, y: cursorY, font: useFont, fontSize: useSize }));
    cursorY -= useLead;
    if (cursorY < maxY) break;
  }

  return { ops: ops.join(''), endY: cursorY };
}

function buildPageContent({ title, lines, pageNumber, pageCount }) {
  const safeTitle = String(title || '').trim();
  const ops = [];

  // Header band
  ops.push('q\n0.94 g\n0 756 612 36 re\nf\nQ\n');
  // Title
  if (safeTitle) {
    ops.push(drawTextLine(safeTitle, { x: 54, y: 770, font: '/F2', fontSize: 16 }));
  }

  // Body
  const bodyStartY = safeTitle ? 732 : 740;
  const { ops: bodyOps } = renderStyledBody(lines, { x: 54, y: bodyStartY, maxY: 70, lineLeading: 14, bulletIndent: 18 });
  ops.push(bodyOps);

  // Footer separator + page number
  ops.push('q\n0.85 g\n54 52 m\n558 52 l\nS\nQ\n');
  ops.push(drawTextLine(`Page ${pageNumber} of ${pageCount}`, { x: 54, y: 36, font: '/F1', fontSize: 9 }));

  return ops.join('');
}

function paginatePages(pages, { maxLinesPerPageWithTitle = 46, maxLinesPerPageNoTitle = 50 } = {}) {
  const out = [];
  for (const page of pages) {
    const title = String(page.title || '').trim();
    const lines = Array.isArray(page.lines) ? page.lines : [];
    const maxLines = title ? maxLinesPerPageWithTitle : maxLinesPerPageNoTitle;

    // Chunk by lines; preserve empty lines.
    let i = 0;
    let part = 0;
    while (i < lines.length) {
      const chunk = lines.slice(i, i + maxLines);
      out.push({ title, lines: chunk });
      i += maxLines;
      part += 1;
    }
    if (lines.length === 0) out.push({ title, lines: [] });
  }
  return out;
}

function buildPdf({ pages }) {
  // PDF building with classic xref
  const objects = [];
  const addObject = (body) => {
    objects.push(body);
    return objects.length; // 1-based index
  };

  // Font
  const fontRegularObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const fontBoldObj = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  // Pages tree placeholder
  const pagesPlaceholderIndex = addObject('');

  const pageObjIds = [];
  const pageCount = pages.length;
  for (let idx = 0; idx < pages.length; idx++) {
    const page = pages[idx];
    const title = String(page.title || '').trim();
    const bodyLines = Array.isArray(page.lines) ? page.lines : [];

    const content = buildPageContent({
      title,
      lines: bodyLines,
      pageNumber: idx + 1,
      pageCount,
    });

    const contentObj = addObject(`<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}endstream`);
    const pageObj = addObject(
      `<< /Type /Page /Parent ${pagesPlaceholderIndex} 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ${fontRegularObj} 0 R /F2 ${fontBoldObj} 0 R >> >> /Contents ${contentObj} 0 R >>`
    );
    pageObjIds.push(pageObj);
  }

  // Fill Pages object
  objects[pagesPlaceholderIndex - 1] = `<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjIds.length} >>`;

  const catalogObj = addObject(`<< /Type /Catalog /Pages ${pagesPlaceholderIndex} 0 R >>`);

  // Assemble file
  const header = '%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n';
  let body = '';
  const offsets = [0]; // object 0 offset

  let offset = Buffer.byteLength(header, 'utf8');
  for (let i = 0; i < objects.length; i++) {
    const objNum = i + 1;
    const chunk = `${objNum} 0 obj\n${objects[i]}\nendobj\n`;
    offsets[objNum] = offset;
    body += chunk;
    offset += Buffer.byteLength(chunk, 'utf8');
  }

  const xrefStart = offset;
  let xref = 'xref\n';
  xref += `0 ${objects.length + 1}\n`;
  xref += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    const off = offsets[i] || 0;
    xref += String(off).padStart(10, '0') + ' 00000 n \n';
  }

  const trailer =
    `trailer\n<< /Size ${objects.length + 1} /Root ${catalogObj} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return header + body + xref + trailer;
}

function main() {
  const output = path.resolve(__dirname, '..', 'client', 'public', 'docs', 'Trackla-Getting-Started-Guide.pdf');
  fs.mkdirSync(path.dirname(output), { recursive: true });

  const maxChars = 92;

  const pages = [];

  pages.push({
    title: 'Trackla - Getting Started Guide',
    lines: wrapLines(
      [
        'Version: May 2026',
        'A practical guide to set up your company, onboard users, and run renewals reliably.',
        'Table of Contents',
        '1. Trackla at a Glance',
        '2. Accounts, Company, and Access',
        '3. Subscriptions (Fields + Best Practices)',
        '4. Reminders and Notifications',
        '5. Auto Renewal (How it works + How to test)',
        '6. Import/Export',
        '7. Setup & Configuration',
        '8. Company Details',
        '9. Notifications',
        '10. Reports',
        '11. Compliance / Renewals',
        '12. History Log (Audit Trail)',
        '13. Troubleshooting',
        'Quick Start Checklist',
        '• Confirm Company Name and LCY (local currency).',
        '• Add users and assign roles (Viewer / Contributor / Admin).',
        '• Set up Payment Methods and any Custom Fields you need.',
        '• Add your first subscription and set Next Renewal (YYYY-MM-DD).',
      ],
      maxChars
    ),
  });

  // Body content flows continuously across pages (no "one section = one page").
  pages.push({
    title: 'Trackla - Getting Started Guide',
    lines: wrapLines(
      [
        '1) Trackla at a Glance',
        'Trackla helps you track subscriptions, control spend, and never miss renewals.',
        'Core pages',
        '• Dashboard: spend overview, trends, and quick access to what needs attention.',
        '• Subscriptions: create/edit subscriptions, manage renewal dates, reminder policies, and auto-renewal.',
        '• Notifications: in-app reminders generated from subscription dates and compliance schedules.',
        '• Reports: analytics and audit reporting across subscriptions and spend.',
        '• Setup & Configuration: currencies, payment methods, custom fields, and related setup.',
        '• Company Details: company profile, departments, employees, and user management.',
        '• Compliance / Renewals: track policy/filing/licence dates and set reminder schedules.',
        'Important data concept',
        '• Next Renewal: the key date used for reminders and auto-renewal.',
        '',
        '2) Accounts, Company, and Access',
        'Company and currency',
        '• Company Name: displayed across the app and in the sidebar company selector.',
        '• LCY (Local Currency): used for normalized reporting and LCY Amount calculations.',
        'Switch Company',
        '• If your user has access to multiple companies, use the company selector in the sidebar to switch.',
        '• Switching changes the active tenant context (data shown across the app).',
        'User Management (roles)',
        '• System Admin / Global Admin: full access (may switch across tenants if enabled).',
        '• Contributor: can create and update subscriptions and related data based on permissions.',
        '• Viewer: read-only access to pages and reports.',
        'Best practice',
        '• Keep Owner and Owner Email accurate for accountability and audits.',
        '',
        '3) Subscriptions (Fields + Best Practices)',
        'Use these fields to keep renewal operations and reporting clean:',
        'Identity',
        '• Subscription Name (Service Name): the primary label used throughout the app.',
        '• Vendor: the supplier/provider of the subscription.',
        '• Website: vendor link for quick access to billing/admin portals.',
        '• Category: used for grouping and reporting.',
        '• Department(s): used for cost allocation and reporting.',
        '• Owner / Owner Email: internal responsibility (use real owners for audit clarity).',
        'Financials',
        '• Currency: billing currency for the subscription.',
        '• Amount: unit price for a single license/unit.',
        '• Qty: number of units (licenses/seats).',
        '• Total Amount: Amount × Qty (may be stored/derived depending on workflow).',
        '• LCY Amount: normalized amount in LCY for consolidated reporting.',
        '• Payment Method: how this subscription is paid (card/bank/etc).',
        'Renewal schedule',
        '• Billing Cycle: Monthly / Quarterly / Yearly / Weekly (affects auto-renew calculations).',
        '• Start Date: current cycle start date.',
        '• Next Renewal: current cycle end date (the date Trackla uses for reminders and auto-renewal).',
        'Status and control',
        '• Status: Active/Inactive (ensure Active for reminders and renewal operations).',
        '• Auto Renewal: enable only if you want Trackla to renew automatically on the Next Renewal date.',
        '• Notes: store key contract information, renewal terms, or approval context.',
        '',
        '4) Reminders and Notifications',
        'Trackla supports configurable reminder policies:',
        'Reminder Days',
        '• Number of days before Next Renewal that reminders should begin.',
        'Reminder Policy',
        '• One time: creates a single reminder at (Next Renewal - Reminder Days).',
        '• Two times: creates two reminders at (Next Renewal - Reminder Days) and at about half that distance.',
        '• Until Renewal: creates daily reminders from (Next Renewal - Reminder Days) through Next Renewal.',
        'Notifications page',
        '• Shows upcoming reminders and alerts created by subscriptions and compliance schedules.',
        '• Use it as an operational inbox for renewals and follow-ups.',
        '',
        '5) Auto Renewal (How it works + How to test)',
        'How it works',
        '• Auto Renewal triggers when Auto Renewal is enabled AND Next Renewal equals today (UTC date).',
        '• When triggered, Trackla renews the subscription by setting Start Date to today and advancing Next Renewal based on Billing Cycle.',
        '• A history entry is created with Changed By = System (Auto-Renewal).',
        'How to test (recommended)',
        '1) Pick a subscription and set Auto Renewal = ON.',
        '2) Set Next Renewal to today in YYYY-MM-DD format (example: 2026-05-20).',
        '3) Ensure Status is Active.',
        '4) Restart the backend once OR wait for the midnight (IST) scheduled job.',
        '5) Verify Start Date updated to today and Next Renewal moved forward correctly.',
        '6) Check Subscription History for an “Auto Renewed” entry and date range change.',
        'Note',
        '• If Next Renewal is not a valid date, auto renewal will not trigger.',
        '',
        '6) Import/Export',
        'Import/Export helps you onboard quickly and keep data consistent.',
        'Import tips',
        '• Use a consistent date format (YYYY-MM-DD) for Start Date and Next Renewal.',
        '• Ensure required identity fields (Subscription Name, Vendor) are present.',
        '• Validate currency codes (USD, EUR, SGD, etc.) and Qty values.',
        '• If you import departments, use consistent naming to avoid duplicates in reports.',
        'Export tips',
        '• Export is useful for audits, reconciliations, and bulk edits.',
        '• After re-importing, review Subscription History to confirm changes were applied as expected.',
        '',
        '7) Setup & Configuration',
        'Setup & Configuration is where you define the building blocks used across subscriptions and reports.',
        'Currency',
        '• Maintain the list of currencies used for subscription billing.',
        '• LCY is your primary reporting currency.',
        'Payment Methods',
        '• Add and manage payment methods (cards/bank accounts) used by subscriptions.',
        '• Keep expiry dates accurate if you track payment expiry alerts.',
        'Custom Fields',
        '• Use custom fields to capture organization-specific data (Cost Center, Contract ID, etc.).',
        '• Keep naming consistent so imports and reports remain clean.',
        '',
        '8) Company Details',
        'Company Details centralizes company-level data used throughout Trackla.',
        'Company Information',
        '• Company Name and key profile details for the tenant.',
        'Department',
        '• Define departments for spend allocation and access workflows.',
        'Employees',
        '• Maintain employees for ownership assignments and reporting.',
        'User Management',
        '• Add users, set roles, and confirm who has access to the tenant.',
        '',
        '9) Notifications',
        'Notifications are generated from subscription reminder rules and compliance schedules.',
        'What you will see',
        '• Upcoming renewals and reminder types (One time / Two times / Daily).',
        '• Compliance-related reminders if you use Compliance / Renewals.',
        'Best practice',
        '• Treat Notifications as a daily inbox for renewals and follow-ups.',
        '',
        '10) Reports',
        'Reports provide visibility into spend and change history:',
        'Common report outcomes',
        '• Spend analysis by vendor, category, department, or period.',
        '• Trend views to spot growth in recurring spend.',
        '• Audit-history style reports to review who changed what and when.',
        'Best practice',
        '• Keep departments and categories consistent for clean reporting.',
        '',
        '11) Compliance / Renewals',
        'Compliance and Renewals help you track deadlines beyond subscriptions (policies, filings, licences).',
        'What to set',
        '• Submission/renewal deadlines (date-only fields).',
        '• Reminder policy and reminder days similar to subscriptions.',
        'Outcome',
        '• Notifications are generated so teams never miss important compliance deadlines.',
        '',
        '12) History Log (Audit Trail)',
        'Subscription History records key changes over time.',
        'You will see',
        '• Who changed it (Changed By).',
        '• What changed (field-by-field changes).',
        '• When it changed (Updated On).',
        'Auto Renewal entries',
        '• Display as Auto Renewed and show the date range change.',
        '• If you only see date lines, confirm the record is detected as a renewal and that auto-renewal is enabled.',
        '',
        '13) Troubleshooting',
        'If reminders or auto-renewal do not work as expected:',
        'Checklist',
        '• Confirm the subscription is Active.',
        '• Confirm Next Renewal is a valid date in YYYY-MM-DD format.',
        '• Confirm Reminder Policy and Reminder Days are set.',
        '• Confirm Auto Renewal is enabled (for auto-renew behavior).',
        '• Check Subscription History for changes and whether a renewal was logged.',
        'Support',
        '• Use Contact Support (WhatsApp) from the Help section in the landing page.',
      ],
      maxChars
    ),
  });

  const normalizedPages = paginatePages(pages, {
    maxLinesPerPageWithTitle: 46,
    maxLinesPerPageNoTitle: 50,
  });

  const pdf = buildPdf({ pages: normalizedPages });
  fs.writeFileSync(output, pdf, 'binary');
  console.log(`Generated: ${output}`);
}

if (require.main === module) {
  main();
}
