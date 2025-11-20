import React, { useState, useEffect, useRef } from 'react';
import {
  useSearchParams,
  Link,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import {
  CheckCircle,
  XCircle,
  Loader2,
  Mail,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { verifyEmail } = useAuth();

  const [status, setStatus] = useState<
    'loading' | 'input' | 'success' | 'error'
  >('input');
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [code, setCode] = useState(['', '', '', '', '', '']);

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Get email from location state (from registration) or default
  const email = location.state?.email || 'your email address';
  const fromRegistration = location.state?.fromRegistration || false;

  useEffect(() => {
    const token = searchParams.get('token');

    if (token) {
      // Auto-verify with token from URL
      setStatus('loading');
      const verify = async () => {
        try {
          const response = await verifyEmail(token);
          setStatus('success');
          setMessage(response.message || 'Email verified successfully!');
          // Auto-navigate to login after 2 seconds
          setTimeout(() => {
            navigate('/login');
          }, 2000);
        } catch (error: unknown) {
          setStatus('error');
          setMessage(
            (error as Error).message ||
              'Email verification failed. Please try again.'
          );
        }
      };
      verify();
    } else {
      // No token, show manual code input
      setStatus('input');
    }
  }, [searchParams, verifyEmail, navigate]);

  // Handle code input changes
  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) return; // Only allow single digit

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle paste
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (/^\d+$/.test(pastedData)) {
      const newCode = pastedData
        .split('')
        .concat(Array(6).fill(''))
        .slice(0, 6);
      setCode(newCode);
      // Focus the next empty input or the last one
      const nextIndex = Math.min(pastedData.length, 5);
      inputRefs.current[nextIndex]?.focus();
    }
  };

  // Submit verification code
  const handleSubmit = async () => {
    const codeString = code.join('');
    if (codeString.length !== 6) {
      toast.error('Please enter all 6 digits');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await verifyEmail(undefined, codeString);
      setStatus('success');
      setMessage(response.message || 'Email verified successfully!');
      toast.success('Email verified successfully!');
      // Auto-navigate to login after 2 seconds
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: unknown) {
      toast.error(
        (error as Error).message ||
          'Invalid verification code. Please try again.'
      );
      // Clear the code on error
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle resend code
  const handleResend = async () => {
    setIsResending(true);
    try {
      // TODO: Implement resend API call
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate API call
      toast.success('Verification code sent successfully!');
    } catch {
      toast.error('Failed to resend code. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-10 px-6 shadow-xl sm:rounded-2xl sm:px-10 border border-gray-100">
          <div className="text-center">
            {status === 'loading' && (
              <>
                <Loader2 className="mx-auto h-16 w-16 text-blue-600 animate-spin" />
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  Verifying your email...
                </h2>
                <p className="mt-3 text-sm text-gray-600">
                  Please wait while we verify your email address.
                </p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                  <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  Email Verified!
                </h2>
                <p className="mt-3 text-sm text-gray-600">
                  Your account has been successfully verified. Redirecting to
                  login...
                </p>
                <div className="mt-8">
                  <Link
                    to="/login"
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Continue to Login
                  </Link>
                </div>
              </>
            )}

            {status === 'input' && (
              <>
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                  <Mail className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  Check Your Email
                </h2>
                <p className="mt-3 text-sm text-gray-600">
                  We've sent a verification link to{' '}
                  <span className="font-medium text-gray-900">{email}</span>.
                  Please click the link to activate your account.
                </p>

                <div className="mt-8">
                  <p className="text-sm font-medium text-gray-700 mb-4">
                    Or enter the 6-digit code from your email:
                  </p>

                  {/* 6-digit code input boxes */}
                  <div
                    className="flex justify-center space-x-3 mb-6"
                    onPaste={handlePaste}
                  >
                    {code.map((digit, index) => (
                      <input
                        key={index}
                        ref={(el) => (inputRefs.current[index] = el)}
                        type="text"
                        inputMode="numeric"
                        maxLength={1}
                        value={digit}
                        onChange={(e) =>
                          handleCodeChange(
                            index,
                            e.target.value.replace(/\D/g, '')
                          )
                        }
                        onKeyDown={(e) => handleKeyDown(index, e)}
                        className="w-12 h-12 text-center text-xl font-bold border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                        autoComplete="one-time-code"
                      />
                    ))}
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting || code.join('').length !== 6}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        Verifying...
                      </>
                    ) : (
                      'Verify Email'
                    )}
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-200">
                  <p className="text-sm text-gray-600 mb-4">
                    Didn't receive the email? Check your spam folder or contact
                    support.
                  </p>

                  <div className="space-y-3">
                    <button
                      type="button"
                      onClick={handleResend}
                      disabled={isResending}
                      className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                      {isResending ? (
                        <>
                          <RefreshCw className="animate-spin -ml-1 mr-2 h-4 w-4" />
                          Resending...
                        </>
                      ) : (
                        'Resend Code'
                      )}
                    </button>

                    {!fromRegistration && (
                      <Link
                        to="/login"
                        className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                      >
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Login
                      </Link>
                    )}
                  </div>
                </div>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100">
                  <XCircle className="h-10 w-10 text-red-600" />
                </div>
                <h2 className="mt-6 text-2xl font-bold text-gray-900">
                  Verification Failed
                </h2>
                <p className="mt-3 text-sm text-gray-600">{message}</p>
                <div className="mt-8 space-y-3">
                  <button
                    onClick={() => setStatus('input')}
                    className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Try Again
                  </button>
                  <Link
                    to="/register"
                    className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-lg shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    Register Again
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
