interface MigrationResult {
    success: boolean;
    patientsUpdated: number;
    errors: string[];
}
export declare function enhancePatientProfile(): Promise<MigrationResult>;
export declare function rollbackPatientProfileEnhancement(): Promise<MigrationResult>;
export declare function createPatientPortalIndexes(): Promise<void>;
declare const _default: {
    enhancePatientProfile: typeof enhancePatientProfile;
    rollbackPatientProfileEnhancement: typeof rollbackPatientProfileEnhancement;
    createPatientPortalIndexes: typeof createPatientPortalIndexes;
};
export default _default;
//# sourceMappingURL=enhance-patient-profile.d.ts.map