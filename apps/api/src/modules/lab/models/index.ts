// Manual Lab Models
export { default as ManualLabOrder } from './ManualLabOrder';
export { default as ManualLabResult } from './ManualLabResult';
export { default as TestCatalog } from './TestCatalog';

// Export interfaces
export type {
    IManualLabOrder,
    IManualLabTest
} from './ManualLabOrder';

export type {
    IManualLabResult,
    IManualLabResultValue,
    IManualLabResultInterpretation
} from './ManualLabResult';

export type {
    ITestCatalog
} from './TestCatalog';