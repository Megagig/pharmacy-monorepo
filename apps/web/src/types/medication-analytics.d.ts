declare module '../components/medications/MedicationAnalyticsPanel' {
  interface MedicationAnalyticsPanelProps {
    patientId: string;
  }

  const MedicationAnalyticsPanel: React.FC<MedicationAnalyticsPanelProps>;
  export default MedicationAnalyticsPanel;
}
