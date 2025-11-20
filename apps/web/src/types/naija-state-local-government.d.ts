declare module 'naija-state-local-government' {
    interface LGAResult {
        state: string;
        senatorial_districts: string[];
        lgas: string[];
    }

    interface NaijaStatesModule {
        states(): string[];
        lgas(state: string): LGAResult;
        all(): Record<string, LGAResult>;
    }

    const NaijaStates: NaijaStatesModule;
    export default NaijaStates;
}
