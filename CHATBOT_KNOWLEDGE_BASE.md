# Trackla Chatbot Knowledge Base

## Complete Field-by-Field Guide

### SUBSCRIPTION FORM FIELDS

**Service Name** (Required)
- What: Name of the subscription service
- Must be unique (no duplicates allowed)
- Error shown if duplicate exists
- Can add from: Subscriptions page → + Add Subscription

**Vendor** (Dropdown with search)
- What: Company providing the service
- Can search and filter
- Click "+ New" at bottom to add new vendor
- Redirects to Configuration → Vendors tab
- Pre-populated with 90+ popular vendors

**Website**
- What: URL of the service website
- Optional field
- Helps track service details

**Currency** (Dropdown with search)
- What: Currency for payment
- Can search and filter
- Click "+ New" at bottom to add new currency
- Redirects to Configuration → Currencies tab
- Supports multi-currency with exchange rates

**Quantity**
- What: Number of licenses/units
- Must be at least 1
- Used to calculate total amount
- Formula: Total = Quantity × Amount per unit

**Amount per Unit**
- What: Cost per license/unit
- Numeric field
- Auto-calculates total when changed

**Total Amount**
- What: Total subscription cost
- Auto-calculated: Quantity × Amount per unit
- Can be manually edited
- Used for LCY conversion

**LCY Amount** (Auto-calculated, Read-only)
- What: Local Currency equivalent
- Automatically converts using exchange rate
- Only shows if currency differs from company default
- Updates when total amount or currency changes

**Tax Amount**
- What: Tax/VAT amount
- Optional
- Added to total for final amount

**Total Amount Incl Tax** (Auto-calculated)
- What: Total + Tax
- Read-only
- Shows final payable amount

**Start Date** (Date picker)
- What: When subscription begins
- Required
- Used to calculate renewal dates

**Billing Cycle** (Dropdown)
- Options: Monthly, Yearly, Quarterly, Weekly, Trial, Pay-as-you-go
- Required
- Determines renewal frequency

**Next Renewal Date** (Auto-calculated)
- Calculated based on Start Date + Billing Cycle
- Can be manually overridden
- Used for renewal reminders

**Reminder Days**
- What: Days before renewal to send reminder
- Numeric field
- Triggers email/WhatsApp notifications

**Responsible Person** (Searchable dropdown)
- What: Employee who manages this subscription
- Search by name or email
- Click "+ New" to add employee
- Redirects to Company Details → Employees

**Secondary Person** (Searchable dropdown)
- What: Backup person
- Same functionality as Responsible Person
- Optional

**Department** (Multi-select dropdown)
- What: Which department(s) use this
- Can select multiple
- "Company Level" = all departments
- Click "+ New" to add department
- Redirects to Company Details → Departments

**Category** (Dropdown)
- What: Type of subscription
- Examples: Cloud Services, Software Licenses
- Click "+ New" to add category
- Redirects to Company Details → Categories

**Status** (Dropdown)
- Options: Active, Trial, Draft, Cancelled
- Active = Currently in use
- Trial = Testing period
- Draft = Planned but not started
- Cancelled = No longer used

**Notes**
- What: Additional information
- Text area
- Optional
- Useful for special terms or conditions

**Documents**
- What: Attach files (contracts, invoices)
- Click "Documents" button in header
- Upload multiple files
- View/download anytime

---

### RENEWAL/LICENSE FORM FIELDS

**Renewal Name/Title** (Required)
- What: Name of the license/permit
- Must be unique
- Example: "Business License", "Work Permit"

**Entity Owner**
- What: Legal entity that owns the license
- Optional

**Category**
- What: Type of renewal
- Click "+ New" to add
- Helps organize renewals

**Beneficiary Type**
- What: Who benefits from the license
- Optional

**Beneficiary Name/No**
- What: Beneficiary details
- Optional

**Issuing Authority** (Dropdown)
- What: Government body issuing the license
- Pre-populated with Singapore authorities:
  - ACRA, MOM, NEA, SPF, SCDF, BCA, SFA, etc.
- Searchable

**Issue Date** (Date picker)
- What: When license was issued
- Required
- Must be before expiry date

**Expiry Date** (Date picker)
- What: When license expires
- Required
- Must be after issue date
- Used for renewal reminders

**Details**
- What: License description
- Text area
- Optional

**Renewal Fee**
- What: Cost to renew
- Numeric field
- Required

**Currency**
- What: Currency for renewal fee
- Same as subscription currency field
- Can add new via "+ New"

**LCY Amount** (Auto-calculated)
- What: Local currency equivalent
- Auto-converts using exchange rate

**Renewal Cycle Time**
- What: How often to renew
- Example: "Annually", "Every 2 years"

**Renewal Lead Time Estimated**
- What: Days needed to process renewal
- Helps plan ahead

**Responsible Person** (Searchable)
- What: Employee managing renewal
- Same as subscription field

**Secondary Person**
- What: Backup person
- Optional

**Department** (Multi-select)
- What: Which department(s) need this
- Same as subscription field

**Status** (Dropdown)
- Options: Active, Expired, Cancelled
- Active = Currently valid
- Expired = Past expiry date
- Cancelled = No longer needed

**Issuing Authority Email**
- What: Contact email
- Validated format
- Multiple validation rules

**Issuing Authority Phone**
- What: Contact phone
- Optional

**Reminder Days**
- What: Days before expiry to remind
- Numeric field
- Triggers notifications

**Reminder Policy**
- What: How to send reminders
- Options configured in Setup

**Renewal Status** (Dropdown)
- Options:
  - Renewal Initiated
  - Application Submitted
  - Amendments/Appeal Submitted
  - Resubmitted
  - Rejected
  - Cancelled
  - Approved
- Tracks renewal progress

**Expected Completed Date**
- What: When renewal should be done
- Must be after Renewal Initiated Date

**Renewal Initiated Date**
- What: When renewal process started
- Optional

**Submitted By**
- What: Who submitted the renewal
- Optional

**Renewal Amount**
- What: Actual renewal cost
- May differ from estimated fee

**Renewal Status Reason**
- What: Why status changed
- Text field
- Required for Rejected/Cancelled

**Renewal Attachments**
- What: Upload documents
- Multiple files supported
- View/download anytime

---

### COMPLIANCE FORM FIELDS

**Compliance Item Name** (Required)
- What: Name of compliance requirement
- Must be unique

**Description**
- What: Details about requirement
- Text area

**Due Date** (Date picker)
- What: When compliance is due
- Required
- Used for reminders

**Status** (Dropdown)
- Options: Pending, Completed, Overdue
- Auto-updates based on due date

**Responsible Person**
- Same as other forms

**Department**
- Same as other forms

**Documents**
- Attach compliance evidence

---

### COMPANY DETAILS TABS

**1. Employees Tab**
- Add Employee button
- Fields:
  - Name (required)
  - Email (required, validated)
  - Role (dropdown):
    - Super Admin: Full access + user management
    - Admin: Full access except users
    - Viewer: Read-only all
    - Contributor: Create/manage own items
    - Department Editor: Edit in their dept
    - Department Viewer: Read-only their dept
  - Department (optional)
- Edit/Delete employees
- Search and filter

**2. Departments Tab**
- Add Department button
- Fields:
  - Department Name (required)
  - Visible (toggle)
- Edit/Delete departments
- Used across all modules

**3. Categories Tab**
- Add Category button
- Fields:
  - Category Name (required)
- Edit/Delete categories
- For subscription organization

**4. Currencies Tab**
- Add Currency button
- Fields:
  - Currency Code (required, e.g., USD, EUR)
  - Exchange Rate (required, numeric)
- Edit/Delete currencies
- Used for multi-currency tracking

**5. Vendors Tab**
- Add Vendor button
- Fields:
  - Vendor Name (required)
- Edit/Delete vendors
- Pre-populated with 90+ vendors

---

### CONFIGURATION PAGE TABS

**1. Reminder Policy Tab**
- Configure notification settings
- Set default reminder days
- Email/WhatsApp preferences

**2. Payment Methods Tab**
- Add payment methods
- Track payment options

**3. Vendors Tab**
- Same as Company Details → Vendors
- Manage vendor list

---

### COMMON FEATURES ACROSS ALL PAGES

**Search**
- Search box at top
- Searches across all fields
- Real-time filtering

**Filters**
- Status filters (Active, Trial, Draft, etc.)
- Department filters
- Date range filters
- Category filters

**Sort**
- Click column headers to sort
- Ascending/Descending toggle
- Multiple column support

**Export**
- Export to Excel
- Downloads current filtered data
- Includes all fields

**Import**
- Import from Excel
- Download template first
- Bulk add items
- Validates data

**Actions per Row**
- Edit icon (pencil)
- Delete icon (trash)
- View details
- Quick actions

---

### NAVIGATION & UI

**Sidebar Menu**
- Dashboard: Overview and stats
- Subscriptions: Manage subscriptions
- Compliance: Track compliance
- Renewals: Government licenses
- Notifications: View alerts
- Setup & Configuration: Settings
- Company Details: Company settings
- History: Audit log

**Company Switcher**
- Top of sidebar
- Shows current company name
- Shuffle icon (⇄) to switch
- Click to open company list
- Select different company

**User Menu**
- Top right corner
- Profile settings
- Logout

---

### NOTIFICATIONS & REMINDERS

**Email Notifications**
- Sent X days before renewal
- Configurable in Setup
- Goes to responsible person

**WhatsApp Notifications**
- Same as email
- Requires WhatsApp setup
- Instant delivery

**In-App Notifications**
- Bell icon in header
- Shows upcoming renewals
- Click to view details

---

### AUDIT & HISTORY

**Renewal History Log**
- Shows all changes
- Who made change
- When changed
- What was modified
- Action type (Created/Updated/Deleted)
- Searchable and filterable

**Subscription History**
- Similar to renewal history
- Tracks subscription changes
- Complete audit trail

---

### MULTI-COMPANY SUPPORT

**How it Works**
- One login, multiple companies
- Switch via company switcher
- Separate data per company
- Consolidated view available

**Switching Companies**
1. Look at top of sidebar
2. See current company name
3. Click shuffle icon or company name
4. Select company from list
5. View updates automatically

---

### IMPORT/EXPORT

**Export Process**
1. Go to any page (Subscriptions, Renewals, etc.)
2. Click Export button
3. Choose format (Excel)
4. Download file
5. Contains current filtered data

**Import Process**
1. Click Import button
2. Download template
3. Fill in Excel file
4. Upload filled template
5. System validates data
6. Imports successfully

**Template Fields**
- All required fields marked
- Examples provided
- Validation rules listed
- Instructions included

---

### TROUBLESHOOTING

**Common Issues**

1. **Can't add subscription - duplicate name**
   - Solution: Use unique service name
   - Or edit existing subscription

2. **Currency not showing**
   - Solution: Add currency first
   - Go to Company Details → Currencies
   - Or click "+ New" in currency dropdown

3. **Employee not in list**
   - Solution: Add employee first
   - Go to Company Details → Employees
   - Or click "+ New" in person dropdown

4. **Department not showing**
   - Solution: Check if visible
   - Go to Company Details → Departments
   - Toggle visibility on

5. **Reminders not working**
   - Solution: Check Setup & Configuration
   - Verify email/WhatsApp settings
   - Check reminder days set

6. **Can't switch company**
   - Solution: Check permissions
   - Verify you have access to multiple companies
   - Contact admin if needed

7. **Import failing**
   - Solution: Check template format
   - Verify all required fields filled
   - Check for duplicate names
   - Ensure dates in correct format

8. **LCY amount not calculating**
   - Solution: Check exchange rate set
   - Verify currency selected
   - Ensure total amount entered

---

### BEST PRACTICES

**Subscriptions**
- Use clear, unique service names
- Set reminder days (30-60 days recommended)
- Assign responsible persons
- Add documents for reference
- Keep notes updated

**Renewals**
- Set reminders well in advance
- Upload supporting documents
- Track renewal status
- Update promptly when renewed
- Keep contact info current

**Departments**
- Create logical structure
- Use consistent naming
- Assign appropriately
- Review periodically

**Users**
- Assign correct roles
- Use department assignments
- Keep email addresses current
- Review permissions regularly

**Data Management**
- Export regularly for backup
- Use import for bulk operations
- Keep data clean and updated
- Archive old subscriptions

---

### KEYBOARD SHORTCUTS

- Enter: Submit form
- Esc: Close modal
- Tab: Navigate fields
- Ctrl+S: Save (in forms)

---

### MOBILE RESPONSIVENESS

- All pages work on mobile
- Touch-friendly interface
- Responsive tables
- Mobile-optimized forms

---

### SECURITY & PERMISSIONS

**Role-Based Access**
- Super Admin: Everything
- Admin: All except user management
- Viewer: Read-only
- Contributor: Own items only
- Department Editor: Department items
- Department Viewer: Department read-only

**Data Security**
- Encrypted connections
- Secure authentication
- Audit trails
- Access controls

---

### SUPPORT & HELP

**Getting Help**
- Use this chatbot
- Visit www.tracklahub.com
- Contact support team
- Check documentation

**Common Questions**
- How to add X? → Use "+ Add X" button
- Where is X? → Check sidebar menu
- Can I do X? → Check your role permissions
- Why isn't X working? → Check troubleshooting section
