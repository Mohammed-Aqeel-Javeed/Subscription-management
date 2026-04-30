export const VENDOR_LIST: string[] = [
  "Microsoft Corporation", "Amazon Web Services, Inc.", "Google LLC", "Salesforce, Inc.", "Adobe Inc.",
  "Oracle Corporation", "SAP SE", "International Business Machines Corporation (IBM)", "ServiceNow, Inc.",
  "Atlassian Corporation", "Zoom Video Communications, Inc.", "Slack Technologies, LLC (Salesforce)",
  "Dropbox, Inc.", "Box, Inc.", "DocuSign, Inc.", "HubSpot, Inc.", "Canva Pty Ltd", "Shopify Inc.",
  "Snowflake Inc.", "Twilio Inc.", "VMware, Inc. (Broadcom)", "Cisco Systems, Inc.", "Dell Technologies Inc.",
  "Hewlett Packard Enterprise Company", "Citrix Systems, Inc.", "Palo Alto Networks, Inc.",
  "CrowdStrike Holdings, Inc.", "Fortinet, Inc.", "Zscaler, Inc.", "Cloudflare, Inc.", "Okta, Inc.",
  "Tenable Holdings, Inc.", "Rapid7, Inc.", "Splunk Inc.", "Proofpoint, Inc.", "CyberArk Software Ltd.",
  "Trend Micro Incorporated", "McAfee, LLC", "Sophos Ltd.", "SentinelOne, Inc.",
  "Check Point Software Technologies Ltd.", "Mandiant (Google)", "Rubrik, Inc.", "Veeam Software",
  "Commvault Systems, Inc.", "Intuit Inc.", "Stripe, Inc.", "PayPal Holdings, Inc.", "Block, Inc. (Square)",
  "Xero Limited", "The Sage Group plc", "Fiserv, Inc.", "Fidelity National Information Services, Inc. (FIS)",
  "Bill.com Holdings, Inc.", "Expensify, Inc.", "Coupa Software Inc.", "Brex Inc.", "Ramp Business Corporation",
  "Adyen N.V.", "Plaid Inc.", "Automatic Data Processing, Inc. (ADP)", "Workday, Inc.", "Paychex, Inc.",
  "Paycom Software, Inc.", "Ceridian HCM Holding Inc. (Dayforce)", "UKG Inc. (Ultimate Kronos Group)",
  "BambooHR LLC", "Rippling People Center Inc.", "Gusto, Inc.", "Deel, Inc.", "Robert Half International Inc.",
  "Cornerstone OnDemand, Inc.", "Leidos Holdings, Inc.", "Northrop Grumman Corporation",
  "General Dynamics Corporation", "Raytheon Technologies Corporation (RTX)", "Booz Allen Hamilton Holding Corporation",
  "Science Applications International Corporation (SAIC)", "CACI International Inc", "Palantir Technologies Inc.",
  "Tyler Technologies, Inc.", "Carahsoft Technology Corp.", "Crayon Group Holding ASA (Acquirer of Rhipe)",
  "Ingram Micro Inc.", "Pax8, Inc.", "TD SYNNEX Corporation", "Arrow Electronics, Inc. (Arrow ECS)",
  "Dicker Data Limited", "Sherweb Inc.", "AppDirect, Inc.", "Insight Enterprises, Inc.", "SoftwareOne AG",
  "CDW Corporation", "SHI International Corp.", "Zendesk, Inc.", "Freshworks Inc.", "Intercom, Inc.",
  "Qualtrics, LLC", "SurveyMonkey (Momentive Global Inc.)", "Hootsuite Inc.", "Sprout Social, Inc.",
  "Semrush Holdings, Inc.", "Ahrefs Pte. Ltd.", "Moz, Inc.", "Braze, Inc.", "Klaviyo, Inc.",
  "ActiveCampaign, LLC", "Constant Contact, Inc.", "Mailchimp (Intuit Inc.)", "Typeform SL",
  "Drift.com, Inc.", "Pipedrive Inc.", "Zoho Corporation Pvt. Ltd.", "Yotpo Ltd.", "Trustpilot Group plc",
  "G2.com, Inc.", "Cision Ltd.", "Meltwater B.V.", "Sprinklr, Inc.", "Datadog, Inc.", "New Relic, Inc.",
  "Dynatrace, Inc.", "PagerDuty, Inc.", "HashiCorp, Inc.", "JFrog Ltd.", "DigitalOcean Holdings, Inc.",
  "Akamai Technologies, Inc.", "F5, Inc.", "Juniper Networks, Inc.", "Arista Networks, Inc.", "NetApp, Inc.",
  "Pure Storage, Inc.", "Red Hat, Inc. (IBM)", "SUSE S.A.", "Canonical Ltd. (Ubuntu)", "Docker, Inc.",
  "Elastic N.V.", "MongoDB, Inc.", "Redis, Inc.", "Couchbase, Inc.", "GitHub, Inc. (Microsoft)",
  "GitLab Inc.", "JetBrains s.r.o.", "Postman, Inc.", "OpenAI, L.L.C.", "Anthropic, PBC",
  "Databricks, Inc.", "Glean Technologies, Inc.", "Harvey AI, Inc.", "Hebbia, Inc.", "Waabi Innovation Inc.",
  "Weaviate B.V.", "Writer, Inc.", "NVIDIA Corporation", "Siemens AG", "Sift Science, Inc.",
  "Scale AI, Inc.", "Hugging Face, Inc.", "Jasper AI, Inc.", "Netflix, Inc.", "Disney+",
  "Amazon Prime Video", "Apple TV+", "Spotify Technology S.A.", "YouTube Premium", "Singtel",
  "StarHub Ltd", "M1 Limited", "Grab Holdings Ltd", "Sea Limited", "Tableau Software, LLC (Salesforce)",
  "QlikTech International AB", "MicroStrategy Incorporated", "Asana, Inc.", "Monday.com Ltd",
  "Smartsheet Inc.", "Notion Labs, Inc.", "Trello (Atlassian)", "Basecamp, LLC", "Figma, Inc.",
  "Sketch B.V.", "InVisionApp Inc.", "Miro (RealtimeBoard Inc.)", "Lucid Software Inc.", "Shutterstock, Inc.",
  "Getty Images Holdings, Inc.", "Envato Pty Ltd", "Webflow, Inc.", "Squarespace, Inc.", "Wix.com Ltd.",
  "GoDaddy Inc.", "Namecheap, Inc.", "Bluehost Inc. (Newfold Digital)", "SiteGround Hosting Ltd.",
  "WP Engine, Inc.", "1Password", "LastPass", "Dashlane", "NordVPN", "ExpressVPN"
];

export const DEFAULT_CATEGORY_LIST: string[] = [
  'Productivity & Collaboration',
  'Accounting & Finance',
  'CRM & Sales',
  'Development & Hosting',
  'Design & Creative Tools',
  'Marketing & SEO',
  'Communication Tools',
  'Security & Compliance',
  'HR & Admin',
  'Subscription Infrastructure',
  'Office Infrastructure'
];

export const DEFAULT_DEPARTMENT_LIST: string[] = [
  'IT',
  'Finance',
  'Marketing',
  'Sales',
  'HR',
  'Operations'
];

export const DEFAULT_PAYMENT_METHOD_LIST: string[] = [
  'Corporate Visa',
  'Corporate MasterCard',
  'Bank Transfer',
  'PayPal',
  'Apple Pay',
  'Google Pay',
  'Cash',
  'Other'
];

export type DefaultEmployee = { name: string; email: string };

export const DEFAULT_EMPLOYEES: DefaultEmployee[] = [
  { name: 'John Doe', email: 'john@company.com' },
  { name: 'Jane Smith', email: 'jane@company.com' }
];
