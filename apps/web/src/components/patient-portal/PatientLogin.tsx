import React, { useState } from 'react';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, AlertCircle } from 'lucide-react';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Card } from '../common/Card';
import { Alert } from '../common/Alert';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Workspace } from './WorkspaceSearch';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface PatientLoginProps {
  workspace: Workspace;
  onBack: () => void;
  onLoginSuccess: (user: any) => void;
  onSwitchToRegister: () => void;
  className?: string;
}

export const PatientLogin: React.FC<PatientLoginProps> = ({
  workspace,
  onBack,
  onLoginSuccess,
  onSwitchToRegister,
  className = '',
}) => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // TODO: Replace with actual patient authentication API call
      // const response = await patientAuthService.login({
      //   email: data.email,
      //   password: data.password,
      //   workspaceId: workspace._id,
      // });

      // Mock successful login for development
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockUser = {
        id: 'patient_123',
        email: data.email,
        firstName: 'John',
        lastName: 'Doe',
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        status: 'active',
        emailVerified: true,
      };

      onLoginSuccess(mockUser);
    } catch (err: any) {
      console.error('Login error:', err);
      setError(
        err.message || 
        'Login failed. Please check your credentials and try again.'
      );
    } finally {
      setIsLoading(false);
    }
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
                Sign In
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {workspace.name}
              </p>
            </div>
          </div>

          <p className="text-gray-600 dark:text-gray-400">
            Access your patient portal
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="error" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
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
                placeholder="Enter your password"
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
          </div>

          {/* Forgot Password Link */}
          <div className="text-right">
            <Link
              to="/patient-portal/forgot-password"
              className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
            >
              Forgot your password?
            </Link>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={!isValid || isLoading}
            loading={isLoading}
          >
            {isLoading ? 'Signing In...' : 'Sign In'}
          </Button>
        </form>

        {/* Register Link */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Don't have an account?{' '}
            <button
              onClick={onSwitchToRegister}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
            >
              Create one here
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
            or{' '}
            <a
              href={`mailto:${workspace.contact.email}`}
              className="underline hover:no-underline"
            >
              {workspace.contact.email}
            </a>
          </p>
        </div>
      </Card>
    </div>
  );
};

export default PatientLogin;