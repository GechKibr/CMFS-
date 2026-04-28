import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import PublicNavbar from '../components/UI/PublicNavbar';
import PublicFooter from '../components/UI/PublicFooter';
import apiService from '../services/api';

const ForgotPassword = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [otp, setOtp] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [step, setStep] = useState('email');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const extractApiError = (rawError) => {
    const messageText = rawError?.message || '';
    const jsonStart = messageText.indexOf('{');
    if (jsonStart === -1) {
      return '';
    }

    try {
      const parsed = JSON.parse(messageText.slice(jsonStart));
      return parsed.error || parsed.detail || '';
    } catch {
      return '';
    }
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!identifier.trim()) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.requestPasswordReset(identifier.trim());
      setMaskedEmail(response?.masked_email || '');
      setMessage('If an account exists, an OTP has been sent to your email.');
      setStep('otp');
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError || 'Unable to process password reset request right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!otp.trim()) {
      setError('Please enter the OTP sent to your email.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiService.verifyPasswordResetOtp(identifier.trim(), otp.trim());
      const resetToken = response?.reset_token;
      if (!resetToken) {
        setError('Unable to verify OTP. Please request a new code.');
        return;
      }
      navigate(`/reset-password?reset_token=${encodeURIComponent(resetToken)}`);
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError || 'OTP is invalid or expired. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!identifier.trim()) {
      setStep('email');
      return;
    }

    setError('');
    setMessage('');
    setLoading(true);
    try {
      const response = await apiService.requestPasswordReset(identifier.trim());
      setMaskedEmail(response?.masked_email || maskedEmail);
      setMessage('If an account exists, a new OTP has been sent.');
    } catch (err) {
      const apiError = extractApiError(err);
      setError(apiError || 'Unable to resend OTP right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDark ? 'bg-gray-900' : 'bg-gray-50'}`}>
      <PublicNavbar />

      <div className="flex-1 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className={`${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'} max-w-md w-full p-8 rounded-2xl shadow-2xl border`}>
          <h2 className={`text-2xl font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-900'}`}>Forgot Password</h2>
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {step === 'email'
              ? 'Enter your email address to receive a one-time password.'
              : 'Enter the OTP sent to your email to continue.'}
          </p>

          {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}
          {message && <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">{message}</div>}

          {step === 'email' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                  placeholder="your-email@example.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Sending...' : 'Send OTP'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className={`block text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  OTP Code
                </label>
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={`mt-1 block w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${isDark ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-white border-gray-300 placeholder-gray-500'}`}
                  placeholder="Enter the 4-6 digit code"
                />
              </div>

              {maskedEmail && (
                <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Sent to {maskedEmail}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-2.5 px-4 rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50"
              >
                {loading ? 'Verifying...' : 'Verify OTP'}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleResend}
                className={`w-full py-2.5 px-4 rounded-lg border ${isDark ? 'border-gray-600 text-gray-200 hover:bg-gray-700' : 'border-gray-300 text-gray-700 hover:bg-gray-100'} disabled:opacity-50`}
              >
                Resend OTP
              </button>
            </form>
          )}

          <p className={`mt-4 text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Remembered your password? <Link to="/login" className="text-blue-600 hover:text-blue-500">Back to login</Link>
          </p>
        </div>
      </div>

      <PublicFooter />
    </div>
  );
};

export default ForgotPassword;
