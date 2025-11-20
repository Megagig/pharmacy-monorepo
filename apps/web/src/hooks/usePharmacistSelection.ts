import { useState, useEffect } from 'react';
import { useUsers } from '../queries/useUsers';
import { useAuth } from '../context/AuthContext';

export interface PharmacistOption {
  id: string;
  name: string;
  email: string;
  role: string;
}

export const usePharmacistSelection = () => {
  const [selectedPharmacistId, setSelectedPharmacistId] = useState<string>('');
  const { data: usersData, isLoading } = useUsers();
  const { user: currentUser } = useAuth();

  // Get pharmacists from users data
  let pharmacists: PharmacistOption[] = (usersData?.data?.users || [])
    .filter((user: any) => 
      user.workplaceRole === 'Pharmacist' || 
      user.workplaceRole === 'Owner' ||
      user.role === 'pharmacist' ||
      user.role === 'pharmacy_outlet' ||
      user.role === 'owner'
    )
    .map((user: any) => ({
      id: user._id,
      name: `${user.firstName} ${user.lastName}`,
      email: user.email,
      role: user.workplaceRole || user.role,
    }));

  // If no pharmacists found but current user is a pharmacist/owner, include them
  if (pharmacists.length === 0 && currentUser && 
      (currentUser.role === 'pharmacist' || 
       currentUser.role === 'pharmacy_outlet' || 
       currentUser.role === 'owner')) {
    pharmacists = [{
      id: currentUser.id,
      name: `${currentUser.firstName} ${currentUser.lastName}`,
      email: currentUser.email,
      role: currentUser.role,
    }];
  }

  // Auto-select first pharmacist if none selected
  useEffect(() => {
    if (!selectedPharmacistId && pharmacists.length > 0) {
      setSelectedPharmacistId(pharmacists[0].id);
    }
  }, [pharmacists, selectedPharmacistId]);

  const selectedPharmacist = pharmacists.find(p => p.id === selectedPharmacistId);

  return {
    pharmacists,
    selectedPharmacistId,
    selectedPharmacist,
    setSelectedPharmacistId,
    isLoading,
  };
};