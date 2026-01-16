# MarketPro CRM

A comprehensive Digital Marketing Customer Relationship Management web application featuring lead management, client tracking, sales pipeline visualization, invoicing, and team collaboration.

## Lead Capture API

The CRM provides a public API endpoint for capturing leads from external website forms. This allows you to automatically send leads from your website contact forms directly into the CRM.

### Endpoint

```
POST /api/leads/capture
```

### Request Headers

```
Content-Type: application/json
```

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Lead's full name (min 2 characters) |
| mobile | string | Yes | Mobile phone number (min 10 digits) |
| email | string | No | Email address |
| city | string | No | City/location |
| source | string | No | Lead source: `facebook`, `instagram`, `google`, `website`, `referral` (default: `website`) |
| notes | string | No | Additional notes or message from the form |
| campaignId | string | No | Campaign ID if tracking specific campaigns |

### Example Request

```javascript
fetch('https://your-crm-domain.com/api/leads/capture', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    name: 'John Doe',
    mobile: '9876543210',
    email: 'john@example.com',
    city: 'Mumbai',
    source: 'website',
    notes: 'Interested in digital marketing services'
  })
})
.then(response => response.json())
.then(data => {
  if (data.success) {
    console.log('Lead captured:', data.leadId);
  } else {
    console.error('Error:', data.message);
  }
});
```

### Response Codes

| Status | Description |
|--------|-------------|
| 201 | Lead created successfully |
| 400 | Validation error (missing/invalid fields) |
| 409 | Duplicate lead (mobile or email already exists) |
| 500 | Server error |

### Success Response (201)

```json
{
  "success": true,
  "message": "Lead captured successfully",
  "leadId": "uuid-of-created-lead"
}
```

### Validation Error Response (400)

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    {
      "field": "name",
      "message": "Name must be at least 2 characters"
    },
    {
      "field": "mobile",
      "message": "Mobile must be at least 10 digits"
    }
  ]
}
```

### Duplicate Lead Response (409)

```json
{
  "success": false,
  "message": "A lead with this mobile number or email already exists",
  "leadId": "existing-lead-uuid"
}
```

## HTML Form Integration Example

Here's a complete example of integrating the lead capture API with an HTML form:

```html
<form id="contact-form">
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="tel" name="mobile" placeholder="Mobile Number" required>
  <input type="email" name="email" placeholder="Email Address">
  <input type="text" name="city" placeholder="City">
  <textarea name="notes" placeholder="Your Message"></textarea>
  <button type="submit">Submit</button>
</form>

<script>
document.getElementById('contact-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData(e.target);
  const data = {
    name: formData.get('name'),
    mobile: formData.get('mobile'),
    email: formData.get('email'),
    city: formData.get('city'),
    notes: formData.get('notes'),
    source: 'website'
  };
  
  try {
    const response = await fetch('https://your-crm-domain.com/api/leads/capture', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Thank you! We will contact you soon.');
      e.target.reset();
    } else if (response.status === 409) {
      alert('You have already submitted an inquiry. We will contact you soon.');
    } else {
      alert('Please check your information and try again.');
    }
  } catch (error) {
    alert('Something went wrong. Please try again later.');
  }
});
</script>
```

## CORS Note

If your website is on a different domain than the CRM, you may need to configure CORS settings on the CRM server to allow cross-origin requests from your website domain.

## Features

- Lead Management with duplicate prevention
- Follow-up tracking with calendar view
- Sales Pipeline (Kanban board)
- Client Management with service assignments
- Invoicing with recurring billing
- Quotations with editable packages
- WhatsApp integration
- PDF generation
- Payment tracking
- Team collaboration with role-based access
- Campaign tracking
- Task management
- Reports and analytics
- Client portal

## Default Login

- Email: admin@crm.com
- Password: admin123

---

## QA Report

### Working Features

- **Authentication & Authorization**
  - Session-based login/logout with secure password hashing
  - Role-based access control (Admin, Manager, Sales, Support, Client)
  - Protected routes with automatic redirect to login
  - Client portal access for client role users

- **Lead Management**
  - Create, edit, delete leads with validation
  - Duplicate prevention by mobile/email
  - Status and source filtering
  - Search functionality
  - Pagination with sorting
  - CSV bulk import with row-level validation
  - CSV export with filter support
  - WhatsApp integration (wa.me links)

- **Lead Capture API**
  - Public POST endpoint for external forms
  - Zod validation with detailed error messages
  - Duplicate prevention
  - Proper JSON responses (201/400/409/500)

- **Follow-up Management**
  - Schedule follow-ups with leads
  - Calendar view with month navigation
  - List view with missed/today/upcoming sections
  - Mark as complete functionality
  - ICS export for Google Calendar integration

- **Sales Pipeline**
  - Kanban board with drag-and-drop
  - Visual status columns (New, Contacted, Qualified, etc.)
  - Lead cards with contact info

- **Client Management**
  - Convert leads to clients
  - Service assignment
  - Client details with contact info

- **Invoicing System**
  - Create invoices with line items
  - Recurring billing support (monthly, 1-28 day)
  - Status tracking (draft, sent, paid, overdue)
  - PDF generation

- **Quotations**
  - Editable packages (Basic/Standard/Premium)
  - Package templates with customization
  - Convert quotation to invoice

- **Payment Tracking**
  - Record payments against invoices
  - Payment method tracking
  - Validation of payment amounts

- **Campaign Management**
  - Create marketing campaigns
  - Track leads by campaign
  - Budget and date tracking

- **Task Management**
  - Create tasks linked to leads/clients
  - Priority and status tracking
  - Due date management
  - Filter by status

- **Team Management**
  - Add team members with role assignment
  - Active/inactive status
  - Role-based permissions

- **Reports & Analytics**
  - Lead conversion metrics
  - Revenue tracking
  - Source analysis charts
  - Monthly trends

- **UI/UX**
  - Professional corporate design
  - Dark/light mode toggle
  - Responsive mobile layout
  - Loading states on all pages
  - Empty states with guidance
  - Toast notifications
  - Confirmation dialogs for destructive actions

### Fixed During QA

- Follow-up creation date parsing (string to Date conversion)
- ICS export RFC5545 character escaping
- Route protection for unauthorized URL access
- Logout redirect clearing auth state properly

### Known Limitations

- **PDF Generation**: Requires browser print dialog (no server-side PDF)
- **Email Sending**: Not implemented (would require email service integration)
- **Real-time Updates**: No WebSocket/SSE (requires page refresh for updates)
- **File Uploads**: No attachment support for leads/clients
- **Calendar Sync**: One-way ICS export only (no two-way sync)
- **Recurring Invoices**: Manual generation required (no auto-creation)
- **Multi-tenant**: Single organization only
- **Audit Log**: No activity logging for compliance
- **Backup/Restore**: No built-in data backup functionality
