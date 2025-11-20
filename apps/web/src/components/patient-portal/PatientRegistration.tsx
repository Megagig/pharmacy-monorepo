import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowLeft, AlertCircle, CheckCircle, Calendar } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { Alert } from '../common/Alert';
import { Select } from '../common/Select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Workspace } from './WorkspaceSearch';

const registrationSchema = z.object({
  firstName: z
    .string()
    .min(1, 'First name is required')
    .min(2, 'First name must be at least 2 characters')
    .max(50, 'First name must be less than 50 characters'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .min(2, 'Last name must be at least 2 characters')
    .max(50, 'Last name must be less than 50 characters'),
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?234[0-9]{10}$|^0[0-9]{10}$/, 'Please enter a valid Nigerian phone number'),
  dateOfBirth: z
    .string()
    .min(1, 'Date of birth is required')
    .refine((date) => {
      const birthDate = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      return age >= 13 && age <= 120;
    }, 'You must be between 13 and 120 years old'),
  gender: z
    .enum(['male', 'female', 'other'], {
      required_error: 'Please select your gender',
    }),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  confirmPassword: z
    .string()
    .min(1, 'Please confirm your password'),
  agreeToTerms: z
    .boolean()
    .refine((val) => val === true, 'You must agree to the terms and conditions'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegistrationFormData = z.infer<typeof registrationSchema>;

interface PatientRegistrationProps {
  workspace: Workspace;
  onBack: () => void;
  onRegistrationSuccess: (data: { email: string; requiresApproval: boolean }) => void;
  onSwitchToLogin: () => void;
  className?: string;
}

export const PatientRegistration: React.FC<PatientRegistrationProps> = ({
  workspace,
  onBack,
  onRegistrationSuccess,
  onSwitchToLogin,
  className = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    watch,
  } = useForm<RegistrationFormData>({
    resolver: zodResolver(registrationSchema),
    mode: 'onChange',
  });

  const watchedPassword = watch('password');

  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: '' };
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;

    const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong'];
    const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];

    return {
      strength,
      label: labels[Math.min(strength - 1, 4)] || '',
      color: colors[Math.min(strength - 1, 4)] || 'bg-gray-300',
    };
  };

  const passwordStrength = getPasswordStrength(watchedPassword || '');

  const onSubmit = async (data: RegistrationFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual patient registration API call
      // const response = await patientAuthService.register({
      //   ...data,
      //   workspaceId: workspace._id,
      // });

      // Mock registration for development
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Simulate different scenarios based on workspace settings
      const requiresApproval = Math.random() > 0.5; // 50% chance for demo
      
      onRegistrationSuccess({
        email: data.email,
        requiresApproval,
      });
    } catch (err: any) {
      console.error('Registration error:', err);
      setError(
        err.message || 
        'Registration failed. Please check your information and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format Nigerian phone numbers
    if (digits.startsWith('234')) {
      return `+${digits}`;
    } else if (digits.startsWith('0')) {
      return digits;
    } else if (digits.length <= 10) {
      return `0${digits}`;
    }
    
    return value;
  };

  return (
    <div className={`max-w-md mx-auto ${className}`}>
      <Card className="p-8">
        {/* Header */}
        <div className="text-center space-y-4 mb-8">
          <button
            onClick={onBack}
            className="inline-flex items-center text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to search
          </button>

          {/* Workspace Info */}
          <div className="flex items-center justify-center space-x-3">
            {workspace.logo ? (
              <img
                src={workspace.logo}
                alt={`${workspace.name} logo`}
                className="w-12 h-12 rounded-lg object-cover"
              />
            ) : (
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <span className="text-blue-600 dark:text-blue-400 font-semibold">
                  {workspace.name.charAt(0)}
                </span>
              </div>
            )}
            <div className="text-left">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Create Account
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {workspace.name}
              </p>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400">
            Join the patient portal to manage your healthcare
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </Alert>
        )}

        {/* Registration Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="firstName"
                  type="text"
                  placeholder="First name"
                  className="pl-10"
                  {...register('firstName')}
                  error={errors.firstName?.message}
                />
              </div>
            </div>

            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Last name"
                  className="pl-10"
                  {...register('lastName')}
                  error={errors.lastName?.message}
                />
              </div>
            </div>
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                className="pl-10"
                {...register('email')}
                error={errors.email?.message}
              />
            </div>
          </div>

          {/* Phone Field */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Phone Number
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                id="phone"
                type="tel"
                placeholder="0801234567 or +2348012345678"
                className="pl-10"
                {...register('phone', {
                  onChange: (e) => {
                    e.target.value = formatPhoneNumber(e.target.value);
                  },
                })}
                error={errors.phone?.message}
              />
            </div>
          </div>

          {/* Date of Birth and Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date of Birth
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  id="dateOfBirth"
                  type="date"
                  className="pl-10"
                  {...register('dateOfBirth')}
                  error={errors.dateOfBirth?.message}
                />
              </div>
            </div>

            <div>
              <label htmlFor="gender" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Gender
              </label>
              <Select
                id="gender"
                {...register('gender')}
                error={errors.gender?.message}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a strong password"
                className="pl-10 pr-10"
                {...register('password')}
                error={errors.password?.message}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
            
            {/* Password Strength Indicator */}
            {watchedPassword && (
              <div className="mt-2">
                <div className="flex items-center space-x-2">
                  <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${passwordStrength.color}`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-600 dark:text-gray-400">
                    {passwordStrength.label}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="Confirm your password"
                className="pl-10 pr-10"
                {...register('confirmPassword')}
                error={errors.confirmPassword?.message}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          {/* Terms and Conditions */}
          <div className="flex items-start space-x-3">
            <input
              id="agreeToTerms"
              type="checkbox"
              className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              {...register('agreeToTerms')}
            />
            <label htmlFor="agreeToTerms" className="text-sm text-gray-700 dark:text-gray-300">
              I agree to the{' '}
              <a href="/terms" className="text-blue-600 dark:text-blue-400 hover:underline">
                Terms and Conditions
              </a>{' '}
              and{' '}
              <a href="/privacy" className="text-blue-600 dark:text-blue-400 hover:underline">
                Privacy Policy
              </a>
            </label>
          </div>
          {errors.agreeToTerms && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {errors.agreeToTerms.message}
            </p>
          )}

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>
        </form>

        {/* Login Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Already have an account?{' '}
            <button
              onClick={onSwitchToLogin}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Sign in here
            </button>
          </p>
        </div>

        {/* Help Text */}
        <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-700 dark:text-blue-300">
            <strong>Need help?</strong> Contact {workspace.name} at{' '}
            <a
              href={`tel:${workspace.contact.phone}`}
              className="underline hover:no-underline"
            >
              {workspace.contact.phone}
            </a>{' '}
            for assistance with registration.
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PatientRegistration;