import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen, Rocket, Mail, Lock, User, GraduationCap,
  Hash, ArrowLeft, Eye, EyeOff, CheckCircle, RefreshCw
} from 'lucide-react';
import { toast } from 'react-toastify';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup, signin, resendVerificationEmail } = useAuth();

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // ── Email verification screen state ──
  // Shown after successful signup
  const [showVerifyScreen, setShowVerifyScreen] = useState(false);
  const [verifyEmail, setVerifyEmail] = useState('');
  const [verifyPassword, setVerifyPassword] = useState(''); // kept temporarily to allow resend
  const [resending, setResending] = useState(false);

  // ── OTP / Forgot Password states ──
  const [showOtpLogin, setShowOtpLogin] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    collegeUSN: '',
    collegeID: '',
    department: '',
    year: '',
    password: '',
    confirmPassword: '',
  });

  const departments = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AI/ML', 'ISE', 'DS', 'RA'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'collegeUSN') {
      setFormData({ ...formData, [name]: value.toUpperCase() });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isSignUp) {
        // ── Validations ──
        if (formData.password !== formData.confirmPassword) {
          toast.error('Passwords do not match!');
          setLoading(false);
          return;
        }
        if (formData.password.length < 6) {
          toast.error('Password must be at least 6 characters');
          setLoading(false);
          return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          toast.error('Please enter a valid email address');
          setLoading(false);
          return;
        }
        if (!formData.email.endsWith('@gmail.com') && !formData.email.endsWith('@gndec.ac.in')) {
          const proceed = window.confirm(
            'You are using a non-Gmail/non-college email. We recommend using Gmail for better reliability. Continue anyway?'
          );
          if (!proceed) { setLoading(false); return; }
        }
        if (role === 'student') {
          if (!formData.collegeUSN.startsWith('3GN')) {
            toast.error('Invalid USN! Must start with "3GN" (GNDEC Bidar code)');
            setLoading(false);
            return;
          }
          if (formData.collegeUSN.length !== 10) {
            toast.error('USN must be 10 characters (e.g., 3GN21IS001)');
            setLoading(false);
            return;
          }
          if (!formData.year) {
            toast.error('Please select your year');
            setLoading(false);
            return;
          }
        }
        if (role === 'professor') {
          if (!formData.collegeID || formData.collegeID.trim().length < 4) {
            toast.error('College ID must be at least 4 characters');
            setLoading(false);
            return;
          }
        }
        if (!formData.department) {
          toast.error('Please select your department');
          setLoading(false);
          return;
        }

        const userData = {
          name: formData.name,
          department: formData.department,
          role,
          ...(role === 'student'
            ? { collegeUSN: formData.collegeUSN, year: formData.year }
            : { collegeID: formData.collegeID, year: 'N/A' }),
        };

        await signup(formData.email, formData.password, userData);

        // ── Show email verification screen ──
        setVerifyEmail(formData.email);
        setVerifyPassword(formData.password);
        setShowVerifyScreen(true);

        // Reset form
        setFormData({
          name: '', email: '', collegeUSN: '', collegeID: '',
          department: '', year: '', password: '', confirmPassword: '',
        });

      } else {
        // ── Login ──
        await signin(formData.email, formData.password);
        toast.success('Welcome back!');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Auth error:', error);

      if (error.code === 'auth/email-not-verified') {
        // Show verify screen with resend option
        setVerifyEmail(formData.email);
        setVerifyPassword(formData.password);
        setShowVerifyScreen(true);
        toast.warning('Please verify your email first!');
      } else if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please login instead.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address format');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Use at least 6 characters.');
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        toast.error('No account found with this email. Please sign up first.');
      } else if (error.code === 'auth/wrong-password') {
        toast.error('Incorrect password. Please try again.');
      } else if (error.code === 'auth/too-many-requests') {
        toast.error('Too many failed attempts. Please try again later.');
      } else {
        toast.error(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // ── Resend verification email ──
  const handleResendVerification = async () => {
    setResending(true);
    try {
      await resendVerificationEmail(verifyEmail, verifyPassword);
    } catch (error) {
      if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        toast.error('Could not resend. Please try logging in again.');
      } else {
        toast.error('Failed to resend. Please try again.');
      }
    } finally {
      setResending(false);
    }
  };

  // ── Forgot Password (Firebase reset email) ──
  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!otpEmail) { toast.error('Please enter your email'); return; }
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, otpEmail);
      toast.success(`✅ Password reset email sent to ${otpEmail}! Check your inbox.`);
      setOtpSent(true);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email.');
      } else {
        toast.error('Failed to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    setShowOtpLogin(false);
    setOtpEmail('');
    setOtpSent(false);
  };

  // ════════════════════════════════════════════════════════════
  // EMAIL VERIFICATION SCREEN
  // ════════════════════════════════════════════════════════════
  if (showVerifyScreen) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 flex items-center justify-center p-4">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-10 w-72 h-72 bg-white opacity-10 rounded-full blur-3xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300 opacity-10 rounded-full blur-3xl animate-pulse delay-1000"></div>
        </div>

        <div className="relative z-10 bg-white rounded-2xl shadow-2xl p-10 max-w-md w-full text-center">
          {/* Icon */}
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-purple-200 rounded-full blur-2xl opacity-40 animate-pulse"></div>
            <div className="relative w-24 h-24 bg-gradient-to-br from-purple-100 to-blue-100 rounded-full flex items-center justify-center mx-auto shadow-xl">
              <Mail className="w-12 h-12 text-purple-600" />
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-800 mb-2">Verify Your Email</h2>
          <p className="text-gray-600 mb-1">We've sent a verification link to:</p>
          <p className="font-bold text-purple-700 text-lg mb-6 break-all">{verifyEmail}</p>

          {/* Steps */}
          <div className="bg-purple-50 border border-purple-100 rounded-xl p-5 mb-6 text-left space-y-3">
            {[
              'Open your email inbox',
              'Find email from Firebase / Get Notes',
              'Click the verification link',
              'Come back here and login',
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 bg-purple-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {i + 1}
                </div>
                <p className="text-sm text-gray-700">{step}</p>
              </div>
            ))}
          </div>

          {/* Spam notice */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-6">
            <p className="text-xs text-yellow-800">
              📁 <strong>Don't see it?</strong> Check your <strong>Spam / Junk</strong> folder.
              The email comes from <strong>noreply@get-notes-delta.firebaseapp.com</strong>
            </p>
          </div>

          {/* Buttons */}
          <button
            onClick={handleResendVerification}
            disabled={resending}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-60 mb-3"
          >
            {resending ? (
              <RefreshCw className="w-5 h-5 animate-spin" />
            ) : (
              <RefreshCw className="w-5 h-5" />
            )}
            {resending ? 'Sending...' : 'Resend Verification Email'}
          </button>

          <button
            onClick={() => {
              setShowVerifyScreen(false);
              setIsSignUp(false);
              setVerifyEmail('');
              setVerifyPassword('');
            }}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Login
          </button>

          <p className="text-xs text-gray-400 mt-4">
            After verifying, return here and sign in with your email and password.
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // MAIN AUTH FORM
  // ════════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white opacity-10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300 opacity-10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-6xl mx-auto grid md:grid-cols-2 gap-8 relative z-10">
        {/* Left Branding */}
        <div className="hidden md:flex flex-col justify-center text-white space-y-6 p-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="bg-white bg-opacity-20 p-3 rounded-xl backdrop-blur-sm">
              <BookOpen className="w-10 h-10" />
            </div>
            <div>
              <h1 className="text-5xl font-bold flex items-center gap-2">
                Get Notes <Rocket className="w-10 h-10" />
              </h1>
              <p className="text-purple-100 text-sm mt-1">
                Guru Nanak Dev Engineering College Bidar
              </p>
            </div>
          </div>
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold">Your College Study Hub</h2>
            <p className="text-xl text-purple-100">Share Notes. Build Together. Excel Together.</p>
          </div>
          <div className="space-y-3 mt-8">
            {[
              { icon: BookOpen, title: 'Organized Materials', sub: 'By department and semester' },
              { icon: GraduationCap, title: 'Quality Content', sub: 'Upvoted by your peers' },
              { icon: CheckCircle, title: 'Verified Users Only', sub: 'Email verified accounts' },
            ].map(({ icon: Icon, title, sub }) => (
              <div key={title} className="flex items-center space-x-3 bg-white bg-opacity-10 p-4 rounded-lg backdrop-blur-sm">
                <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                  <Icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold">{title}</h3>
                  <p className="text-sm text-purple-100">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm bg-opacity-95">
          {!showOtpLogin ? (
            <>
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-gray-600 mt-2">
                  {isSignUp ? 'Join Get Notes today' : 'Sign in to continue'}
                </p>
              </div>

              {/* Role Toggle */}
              {isSignUp && (
                <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                  {['student', 'professor'].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRole(r)}
                      className={`flex-1 py-2 px-4 rounded-md font-medium transition-all capitalize ${
                        role === r
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                          : 'text-gray-600 hover:text-gray-800'
                      }`}
                    >
                      {r === 'student' ? '🎓 Student' : '👨‍🏫 Professor'}
                    </button>
                  ))}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Abhinav Chapte"
                        required
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="student@gmail.com"
                      required
                    />
                  </div>
                </div>

                {isSignUp && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {role === 'student' ? 'College USN' : 'College ID'}
                      </label>
                      <div className="relative">
                        <Hash className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          name={role === 'student' ? 'collegeUSN' : 'collegeID'}
                          value={role === 'student' ? formData.collegeUSN : formData.collegeID}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                          placeholder={role === 'student' ? '3GN21IS001' : 'PROF001'}
                          required
                        />
                      </div>
                      {role === 'student' && (
                        <p className="text-xs text-gray-500 mt-1">
                          ⓘ USN must start with "3GN" (GNDEC Bidar code)
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                        <select
                          name="department"
                          value={formData.department}
                          onChange={handleChange}
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          required
                        >
                          <option value="">Select</option>
                          {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                          ))}
                        </select>
                      </div>
                      {role === 'student' && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                          <select
                            name="year"
                            value={formData.year}
                            onChange={handleChange}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                            required
                          >
                            <option value="">Select</option>
                            <option value="1st Year">1st Year</option>
                            <option value="2nd Year">2nd Year</option>
                            <option value="3rd Year">3rd Year</option>
                            <option value="4th Year">4th Year</option>
                          </select>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                      />
                      <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Please wait...' : isSignUp ? 'Create Account' : 'Sign In'}
                </button>

                {!isSignUp && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowOtpLogin(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                )}
              </form>

              <div className="mt-6 text-center">
                <p className="text-gray-600">
                  {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
                  <button
                    onClick={() => setIsSignUp(!isSignUp)}
                    className="text-purple-600 font-semibold hover:text-purple-700"
                  >
                    {isSignUp ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </div>
            </>
          ) : (
            /* ── Forgot Password ── */
            <>
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">🔐 Reset Password</h2>
                <p className="text-gray-600">
                  {otpSent
                    ? 'Check your inbox for the reset link'
                    : 'Enter your email to receive a reset link'}
                </p>
              </div>

              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="email"
                        placeholder="Enter your registered email"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : '📧 Send Reset Email'}
                  </button>
                  <button type="button" onClick={handleBackToLogin} className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 font-medium py-2">
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                  </button>
                </form>
              ) : (
                <div className="space-y-4 text-center">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="font-semibold text-green-800">Reset email sent!</p>
                    <p className="text-sm text-green-700 mt-1">
                      Check your inbox at <strong>{otpEmail}</strong> and click the reset link.
                    </p>
                    <p className="text-xs text-green-600 mt-2">Also check your Spam folder.</p>
                  </div>
                  <button type="button" onClick={handleBackToLogin} className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 font-medium py-2 border-2 border-gray-200 rounded-lg hover:bg-gray-50">
                    <ArrowLeft className="w-4 h-4" /> Back to Login
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;