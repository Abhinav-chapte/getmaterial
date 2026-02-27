import { createContext, useContext, useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  reload
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { toast } from 'react-toastify';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Sign Up ────────────────────────────────────────────────────
  const signup = async (email, password, userData) => {
    const result = await createUserWithEmailAndPassword(auth, email, password);

    // Send Firebase verification email immediately
    await sendEmailVerification(result.user);

    // Prepare base user document
    const userDoc = {
      userId: result.user.uid,
      name: userData.name,
      email: email,
      department: userData.department,
      role: userData.role,
      profilePicture: '',
      createdAt: new Date(),
      uploadCount: 0,
      downloadCount: 0,
      upvotesReceived: 0,
      emailVerified: false,
    };

    // Role-specific fields
    if (userData.role === 'student') {
      userDoc.collegeUSN = userData.collegeUSN;
      userDoc.year = userData.year;
    } else if (userData.role === 'professor') {
      userDoc.collegeID = userData.collegeID;
      userDoc.year = 'N/A';
    }

    await setDoc(doc(db, 'users', result.user.uid), userDoc);

    // Sign out immediately — they must verify email before accessing the app
    await signOut(auth);

    return result.user;
  };

  // ── Sign In ────────────────────────────────────────────────────
  const signin = async (email, password) => {
    const result = await signInWithEmailAndPassword(auth, email, password);

    // Reload user to get latest emailVerified status from Firebase
    await reload(result.user);

    if (!result.user.emailVerified) {
      // Sign them out immediately
      await signOut(auth);
      const error = new Error('Please verify your email before logging in. Check your inbox for the verification link.');
      error.code = 'auth/email-not-verified';
      throw error;
    }

    return result.user;
  };

  // ── Resend Verification Email ──────────────────────────────────
  const resendVerificationEmail = async (email, password) => {
    try {
      // Sign in temporarily to get user object
      const result = await signInWithEmailAndPassword(auth, email, password);
      await reload(result.user);

      if (result.user.emailVerified) {
        await signOut(auth);
        toast.info('Your email is already verified! Please login.');
        return false;
      }

      await sendEmailVerification(result.user);
      await signOut(auth);
      toast.success('✅ Verification email resent! Check your inbox.');
      return true;
    } catch (error) {
      console.error('Resend error:', error);
      throw error;
    }
  };

  // ── Logout ─────────────────────────────────────────────────────
  const logout = async () => {
    try {
      await signOut(auth);
      setUserProfile(null);
      toast.info('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to logout');
    }
  };

  // ── Fetch user profile from Firestore ─────────────────────────
  const fetchUserProfile = async (uid) => {
    try {
      const docSnap = await getDoc(doc(db, 'users', uid));
      if (docSnap.exists()) {
        setUserProfile(docSnap.data());
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    }
  };

  // ── Auth state listener ────────────────────────────────────────
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userProfile,
    signup,
    signin,
    logout,
    resendVerificationEmail,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};