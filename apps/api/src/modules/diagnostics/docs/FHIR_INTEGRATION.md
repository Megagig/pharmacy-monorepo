# FHIR Integration for Lab Systems

This document describes the FHIR (Fast Healthcare Interoperability Resources) integration implementation for the AI Diagnostics & Therapeutics module.

## Overview

The FHIR integration enables seamless exchange of laboratory data between the PharmacyCopilot system and external laboratory information systems (LIS) or electronic health record (EHR) systems that support FHIR standards.

## Supported FHIR Versions

- **FHIR R4** (Recommended)
- **FHIR STU3** (Limited support)
- **FHIR DSTU2** (Legacy support)

## Supported Resources

### Primary Resources

- **Observation**: Lab test results and measurements
- **ServiceRequest**: Lab test orders and requests
- **Patient**: Patient demographics and identifiers

### Supporting Resources

- **Practitioner**: Healthcare providers
- **Organization**: Healthcare organizations
- **DiagnosticReport**: Grouped lab results (future enhancement)

## Authentication Methods

### OAuth 2.0 (Recommended)

```json
{
  "type": "oauth2",
  "tokenUrl": "https://fhir-server.com/auth/token",
  "clientId": "your-client-id",
  "clientSecret": "your-client-secret",
  "scope": "system/*.read system/*.write"
}
```

### Basic Authentication

```json
{
  "type": "basic",
  "username": "your-username",
  "password": "your-password"
}
```

### Bearer Token

```json
{
  "type": "bearer",
  "bearerToken": "your-bearer-token"
}
```

### No Authentication

```json
{
  "type": "none"
}
```

## Configuration

### Environment Variables

Set the following environment variables for automatic FHIR configuration:

```bash
# FHIR Server Configuration
FHIR_BASE_URL=https://your-fhir-server.com/fhir
FHIR_VERSION=R4
FHIR_TIMEOUT=30000
FHIR_RETRY_ATTEMPTS=3

# Authentication (OAuth2 example)
FHIR_AUTH_TYPE=oauth2
FHIR_TOKEN_URL=https://your-fhir-server.com/auth/token
FHIR_CLIENT_ID=your-client-id
FHIR_CLIENT_SECRET=your-client-secret
FHIR_SCOPE=system/*.read system/*.write

# Basic Auth example
# FHIR_AUTH_TYPE=basic
# FHIR_USERNAME=your-username
# FHIR_PASSWORD=your-password

# Bearer Token example
# FHIR_AUTH_TYPE=bearer
# FHIR_BEARER_TOKEN=your-bearer-token
```

### Default Configurations

The system includes several pre-configured FHIR servers for testing:

1. **Local HAPI FHIR Server** (`http://localhost:8080/fhir`)
2. **HAPI FHIR Public Test Server** (`http://hapi.fhir.org/baseR4`)
3. **SMART Health IT Sandbox** (`https://launch.smarthealthit.org/v/r4/fhir`)

## API Endpoints

### Import Lab Results from FHIR

```http
POST /api/lab/import/fhir
Content-Type: application/json
Authorization: Bearer <token>

{
  "fhirBundle": {
    "resourceType": "Bundle",
    "type": "collection",
    "entry": [
      {
        "resource": {
          "resourceType": "Observation",
          "id": "glucose-result-1",
          "status": "final",
          "code": {
            "coding": [
              {
                "system": "http://loinc.org",
                "code": "2345-7",
                "display": "Glucose [Mass/volume] in Serum or Plasma"
              }
            ]
          },
          "subject": {
            "reference": "Patient/patient-123"
          },
          "valueQuantity": {
            "value": 95,
            "unit": "mg/dL",
            "system": "http://unitsofmeasure.org",
            "code": "mg/dL"
          },
          "referenceRange": [
            {
              "low": {
                "value": 70,
                "unit": "mg/dL"
              },
              "high": {
                "value": 100,
                "unit": "mg/dL"
              }
            }
          ]
        }
      }
    ]
  },
  "patientMapping": [
    {
      "fhirPatientId": "patient-123",
      "internalPatientId": "64f1234567890abcdef12345",
      "workplaceId": "64f1234567890abcdef12346"
    }
  ]
}
```

### Export Lab Order to FHIR

```http
POST /api/lab/export/fhir/{orderId}
Authorization: Bearer <token>
```

### Sync Lab Results from FHIR Server

```http
POST /api/lab/sync/fhir/{patientId}
Content-Type: application/json
Authorization: Bearer <token>

{
  "fromDate": "2024-01-01T00:00:00Z",
  "toDate": "2024-01-31T23:59:59Z"
}
```

### Test FHIR Connection

```http
GET /api/lab/fhir/test-connection
Authorization: Bearer <token>
```

### Get FHIR Configuration

```http
GET /api/lab/fhir/config
Authorization: Bearer <token>
```

### Test FHIR Configuration

```http
POST /api/lab/fhir/config/test
Content-Type: application/json
Authorization: Bearer <token>

{
  "config": {
    "baseUrl": "https://test-fhir-server.com/fhir",
    "version": "R4",
    "timeout": 30000,
    "retryAttempts": 3
  },
  "auth": {
    "type": "oauth2",
    "tokenUrl": "https://test-fhir-server.com/auth/token",
    "clientId": "test-client",
    "clientSecret": "test-secret"
  }
}
```

## Data Mapping

### FHIR Observation → Internal LabResult

| FHIR Field                | Internal Field     | Notes                    |
| ------------------------- | ------------------ | ------------------------ |
| `id`                      | `externalResultId` | FHIR resource ID         |
| `code.coding[0].code`     | `testCode`         | Test identifier          |
| `code.coding[0].display`  | `testName`         | Test name                |
| `code.coding[LOINC].code` | `loincCode`        | LOINC code if available  |
| `valueQuantity.value`     | `numericValue`     | Numeric result value     |
| `valueQuantity.unit`      | `unit`             | Result unit              |
| `valueString`             | `value`            | String result value      |
| `effectiveDateTime`       | `performedAt`      | When test was performed  |
| `issued`                  | `reportedAt`       | When result was reported |
| `referenceRange[0]`       | `referenceRange`   | Normal value ranges      |
| `interpretation[0]`       | `interpretation`   | Result interpretation    |
| `note[0].text`            | `technicalNotes`   | Additional notes         |

### FHIR ServiceRequest → Internal LabOrder

| FHIR Field               | Internal Field        | Notes                  |
| ------------------------ | --------------------- | ---------------------- |
| `id`                     | `externalOrderId`     | FHIR resource ID       |
| `code.coding[0].code`    | `tests[0].code`       | Test code              |
| `code.coding[0].display` | `tests[0].name`       | Test name              |
| `priority`               | `tests[0].priority`   | Order priority         |
| `authoredOn`             | `orderDate`           | When order was created |
| `reasonCode[0].text`     | `tests[0].indication` | Order indication       |
| `status`                 | `status`              | Order status           |

## Error Handling

### Common Error Codes

- **FHIR_CONNECTION_ERROR**: Unable to connect to FHIR server
- **FHIR_AUTH_ERROR**: Authentication failed
- **FHIR_BUNDLE_ERROR**: Invalid FHIR bundle format
- **PATIENT_MAPPING_ERROR**: Patient mapping not found
- **RESOURCE_VALIDATION_ERROR**: FHIR resource validation failed

### Error Response Format

```json
{
  "success": false,
  "message": "FHIR import operation failed",
  "code": "FHIR_BUNDLE_ERROR",
  "details": "Invalid FHIR bundle format",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Security Considerations

### Data Protection

- All FHIR communications use HTTPS/TLS encryption
- Authentication credentials are stored securely server-side
- Patient data mapping is validated before processing
- Audit logs are maintained for all FHIR operations

### Access Control

- RBAC permissions required for FHIR operations
- Workspace isolation enforced
- Feature flags control FHIR availability

### Compliance

- HIPAA compliance maintained through secure data handling
- Audit trails for all data exchanges
- Patient consent validation for AI processing

## Testing

### Unit Tests

```bash
npm test -- --testPathPattern=fhirIntegration.test.ts
```

### Integration Tests

```bash
npm run test:integration -- --grep "FHIR"
```

### Manual Testing with HAPI FHIR

1. Start local HAPI FHIR server:

```bash
docker run -p 8080:8080 hapiproject/hapi:latest
```

2. Set environment variables:

```bash
export FHIR_BASE_URL=http://localhost:8080/fhir
export FHIR_VERSION=R4
export FHIR_AUTH_TYPE=none
```

3. Test connection:

```bash
curl -X GET "http://localhost:3000/api/lab/fhir/test-connection" \
  -H "Authorization: Bearer <your-token>"
```

## Troubleshooting

### Connection Issues

1. Verify FHIR server URL is accessible
2. Check authentication credentials
3. Validate network connectivity and firewall rules
4. Review FHIR server logs for errors

### Authentication Problems

1. Verify OAuth2 client credentials
2. Check token expiration and refresh logic
3. Validate scope permissions
4. Review authentication server logs

### Data Import Failures

1. Validate FHIR bundle structure
2. Check patient mapping configuration
3. Verify required FHIR resource fields
4. Review data validation errors

### Performance Issues

1. Adjust timeout settings
2. Implement connection pooling
3. Use batch operations for large datasets
4. Monitor FHIR server performance

## Future Enhancements

### Planned Features

- Real-time FHIR subscriptions
- DiagnosticReport resource support
- Bulk data export (FHIR Bulk Data API)
- Advanced patient matching algorithms
- FHIR Questionnaire integration

### Roadmap

- **Phase 1**: Basic import/export (✅ Complete)
- **Phase 2**: Real-time synchronization
- **Phase 3**: Advanced FHIR resources
- **Phase 4**: AI-enhanced data mapping

## Support

For technical support or questions about FHIR integration:

1. Check the troubleshooting section above
2. Review system logs for error details
3. Consult FHIR specification documentation
4. Contact the development team

## References

- [FHIR R4 Specification](https://hl7.org/fhir/R4/)
- [LOINC Database](https://loinc.org/)
- [HAPI FHIR Documentation](https://hapifhir.io/)
- [SMART on FHIR](https://docs.smarthealthit.org/)
