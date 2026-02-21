import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Rocket, Mail, Lock, User, GraduationCap, Briefcase, Hash, ArrowLeft } from 'lucide-react';
import { toast } from 'react-toastify';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase/config';

const AuthPage = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [role, setRole] = useState('student');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signup, signin } = useAuth();

  // OTP Login States
  const [showOtpLogin, setShowOtpLogin] = useState(false);
  const [otpEmail, setOtpEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    collegeUSN: '', // For students
    collegeID: '', // For professors
    department: '',
    year: '',
    password: '',
    confirmPassword: ''
  });

  const departments = [
    'CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AI/ML', 'ISE', 'DS', 'RA'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Special handling for USN - auto-capitalize
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
        // Validation
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

        // Email validation - check if it looks like a real email
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
          toast.error('Please enter a valid email address');
          setLoading(false);
          return;
        }

        // Warn if using non-Gmail email (optional)
        if (!formData.email.endsWith('@gmail.com') && !formData.email.endsWith('@gndec.ac.in')) {
          const proceed = window.confirm(
            'You are using a non-Gmail/non-college email. We recommend using Gmail for better reliability. Continue anyway?'
          );
          if (!proceed) {
            setLoading(false);
            return;
          }
        }

        // Student-specific validation
        if (role === 'student') {
          // Validate USN starts with 3GN
          if (!formData.collegeUSN.startsWith('3GN')) {
            toast.error('Invalid USN! Student USN must start with "3GN" (GNDEC Bidar college code)');
            setLoading(false);
            return;
          }

          // Validate USN length (typically 10 characters: 3GN21IS001)
          if (formData.collegeUSN.length !== 10) {
            toast.error('Invalid USN format! USN should be 10 characters (e.g., 3GN21IS001)');
            setLoading(false);
            return;
          }

          // Validate year is selected
          if (!formData.year) {
            toast.error('Please select your year');
            setLoading(false);
            return;
          }
        }

        // Professor-specific validation
        if (role === 'professor') {
          // Validate College ID is provided
          if (!formData.collegeID || formData.collegeID.trim().length === 0) {
            toast.error('Please enter your College ID');
            setLoading(false);
            return;
          }

          // Validate College ID format (at least 4 characters)
          if (formData.collegeID.trim().length < 4) {
            toast.error('College ID must be at least 4 characters');
            setLoading(false);
            return;
          }
        }

        // Validate department is selected
        if (!formData.department) {
          toast.error('Please select your department');
          setLoading(false);
          return;
        }

        // Prepare user data based on role
        const userData = {
          name: formData.name,
          department: formData.department,
          role: role
        };

        // Add role-specific fields
        if (role === 'student') {
          userData.collegeUSN = formData.collegeUSN;
          userData.year = formData.year;
        } else {
          userData.collegeID = formData.collegeID;
          userData.year = 'N/A'; // Professors don't have year
        }

        await signup(formData.email, formData.password, userData);
        toast.success('Account created successfully! Please verify your email.');
      } else {
        await signin(formData.email, formData.password);
        toast.success('Welcome back!');
      }
      navigate('/dashboard');
    } catch (error) {
      console.error('Auth error:', error);
      
      // Handle specific Firebase errors
      if (error.code === 'auth/email-already-in-use') {
        toast.error('This email is already registered. Please login instead.');
      } else if (error.code === 'auth/invalid-email') {
        toast.error('Invalid email address format');
      } else if (error.code === 'auth/weak-password') {
        toast.error('Password is too weak. Use at least 6 characters.');
      } else if (error.code === 'auth/user-not-found') {
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

  // Handle Send OTP
  const handleSendOtp = async (e) => {
    e.preventDefault();
    
    if (!otpEmail) {
      toast.error('Please enter your email');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(otpEmail)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      // Generate 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Store OTP in localStorage with timestamp (expires in 10 minutes)
      const otpData = {
        code: otp,
        email: otpEmail,
        timestamp: Date.now(),
        expiresIn: 10 * 60 * 1000 // 10 minutes
      };
      localStorage.setItem('otp_data', JSON.stringify(otpData));

      // For demo: Show OTP in console and toast
      // In production, integrate email service (SendGrid, AWS SES, etc.)
      console.log('🔐 OTP Code for', otpEmail, ':', otp);
      
      toast.success(
        `📧 OTP sent to ${otpEmail}!\n\n🔑 Demo OTP: ${otp}\n\n(Check console for code)`, 
        { autoClose: 15000 }
      );
      
      setOtpSent(true);
      
    } catch (error) {
      console.error('Error sending OTP:', error);
      toast.error('Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP and Reset Password
  const handleVerifyOtp = async (e) => {
    e.preventDefault();

    if (!otpCode) {
      toast.error('Please enter the OTP code');
      return;
    }

    if (otpCode.length !== 6) {
      toast.error('OTP must be 6 digits');
      return;
    }

    setLoading(true);

    try {
      // Retrieve stored OTP
      const storedOtpData = localStorage.getItem('otp_data');
      
      if (!storedOtpData) {
        toast.error('OTP expired. Please request a new one.');
        setOtpSent(false);
        setLoading(false);
        return;
      }

      const otpData = JSON.parse(storedOtpData);
      
      // Check if OTP expired (10 minutes)
      const currentTime = Date.now();
      if (currentTime - otpData.timestamp > otpData.expiresIn) {
        toast.error('OTP expired. Please request a new one.');
        localStorage.removeItem('otp_data');
        setOtpSent(false);
        setLoading(false);
        return;
      }

      // Verify OTP matches
      if (otpCode !== otpData.code) {
        toast.error('Invalid OTP. Please check and try again.');
        setLoading(false);
        return;
      }

      // Verify email matches
      if (otpEmail.toLowerCase() !== otpData.email.toLowerCase()) {
        toast.error('Email mismatch. Please try again.');
        setLoading(false);
        return;
      }

      // OTP verified! Send password reset email
      await sendPasswordResetEmail(auth, otpEmail);
      
      toast.success('✅ OTP Verified! Password reset email sent to your inbox. Check your email to set a new password.');
      
      // Clean up
      localStorage.removeItem('otp_data');
      
      // Reset form and go back to login
      setShowOtpLogin(false);
      setOtpEmail('');
      setOtpCode('');
      setOtpSent(false);
      setIsSignUp(false);

    } catch (error) {
      console.error('Error verifying OTP:', error);
      if (error.code === 'auth/user-not-found') {
        toast.error('No account found with this email. Please sign up first.');
      } else {
        toast.error(error.message || 'Verification failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle Resend OTP
  const handleResendOtp = () => {
    setOtpSent(false);
    setOtpCode('');
    localStorage.removeItem('otp_data');
    toast.info('Ready to send new OTP');
  };

  // Handle Back to Login
  const handleBackToLogin = () => {
    setShowOtpLogin(false);
    setOtpEmail('');
    setOtpCode('');
    setOtpSent(false);
    localStorage.removeItem('otp_data');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 flex items-center justify-center p-4">
      {/* Animated background shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-white opacity-10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-300 opacity-10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="w-full max-w-6xl mx-auto grid md:grid-cols-2 gap-8 relative z-10">
        {/* Left Side - Branding */}
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
            <h2 className="text-3xl font-semibold">
              Your College Study Hub
            </h2>
            <p className="text-xl text-purple-100">
              Share Notes. Build Together. Excel Together.
            </p>
          </div>

          <div className="space-y-3 mt-8">
            <div className="flex items-center space-x-3 bg-white bg-opacity-10 p-4 rounded-lg backdrop-blur-sm">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Organized Materials</h3>
                <p className="text-sm text-purple-100">By department and semester</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 bg-white bg-opacity-10 p-4 rounded-lg backdrop-blur-sm">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <GraduationCap className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-semibold">Quality Content</h3>
                <p className="text-sm text-purple-100">Upvoted by your peers</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 backdrop-blur-sm bg-opacity-95">
          {!showOtpLogin ? (
            <>
              {/* Regular Login/Signup Form */}
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800">
                  {isSignUp ? 'Create Account' : 'Welcome Back'}
                </h2>
                <p className="text-gray-600 mt-2">
                  {isSignUp ? 'Join Get Notes today' : 'Sign in to continue'}
                </p>
              </div>

              {/* Role Toggle */}
              <div className="flex gap-2 mb-6 bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                    role === 'student'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  🎓 Student
                </button>
                <button
                  type="button"
                  onClick={() => setRole('professor')}
                  className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                    role === 'professor'
                      ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-md'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  👨‍🏫 Professor
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Full Name
                    </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
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
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Department
                        </label>
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
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Year
                          </label>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder="••••••••"
                      required
                    />
                  </div>
                </div>

                {isSignUp && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type="password"
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
                </button>

                {/* Forgot Password Link - Only show on login */}
                {!isSignUp && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={() => setShowOtpLogin(true)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium hover:underline"
                    >
                      Forgot Password? Login with OTP
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
            <>
              {/* OTP Login Form */}
              <div className="text-center mb-6">
                <h2 className="text-3xl font-bold text-gray-800 mb-2">
                  🔐 Login with OTP
                </h2>
                <p className="text-gray-600">
                  {otpSent ? 'Enter the 6-digit OTP sent to your email' : 'Enter your email to receive OTP'}
                </p>
              </div>

              {!otpSent ? (
                // Step 1: Email Input
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                    </label>
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
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Sending OTP...' : '📧 Send OTP'}
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 font-medium py-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </button>
                </form>
              ) : (
                // Step 2: OTP Verification
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-4 mb-4">
                    <p className="text-sm text-blue-800 font-medium">
                      📧 OTP sent to: <strong>{otpEmail}</strong>
                    </p>
                    <p className="text-xs text-blue-600 mt-2">
                      ⏱️ Valid for 10 minutes • Check your inbox and spam folder
                    </p>
                    <p className="text-xs text-purple-600 mt-1 font-medium">
                      🔑 Demo: Check browser console for OTP code
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1 text-center">
                      Enter 6-Digit OTP
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="000000"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        maxLength={6}
                        className="w-full px-4 py-4 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-center text-3xl font-bold tracking-widest"
                        required
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || otpCode.length !== 6}
                    className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 rounded-lg font-semibold hover:shadow-lg transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? 'Verifying...' : '✅ Verify OTP & Reset Password'}
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="w-full text-purple-600 hover:text-purple-700 font-medium py-2 hover:underline"
                  >
                    🔄 Resend OTP
                  </button>

                  <button
                    type="button"
                    onClick={handleBackToLogin}
                    className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800 font-medium py-2"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </button>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;