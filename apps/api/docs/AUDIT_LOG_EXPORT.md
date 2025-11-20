# Audit Log Export Feature

## Overview

The Audit Log Export feature allows workspace owners to export their workspace audit logs as CSV files for external analysis, compliance reporting, or archival purposes.

## API Endpoint

### Export Audit Logs

**Endpoint:** `GET /api/workspace/team/audit/export`

**Authentication:** Required (JWT token)

**Authorization:** Workspace owner only (pharmacy_outlet role)

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `startDate` | string (ISO 8601) | No | Filter logs from this date |
| `endDate` | string (ISO 8601) | No | Filter logs until this date |
| `actorId` | string (MongoDB ObjectId) | No | Filter by actor (who performed the action) |
| `targetId` | string (MongoDB ObjectId) | No | Filter by target (who was affected) |
| `category` | string | No | Filter by category (member, role, permission, invite, auth, settings) |
| `action` | string | No | Filter by specific action (e.g., role_changed, member_suspended) |
| `severity` | string | No | Filter by severity (low, medium, high, critical) |

**Response:**

- **Content-Type:** `text/csv`
- **Content-Disposition:** `attachment; filename="workspace-audit-logs-{timestamp}.csv"`
- **Body:** CSV file content

**Example Request:**

```bash
curl -X GET \
  'https://api.example.com/api/workspace/team/audit/export?startDate=2024-01-01&endDate=2024-01-31&category=member' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --output audit-logs.csv
```

**Example Response (CSV):**

```csv
Timestamp,Action,Category,Actor Name,Actor Email,Target Name,Target Email,Severity,IP Address,Reason,Before,After
"2024-01-15T10:30:00.000Z","role_changed","role","John Doe","john@test.com","Jane Smith","jane@test.com","medium","192.168.1.1","Promotion","""Staff""","""Pharmacist"""
"2024-01-16T14:20:00.000Z","member_suspended","member","Admin User","admin@test.com","Bob Johnson","bob@test.com","high","192.168.1.2","Policy violation","",""
```

## CSV Format

### Columns

1. **Timestamp** - ISO 8601 formatted date and time of the action
2. **Action** - The action that was performed (e.g., role_changed, member_suspended)
3. **Category** - The category of the action (member, role, permission, invite, auth, settings)
4. **Actor Name** - Full name of the user who performed the action
5. **Actor Email** - Email address of the actor
6. **Target Name** - Full name of the user who was affected (if applicable)
7. **Target Email** - Email address of the target (if applicable)
8. **Severity** - Severity level of the action (low, medium, high, critical)
9. **IP Address** - IP address from which the action was performed
10. **Reason** - Reason provided for the action (if applicable)
11. **Before** - Previous value before the change (JSON stringified)
12. **After** - New value after the change (JSON stringified)

### Field Escaping

- All fields are enclosed in double quotes
- Double quotes within fields are escaped by doubling them (`""`)
- JSON objects in Before/After columns are stringified and properly escaped

## Usage Examples

### Export All Logs

```bash
curl -X GET \
  'https://api.example.com/api/workspace/team/audit/export' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --output all-audit-logs.csv
```

### Export Logs for a Date Range

```bash
curl -X GET \
  'https://api.example.com/api/workspace/team/audit/export?startDate=2024-01-01&endDate=2024-01-31' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --output january-audit-logs.csv
```

### Export High Severity Logs

```bash
curl -X GET \
  'https://api.example.com/api/workspace/team/audit/export?severity=high' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --output high-severity-logs.csv
```

### Export Member-Related Logs

```bash
curl -X GET \
  'https://api.example.com/api/workspace/team/audit/export?category=member' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --output member-logs.csv
```

### Export Logs by Specific Actor

```bash
curl -X GET \
  'https://api.example.com/api/workspace/team/audit/export?actorId=507f1f77bcf86cd799439011' \
  -H 'Authorization: Bearer YOUR_JWT_TOKEN' \
  --output actor-logs.csv
```

## Frontend Integration

### Using the React Hook

```typescript
import { useExportAuditLogs } from '../queries/useWorkspaceTeam';
import { format } from 'date-fns';

function AuditTrailComponent() {
  const exportMutation = useExportAuditLogs();

  const handleExport = async () => {
    try {
      // Export with filters
      const blob = await exportMutation.mutateAsync({
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        category: 'member',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export audit logs:', error);
    }
  };

  return (
    <Button 
      onClick={handleExport}
      disabled={exportMutation.isPending}
    >
      Export to CSV
    </Button>
  );
}
```

## Performance Considerations

### Export Limits

- Maximum 10,000 logs per export
- For larger datasets, use date range filters to export in batches
- Export operations are optimized with database indexes

### Best Practices

1. **Use Date Ranges:** Always specify date ranges for large workspaces
2. **Filter by Category:** Export specific categories when possible
3. **Batch Exports:** For compliance reporting, export monthly or quarterly
4. **Async Processing:** Consider implementing background job processing for very large exports

## Security

### Access Control

- Only workspace owners (pharmacy_outlet role) can export audit logs
- Users can only export logs from their own workspace
- All exports are logged in the audit trail

### Data Privacy

- Exported data includes sensitive information (emails, IP addresses)
- Store exported files securely
- Follow data retention policies
- Consider encryption for stored CSV files

## Error Handling

### Common Errors

| Status Code | Error | Description |
|-------------|-------|-------------|
| 400 | Workplace ID is required | Missing workplace context |
| 401 | Unauthorized | Invalid or missing JWT token |
| 403 | Access denied | User is not a workspace owner |
| 500 | Failed to export audit logs | Server error during export |

### Error Response Format

```json
{
  "success": false,
  "message": "Failed to export audit logs",
  "error": "Database connection failed"
}
```

## Testing

### Manual Testing

1. Log in as a workspace owner
2. Navigate to the Audit Trail page
3. Apply desired filters
4. Click the "Export to CSV" button
5. Verify the downloaded CSV file contains correct data

### Automated Testing

Run the integration test:

```bash
cd backend
node test-audit-export.js
```

## Compliance and Reporting

### Use Cases

1. **Compliance Audits:** Export logs for regulatory compliance reviews
2. **Security Analysis:** Analyze suspicious activities
3. **Performance Reviews:** Track team member activities
4. **Incident Investigation:** Export logs related to specific incidents
5. **Archival:** Long-term storage of audit trails

### Recommended Export Schedule

- **Daily:** High-security environments
- **Weekly:** Standard security requirements
- **Monthly:** Compliance reporting
- **Quarterly:** Long-term archival

## Troubleshooting

### Export Returns Empty File

**Cause:** No logs match the specified filters

**Solution:** 
- Verify date range is correct
- Check if filters are too restrictive
- Ensure workspace has audit logs

### Export Times Out

**Cause:** Too many logs to export

**Solution:**
- Use date range filters to reduce dataset size
- Export in smaller batches
- Contact support for large dataset exports

### CSV Format Issues

**Cause:** Special characters in data

**Solution:**
- CSV properly escapes all special characters
- Use a CSV-compatible application (Excel, Google Sheets)
- Verify file encoding is UTF-8

## Future Enhancements

- [ ] PDF export format
- [ ] Scheduled automatic exports
- [ ] Email delivery of exports
- [ ] Custom column selection
- [ ] Export templates
- [ ] Compression for large files
- [ ] Background job processing for large exports

## Related Documentation

- [Workspace Team Management API](./WORKSPACE_TEAM_API.md)
- [Audit Logging System](./AUDIT_LOGGING.md)
- [Security Guidelines](./SECURITY.md)

---

**Last Updated:** 2025-10-11  
**Version:** 1.0  
**Status:** Production Ready
