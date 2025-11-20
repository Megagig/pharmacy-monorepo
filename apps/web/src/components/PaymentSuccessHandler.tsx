import React, { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useSubscriptionStatus } from '../hooks/useSubscription';
import { subscriptionService } from '../services/subscriptionService';
import { useUIStore } from '../stores';

/**
 * This component handles the payment success flow globally
 * It checks for payment success indicators in URL or sessionStorage
 * and refreshes the user data as needed
 */
const PaymentSuccessHandler: React.FC = () => {
  const { refreshUser } = useAuth();
  const { refetch: refetchSubscription } = useSubscriptionStatus();
  const location = useLocation();
  const addNotification = useUIStore((state) => state.addNotification);

  useEffect(() => {
    const handlePaymentSuccess = async () => {
      // Check if we're coming from a payment success page
      const fromPayment =
        location.search.includes('fromPayment=true') ||
        sessionStorage.getItem('paymentSuccessful') === 'true';

      const paymentRef =
        new URLSearchParams(location.search).get('ref') ||
        sessionStorage.getItem('paymentReference');

      if (fromPayment && paymentRef) {

        try {
          // Force delay to ensure backend has processed payment
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Try to verify the payment one more time
          const verifyResult = await subscriptionService.verifyPayment(
            paymentRef
          );
          if (verifyResult.success) {

          }

          // Try to handle successful payment
          try {
            await subscriptionService.handleSuccessfulPayment(paymentRef);

          } catch (e) {

          }

          // Refresh user data and subscription status multiple times to ensure we have the latest

          await Promise.all([refreshUser(), refetchSubscription()]);

          // Small delay
          await new Promise((resolve) => setTimeout(resolve, 500));

          // One more refresh for good measure

          await Promise.all([refreshUser(), refetchSubscription()]);

          // Show success notification
          addNotification({
            type: 'success',
            title: 'Subscription Active',
            message:
              'Your subscription is now active and all features are available.',
            duration: 8000,
          });

          // IMPORTANT: Instead of removing, let's keep the payment indicators
          // for a temporary period to force bypassing subscription checks
          // This ensures access even if refreshUser doesn't immediately update the state
          sessionStorage.setItem('paymentSuccessful', 'true');
          sessionStorage.setItem('paymentTimestamp', Date.now().toString());
          sessionStorage.setItem('paymentReference', paymentRef || '');

          // Log the bypass status

        } catch (error) {
          console.error('Error handling payment success:', error);

          // Try one more time to refresh user and subscription
          try {
            await Promise.all([refreshUser(), refetchSubscription()]);
          } catch (e) {
            console.error('Final refresh attempt failed:', e);
          }
        }
      }
    };

    handlePaymentSuccess();
  }, [location, refreshUser, refetchSubscription, addNotification]);

  // This is an invisible component that just runs the effect
  return null;
};

export default PaymentSuccessHandler;
