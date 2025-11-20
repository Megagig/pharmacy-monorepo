# Workspace Team Management Email Templates

## Overview

This document describes the email notification templates used in the Workspace Team Management system. These templates provide professional, branded communications for member management actions.

## Template Files

All email templates are located in `backend/src/templates/email/`:

1. **memberSuspension.html** - Account suspension notification
2. **memberApproval.html** - Membership approval notification
3. **memberRejection.html** - Membership rejection notification
4. **workspaceTeamInvite.html** - Team invitation email

## Template Features

### Common Features

All templates include:
- **Responsive Design**: Mobile-friendly layout that adapts to different screen sizes
- **Professional Branding**: PharmacyCopilot logo and consistent color scheme
- **Clear CTAs**: Prominent call-to-action buttons
- **Footer Links**: Support, help center, and privacy policy links
- **Accessibility**: Semantic HTML and proper contrast ratios

### Design System

- **Primary Color**: `#2563eb` (Blue)
- **Success Color**: `#10b981` (Green)
- **Warning Color**: `#f59e0b` (Amber)
- **Danger Color**: `#dc2626` (Red)
- **Font**: System fonts (-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto)

## Template Details

### 1. Member Suspension Template

**File**: `memberSuspension.html`

**Purpose**: Notifies a member that their workspace access has been suspended.

**Variables**:
```typescript
{
  firstName: string;           // Member's first name
  workspaceName: string;        // Name of the workspace
  reason: string;               // Reason for suspension
  suspendedDate: string;        // Formatted suspension date
  supportUrl: string;           // Link to support page
  privacyUrl: string;           // Link to privacy policy
}
```

**Usage**:
```typescript
await emailService.sendAccountSuspensionNotification(email, {
  firstName: 'John',
  workspaceName: 'HealthCare Pharmacy',
  reason: 'Violation of workspace policies',
  suspendedDate: new Date(),
});
```

**Key Features**:
- Red alert box highlighting the suspension
- Clear explanation of what suspension means
- Contact support CTA
- Professional and empathetic tone

---

### 2. Member Approval Template

**File**: `memberApproval.html`

**Purpose**: Welcomes a new member whose request to join has been approved.

**Variables**:
```typescript
{
  firstName: string;           // Member's first name
  workspaceName: string;        // Name of the workspace
  role: string;                 // Assigned role
  loginUrl: string;             // Link to login page
  supportUrl: string;           // Link to support page
  helpUrl: string;              // Link to help center
  privacyUrl: string;           // Link to privacy policy
}
```

**Usage**:
```typescript
await emailService.sendMemberApprovalNotification(email, {
  firstName: 'Jane',
  workspaceName: 'HealthCare Pharmacy',
  role: 'Pharmacist',
});
```

**Key Features**:
- Celebratory tone with success colors
- Gradient workspace card
- Feature grid showing available capabilities
- Step-by-step getting started guide
- Prominent "Access Workspace" button

---

### 3. Member Rejection Template

**File**: `memberRejection.html`

**Purpose**: Informs a user that their membership request was not approved.

**Variables**:
```typescript
{
  firstName: string;           // User's first name
  workspaceName: string;        // Name of the workspace
  reason: string;               // Reason for rejection (optional)
  requestDate: string;          // Formatted request date
  contactAdminUrl: string;      // Link to contact admin
  supportUrl: string;           // Link to support page
  helpUrl: string;              // Link to help center
  privacyUrl: string;           // Link to privacy policy
}
```

**Usage**:
```typescript
await emailService.sendMemberRejectionNotification(email, {
  firstName: 'Bob',
  workspaceName: 'HealthCare Pharmacy',
  reason: 'Incomplete professional credentials',
  requestDate: new Date(),
});
```

**Key Features**:
- Respectful and professional tone
- Clear explanation of the decision
- Helpful next steps
- Contact options for questions
- Disclaimer about decision authority

---

### 4. Workspace Team Invite Template

**File**: `workspaceTeamInvite.html`

**Purpose**: Invites a user to join a workspace team.

**Variables**:
```typescript
{
  inviterName: string;          // Name of person sending invite
  workspaceName: string;        // Name of the workspace
  role: string;                 // Role being offered
  inviteUrl: string;            // Signup URL with invite token
  expiresAt: string;            // Formatted expiration date/time
  personalMessage: string;      // Optional personal message
  requiresApproval: boolean;    // Whether approval is needed
  supportUrl: string;           // Link to support page
  privacyUrl: string;           // Link to privacy policy
}
```

**Usage**:
```typescript
await emailService.sendWorkspaceInviteEmail(email, {
  inviterName: 'Dr. Sarah Johnson',
  workspaceName: 'HealthCare Pharmacy',
  role: 'Pharmacy Technician',
  inviteUrl: 'https://app.com/signup?invite=abc123',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  personalMessage: 'Excited to have you join our team!',
  requiresApproval: true,
});
```

**Key Features**:
- Welcoming and inviting tone
- Gradient workspace card
- Optional personal message section
- Feature grid showing workspace capabilities
- Step-by-step join instructions
- Conditional approval warning
- Expiration notice
- Large, prominent CTA button

---

## Email Service Integration

### Service Methods

The email service (`backend/src/utils/emailService.ts`) provides these methods:

```typescript
class EmailService {
  // Suspension notification
  async sendAccountSuspensionNotification(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      reason: string;
      suspendedDate?: Date;
      supportEmail?: string;
      privacyUrl?: string;
    }
  ): Promise<EmailResult>

  // Approval notification
  async sendMemberApprovalNotification(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      role: string;
    }
  ): Promise<EmailResult>

  // Rejection notification
  async sendMemberRejectionNotification(
    email: string,
    data: {
      firstName: string;
      workspaceName: string;
      reason: string;
      requestDate?: Date;
    }
  ): Promise<EmailResult>

  // Workspace invite
  async sendWorkspaceInviteEmail(
    email: string,
    data: {
      inviterName: string;
      workspaceName: string;
      role: string;
      inviteUrl: string;
      expiresAt: Date;
      personalMessage?: string;
      requiresApproval?: boolean;
    }
  ): Promise<EmailResult>
}
```

### Template Loading

Templates are loaded using the `loadTemplate` method:

```typescript
async loadTemplate(
  templateName: string,
  variables: Record<string, any>
): Promise<EmailTemplate>
```

This method:
1. Reads the HTML template file
2. Replaces `{{variable}}` placeholders with actual values
3. Extracts the subject from the `<!-- SUBJECT: ... -->` comment
4. Generates plain text version
5. Returns formatted email template

### Variable Substitution

Templates use Handlebars-style syntax for variables:

- Simple variables: `{{firstName}}`
- Conditional blocks: `{{#if personalMessage}}...{{/if}}`
- Conditional else: `{{#if requiresApproval}}...{{else}}...{{/if}}`

## Testing

### Manual Testing

Use the test script to verify all templates:

```bash
cd backend
npm run build
node test-workspace-email-templates.js
```

### Integration Testing

Templates are automatically tested when:
1. A member is suspended
2. A member request is approved
3. A member request is rejected
4. An invite is generated

### Email Preview

To preview emails without sending:

1. Load the template with test data
2. Save the HTML to a file
3. Open in a browser

Example:
```typescript
const template = await emailService.loadTemplate('memberSuspension', {
  firstName: 'Test',
  workspaceName: 'Test Workspace',
  reason: 'Test reason',
  suspendedDate: new Date().toLocaleDateString(),
  supportUrl: 'https://example.com/support',
  privacyUrl: 'https://example.com/privacy',
});

fs.writeFileSync('preview.html', template.html);
```

## Customization

### Modifying Templates

To customize a template:

1. Edit the HTML file in `backend/src/templates/email/`
2. Maintain the `<!-- SUBJECT: ... -->` comment
3. Use `{{variableName}}` for dynamic content
4. Test with the test script
5. Rebuild the backend: `npm run build`

### Adding New Variables

To add a new variable:

1. Update the template HTML with `{{newVariable}}`
2. Update the TypeScript interface in `emailService.ts`
3. Update the controller to pass the new variable
4. Update this documentation

### Styling Guidelines

- Use inline styles (email clients don't support external CSS)
- Test in multiple email clients (Gmail, Outlook, Apple Mail)
- Keep layout simple and table-based for compatibility
- Use web-safe fonts
- Ensure minimum 14px font size for readability
- Maintain 4.5:1 contrast ratio for accessibility

## Troubleshooting

### Template Not Loading

**Issue**: Template file not found

**Solution**:
- Verify file exists in `backend/src/templates/email/`
- Check file name matches exactly (case-sensitive)
- Rebuild backend: `npm run build`

### Variables Not Replacing

**Issue**: `{{variable}}` appears in email instead of value

**Solution**:
- Check variable name spelling
- Ensure variable is passed in data object
- Verify template uses correct syntax

### Email Not Sending

**Issue**: Email service returns error

**Solution**:
- Check SMTP/Resend configuration
- Verify email address is valid
- Check server logs for detailed error
- Test with simple email first

### Styling Issues

**Issue**: Email looks broken in certain clients

**Solution**:
- Use inline styles only
- Avoid complex CSS (flexbox, grid)
- Test in target email clients
- Use table-based layouts for compatibility

## Best Practices

1. **Always provide fallback values** for optional variables
2. **Test in multiple email clients** before deploying
3. **Keep subject lines under 50 characters** for mobile
4. **Use clear, actionable CTAs** with prominent buttons
5. **Include plain text version** for accessibility
6. **Respect user preferences** for email frequency
7. **Provide unsubscribe options** where appropriate
8. **Monitor email delivery rates** and bounce rates
9. **A/B test subject lines** and content for engagement
10. **Keep templates up-to-date** with brand guidelines

## Related Documentation

- [Workspace Team Management API](./WORKSPACE_TEAM_MANAGEMENT_API.md)
- [Email Service Configuration](./EMAIL_SERVICE_CONFIGURATION.md)
- [Audit Logging](./AUDIT_LOG_EXPORT.md)

## Support

For questions or issues with email templates:
- Check the troubleshooting section above
- Review email service logs
- Contact the development team
- Submit an issue in the project repository

---

**Last Updated**: 2025-10-11  
**Version**: 1.0  
**Maintained By**: PharmacyCopilot Development Team
