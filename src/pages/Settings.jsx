import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { User, Lock, Shield, Database, Trash2, Eye, EyeOff, Mail, Hash, Building2, GraduationCap, Loader } from 'lucide-react';
import { updatePassword, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, updateDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';
import { toast } from 'react-toastify';
import { clearAllOfflineFiles, getOfflineStorageSize, getOfflineFileCount } from '../utils/offlineStorage';

const Settings = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('account');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Password change states
  const [passwordData, setPasswordData] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  // Storage info
  const [storageSize, setStorageSize] = useState(0);
  const [fileCount, setFileCount] = useState(0);

  // ── Privacy toggle states ──────────────────────────────────────
  const [privacySettings, setPrivacySettings] = useState({
    emailNotifications: false,
    autoDownloadOffline: false,
  });
  const [privacyLoading, setPrivacyLoading] = useState(true);
  const [savingToggle, setSavingToggle] = useState(null); // which toggle is saving

  // Load privacy settings from Firestore on mount
  useEffect(() => {
    const loadPrivacySettings = async () => {
      if (!currentUser) return;
      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setPrivacySettings({
            emailNotifications: data.emailNotifications ?? false,
            autoDownloadOffline: data.autoDownloadOffline ?? false,
          });
        }
      } catch (error) {
        console.error('Error loading privacy settings:', error);
      } finally {
        setPrivacyLoading(false);
      }
    };
    loadPrivacySettings();
  }, [currentUser]);

  // Load storage info on mount
  useEffect(() => {
    const loadStorageInfo = async () => {
      const size = await getOfflineStorageSize();
      const count = await getOfflineFileCount();
      setStorageSize(size);
      setFileCount(count);
    };
    loadStorageInfo();
  }, []);

  // Toggle a privacy setting and immediately save to Firestore
  const handleToggle = async (key) => {
    const newValue = !privacySettings[key];

    // Optimistically update UI
    setPrivacySettings(prev => ({ ...prev, [key]: newValue }));
    setSavingToggle(key);

    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        [key]: newValue,
      });
      toast.success(
        newValue
          ? `${key === 'emailNotifications' ? 'Email notifications' : 'Auto-download'} enabled`
          : `${key === 'emailNotifications' ? 'Email notifications' : 'Auto-download'} disabled`,
        { autoClose: 1500 }
      );
    } catch (error) {
      console.error('Error saving setting:', error);
      // Revert on error
      setPrivacySettings(prev => ({ ...prev, [key]: !newValue }));
      toast.error('Failed to save setting. Please try again.');
    } finally {
      setSavingToggle(null);
    }
  };
  // ──────────────────────────────────────────────────────────────

  const isStudent = userProfile?.role === 'student';

  const handlePasswordChange = async (e) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (passwordData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      await updatePassword(auth.currentUser, passwordData.newPassword);
      toast.success('Password updated successfully!');
      setPasswordData({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please logout and login again to change password');
      } else {
        toast.error('Failed to update password');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearOfflineFiles = async () => {
    if (!window.confirm('Are you sure you want to clear all offline files? This cannot be undone.')) return;
    try {
      await clearAllOfflineFiles();
      setStorageSize(0);
      setFileCount(0);
      toast.success('All offline files cleared!');
    } catch (error) {
      console.error('Error clearing offline files:', error);
      toast.error('Failed to clear offline files');
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.prompt(
      'This will permanently delete your account and all your data. Type "DELETE" to confirm:'
    );
    if (confirmation !== 'DELETE') {
      toast.info('Account deletion cancelled');
      return;
    }

    setLoading(true);
    try {
      await deleteDoc(doc(db, 'users', currentUser.uid));

      const collections = ['notes', 'votes', 'bookmarks', 'downloads'];
      const fields = ['uploaderId', 'userId', 'userId', 'userId'];
      for (let i = 0; i < collections.length; i++) {
        const q = query(collection(db, collections[i]), where(fields[i], '==', currentUser.uid));
        const snap = await getDocs(q);
        for (const d of snap.docs) await deleteDoc(d.ref);
      }

      await deleteUser(auth.currentUser);
      toast.success('Account deleted successfully');
      logout();
    } catch (error) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please logout and login again to delete account');
      } else {
        toast.error('Failed to delete account');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  // Reusable toggle row component
  const ToggleRow = ({ label, description, settingKey }) => {
    const isOn = privacySettings[settingKey];
    const isSaving = savingToggle === settingKey;

    return (
      <div className="flex items-center justify-between p-4 bg-transparent rounded-lg">
        <div>
          <p className="font-semibold text-gray-800">{label}</p>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <button
          onClick={() => handleToggle(settingKey)}
          disabled={privacyLoading || isSaving}
          className="relative flex-shrink-0 focus:outline-none"
          aria-label={`Toggle ${label}`}
        >
          {isSaving ? (
            <div className="w-11 h-6 flex items-center justify-center">
              <Loader className="w-4 h-4 animate-spin text-purple-500" />
            </div>
          ) : (
            <div
              className={`w-11 h-6 rounded-full transition-colors duration-200 ${
                isOn ? 'bg-purple-600' : 'bg-gray-200'
              }`}
            >
              <div
                className={`absolute top-[2px] h-5 w-5 bg-white border border-gray-300 rounded-full shadow transition-transform duration-200 ${
                  isOn ? 'translate-x-5' : 'translate-x-0.5'
                }`}
              />
            </div>
          )}
        </button>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="flex border-b">
            {[
              { id: 'account', label: 'Account', icon: User },
              { id: 'privacy', label: 'Privacy', icon: Shield },
              { id: 'storage', label: 'Storage', icon: Database },
              { id: 'danger', label: 'Danger Zone', icon: Trash2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex-1 py-4 px-6 font-semibold transition-colors flex items-center justify-center gap-2 ${
                  activeTab === id
                    ? id === 'danger'
                      ? 'text-red-600 border-b-2 border-red-600'
                      : 'text-purple-600 border-b-2 border-purple-600'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Icon className="w-5 h-5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-md p-6">

          {/* ── Account Tab ── */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Account Information</h2>
                <div className="space-y-4">
                  {[
                    { icon: User, label: 'Full Name', value: userProfile?.name },
                    { icon: Mail, label: 'Email Address', value: currentUser?.email },
                    {
                      icon: Hash,
                      label: isStudent ? 'College USN' : 'College ID',
                      value: isStudent ? userProfile?.collegeUSN : userProfile?.collegeID,
                    },
                    { icon: Building2, label: 'Department', value: userProfile?.department },
                    ...(isStudent ? [{ icon: GraduationCap, label: 'Year', value: userProfile?.year }] : []),
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-4 p-4 bg-transparent rounded-lg">
                      <Icon className="w-6 h-6 text-purple-600" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">{label}</p>
                        <p className="text-lg font-semibold text-gray-800">{value}</p>
                      </div>
                    </div>
                  ))}

                  <button
                    onClick={() => window.location.href = '/dashboard/profile'}
                    className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-teal-500 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Change Password</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  {[
                    {
                      label: 'New Password',
                      key: 'newPassword',
                      show: showNewPassword,
                      setShow: setShowNewPassword,
                    },
                    {
                      label: 'Confirm New Password',
                      key: 'confirmPassword',
                      show: showPassword,
                      setShow: setShowPassword,
                    },
                  ].map(({ label, key, show, setShow }) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                        <input
                          type={show ? 'text' : 'password'}
                          value={passwordData[key]}
                          onChange={(e) => setPasswordData({ ...passwordData, [key]: e.target.value })}
                          className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder={label}
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShow(!show)}
                          className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                        >
                          {show ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-semibold disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Update Password'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ── Privacy Tab ── */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Privacy Settings</h2>

              {privacyLoading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader className="w-7 h-7 animate-spin text-purple-600" />
                </div>
              ) : (
                <div className="space-y-2">
                  <ToggleRow
                    label="Email Notifications"
                    description="Receive updates about new uploads"
                    settingKey="emailNotifications"
                  />
                  <ToggleRow
                    label="Auto-download for Offline"
                    description="Automatically save files offline"
                    settingKey="autoDownloadOffline"
                  />
                </div>
              )}

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-6">
                <p className="text-sm text-blue-800">
                  <strong>Privacy Information:</strong> Your data is stored securely using Firebase and is
                  only accessible by you. We do not share your information with third parties.
                </p>
              </div>
            </div>
          )}

          {/* ── Storage Tab ── */}
          {activeTab === 'storage' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Offline Storage</h2>
              <div className="space-y-4">
                <div className="p-6 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Storage Used</p>
                      <p className="text-3xl font-bold text-purple-600">{formatBytes(storageSize)}</p>
                    </div>
                    <Database className="w-12 h-12 text-purple-400" />
                  </div>
                  <p className="text-sm text-gray-600">{fileCount} files stored offline</p>
                </div>

                <button
                  onClick={handleClearOfflineFiles}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Clear All Offline Files
                </button>
              </div>

              <div className="p-4 bg-transparent border border-gray-200 rounded-lg">
                <p className="text-sm text-gray-700">
                  <strong>About Offline Storage:</strong> Downloaded files are stored in your browser's
                  IndexedDB for offline access. Clearing this will not delete files from the server.
                </p>
              </div>
            </div>
          )}

          {/* ── Danger Zone Tab ── */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="border-2 border-red-300 rounded-lg p-6 bg-red-50">
                <h2 className="text-xl font-bold text-red-600 mb-2 flex items-center gap-2">
                  <Trash2 className="w-6 h-6" />
                  Delete Account
                </h2>
                <p className="text-gray-700 mb-4">
                  Once you delete your account, there is no going back. This will permanently delete:
                </p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 mb-6">
                  <li>Your profile information</li>
                  <li>All notes you've uploaded</li>
                  <li>Your votes and bookmarks</li>
                  <li>Your download history</li>
                </ul>
                <button
                  onClick={handleDeleteAccount}
                  disabled={loading}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  {loading ? 'Deleting...' : 'Delete My Account Permanently'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Settings;