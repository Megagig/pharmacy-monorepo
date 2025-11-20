# Drug Information Center Module

## Overview
The Drug Information Center module provides comprehensive drug information services for the PharmacyCopilot SaaS application. This module integrates with multiple external APIs to provide drug search, monograph viewing, interaction checking, adverse effect profiles, and formulary management.

## Features
- Drug search with autocomplete (RxNorm API)
- Detailed drug monographs (DailyMed API)
- Drug interaction checking (RxNav Interaction API)
- Adverse effect profiles (OpenFDA API)
- Formulary management and therapeutic alternatives (RxNorm API)
- Therapy plan creation and management
- Search history tracking

## Architecture
The module follows a clean architecture pattern with the following layers:

### Services Layer
- `rxnormService.ts` - Handles all RxNorm API interactions
- `dailymedService.ts` - Handles all DailyMed API interactions
- `openfdaService.ts` - Handles all OpenFDA API interactions
- `interactionService.ts` - Handles all RxNav Interaction API interactions
- `apiClient.ts` - Generic HTTP client with retry logic

### Controllers Layer
- `drugController.ts` - Main controller handling all drug-related requests

### Routes Layer
- `drugRoutes.ts` - Express routes for drug information endpoints

### Models Layer
- `drugCacheModel.ts` - Mongoose models for search history and therapy plans

### Tests
- `drugService.test.ts` - Unit tests for all drug services

## API Endpoints

### Drug Search
```
GET /api/drugs/search?name=:drugName
```

### Drug Monograph
```
GET /api/drugs/monograph/:id
```

### Drug Interactions
```
POST /api/drugs/interactions
Body: { rxcui: "string" } or { rxcuis: ["string"] }
```

### Adverse Effects
```
GET /api/drugs/adverse-effects/:id?limit=:number
```

### Formulary Information
```
GET /api/drugs/formulary/:id
```

### Therapy Plans
```
POST /api/drugs/therapy-plans
GET /api/drugs/therapy-plans
GET /api/drugs/therapy-plans/:id
PUT /api/drugs/therapy-plans/:id
DELETE /api/drugs/therapy-plans/:id
```

## External APIs

### RxNorm API
Base URL: https://rxnav.nlm.nih.gov/REST/
- Drug search and identification
- Therapeutic equivalence data

### DailyMed API
Base URL: https://dailymed.nlm.nih.gov/dailymed/services/v2/
- Drug monographs and labeling information

### OpenFDA API
Base URL: https://api.fda.gov/drug/
- Adverse event reporting
- Drug labeling information

### RxNav Interaction API
Base URL: https://rxnav.nlm.nih.gov/REST/interaction/
- Drug-drug interaction checking

## Data Models

### DrugSearchHistory
```typescript
interface DrugSearchHistory {
  userId: ObjectId;
  searchTerm: string;
  searchResults: any;
  createdAt: Date;
}
```

### TherapyPlan
```typescript
interface TherapyPlan {
  userId: ObjectId;
  planName: string;
  drugs: Drug[];
  guidelines: string;
  createdAt: Date;
  updatedAt: Date;
}

interface Drug {
  rxCui: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  notes: string;
  monograph: any;
  interactions: any;
  adverseEffects: any;
  formularyInfo: any;
}
```

## Error Handling
All services include proper error handling with logging. Errors are propagated up to the controller layer where they are handled by the global error handler.

## Retry Logic
All external API calls include retry logic with exponential backoff to handle transient network issues.

## Testing
Unit tests are provided for all services to ensure proper functionality and error handling.

## Integration with Frontend
The backend module is designed to work with the React frontend using:
- Zustand for local state management
- React Query for server state management
- Axios for HTTP requests
- Material-UI for UI components

## Future Enhancements
- Caching layer for improved performance
- Advanced search filters
- Drug comparison functionality
- Print/export capabilities
- Integration with patient records