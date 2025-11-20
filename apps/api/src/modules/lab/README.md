# Manual Lab Module

This module provides manual lab order and result entry functionality that operates alongside the existing FHIR-based lab integration in the MERN PharmacyCopilot application.

## Overview

The Manual Lab Module enables pharmacists to:

- Create printable lab requisitions with QR/barcode tokens
- Track order status throughout the workflow
- Manually enter lab results with smart validation
- Leverage AI interpretation for diagnostic insights
- Scan QR codes/barcodes for quick order access
- Maintain comprehensive audit trails

## Architecture

The module follows the established patterns in the diagnostics module:

```
backend/src/modules/lab/
├── models/                 # Mongoose models and schemas
│   ├── ManualLabOrder.ts  # Manual lab order model
│   ├── ManualLabResult.ts # Manual lab result model
│   ├── TestCatalog.ts     # Test catalog management
│   └── index.ts           # Model exports
├── controllers/           # Request handlers (to be implemented)
├── services/             # Business logic services (to be implemented)
├── routes/               # Express route definitions (to be implemented)
├── validators/           # Input validation schemas (to be implemented)
├── types/                # TypeScript type definitions
│   └── index.ts          # Type exports
├── utils/                # Utility functions (to be implemented)
├── __tests__/            # Test files (to be implemented)
├── index.ts              # Module exports
└── README.md             # This file
```

## Models

### ManualLabOrder

- Stores manual lab order information
- Generates unique order IDs (LAB-YYYY-XXXX format)
- Manages order status workflow
- Links to PDF requisitions and barcode tokens
- Tracks consent and audit information

### ManualLabResult

- Stores manually entered lab results
- Supports both numeric and qualitative values
- Automatic interpretation calculation
- Links to AI diagnostic results
- Quality control and review workflow

### TestCatalog

- Manages available lab tests per workplace
- Supports custom test definitions
- Search and categorization functionality
- Cost and turnaround time tracking

## Key Features

### Order Management

- Unique order ID generation per workplace
- Status tracking: requested → sample_collected → result_awaited → completed → referred
- PDF requisition generation with QR/barcode tokens
- Patient consent tracking and compliance

### Result Entry

- Dynamic form generation based on ordered tests
- Input validation against reference ranges
- Automatic interpretation (low/normal/high/critical)
- Support for both numeric and qualitative results

### AI Integration

- Automatic trigger of AI interpretation after result entry
- Integration with existing diagnostic orchestration service
- Critical alert generation for red flags
- Suggested actions and recommendations

### Security & Compliance

- Secure token generation for QR/barcode access
- Comprehensive audit logging
- RBAC integration with existing middleware
- Data protection following application patterns

## Database Indexes

The models include optimized indexes for:

- Workplace-scoped queries
- Patient order history
- Status-based filtering
- Date range queries
- Text search capabilities
- Barcode token resolution

## Integration Points

### Existing Systems

- **Diagnostics Module**: AI interpretation and orchestration
- **Audit System**: Comprehensive activity logging
- **Notification Service**: Critical alerts and patient notifications
- **Authentication**: Existing JWT and RBAC middleware
- **Patient Management**: Patient data and demographics

### External Services

- **OpenRouter**: AI diagnostic interpretation via DeepSeek V3.1
- **PDF Generation**: Server-side PDF creation with Puppeteer
- **QR/Barcode**: Token generation and scanning support

## Usage Patterns

### Creating a Manual Lab Order

1. Pharmacist selects tests from catalog
2. System generates unique order ID and secure token
3. PDF requisition created with QR/barcode
4. Order status set to 'requested'
5. Audit log entry created

### Processing Results

1. Lab technician scans QR/barcode to access order
2. Results entered through dynamic form
3. Automatic interpretation calculated
4. AI diagnostic service triggered
5. Critical alerts generated if needed
6. Order status updated to 'completed'

### Quality Control

1. Results flagged for review if abnormal
2. Pharmacist reviews and approves results
3. Additional clinical notes can be added
4. Patient notifications sent if configured

## Configuration

The module supports configuration for:

- PDF generation settings
- Token security parameters
- AI integration options
- Notification preferences
- Audit logging levels

## Testing Strategy

- Unit tests for all models and business logic
- Integration tests for API endpoints
- End-to-end workflow testing
- Performance testing for concurrent users
- Security testing for token validation

## Future Enhancements

- FHIR export capability for manual results
- Advanced analytics and reporting
- Mobile app integration for scanning
- Batch result import functionality
- Integration with external lab systems

## Dependencies

- Mongoose (database modeling)
- Existing diagnostic module (AI integration)
- Existing audit system (activity logging)
- Existing notification service (alerts)
- PDF generation libraries (Puppeteer)
- QR/Barcode generation libraries

## Compliance

The module maintains compliance with:

- HIPAA data protection requirements
- Audit trail requirements
- Patient consent management
- Data retention policies
- Security best practices
