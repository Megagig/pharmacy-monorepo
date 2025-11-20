import { useContext } from 'react';
import { PatientAuthContext } from '../contexts/PatientAuthContext';

/**
 * Custom hook to use the PatientAuthContext
 * @returns PatientAuthContextType
 * @throws Error if used outside of PatientAuthProvider
 */
export const usePatientAuth = () => {
  const context = useContext(PatientAuthContext);
  
  if (!context) {
    throw new Error('usePatientAuth must be used within a PatientAuthProvider');
  }
  
  return context;
};

export default usePatientAuth;