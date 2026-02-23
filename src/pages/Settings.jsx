import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { User, Lock, Shield, Database, Trash2, Save, Eye, EyeOff, Mail, Hash, Building2, GraduationCap } from 'lucide-react';
import { updatePassword, deleteUser } from 'firebase/auth';
import { doc, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
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

  // Load storage info
  useState(() => {
    const loadStorageInfo = async () => {
      const size = await getOfflineStorageSize();
      const count = await getOfflineFileCount();
      setStorageSize(size);
      setFileCount(count);
    };
    loadStorageInfo();
  }, []);

  const isStudent = userProfile?.role === 'student';
  const isProfessor = userProfile?.role === 'professor';

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
    if (!window.confirm('Are you sure you want to clear all offline files? This cannot be undone.')) {
      return;
    }

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
      // Delete user document
      await deleteDoc(doc(db, 'users', currentUser.uid));

      // Delete user's notes
      const notesQuery = query(collection(db, 'notes'), where('uploaderId', '==', currentUser.uid));
      const notesSnapshot = await getDocs(notesQuery);
      for (const noteDoc of notesSnapshot.docs) {
        await deleteDoc(noteDoc.ref);
      }

      // Delete user's votes
      const votesQuery = query(collection(db, 'votes'), where('userId', '==', currentUser.uid));
      const votesSnapshot = await getDocs(votesQuery);
      for (const voteDoc of votesSnapshot.docs) {
        await deleteDoc(voteDoc.ref);
      }

      // Delete user's bookmarks
      const bookmarksQuery = query(collection(db, 'bookmarks'), where('userId', '==', currentUser.uid));
      const bookmarksSnapshot = await getDocs(bookmarksQuery);
      for (const bookmarkDoc of bookmarksSnapshot.docs) {
        await deleteDoc(bookmarkDoc.ref);
      }

      // Delete user's downloads
      const downloadsQuery = query(collection(db, 'downloads'), where('userId', '==', currentUser.uid));
      const downloadsSnapshot = await getDocs(downloadsQuery);
      for (const downloadDoc of downloadsSnapshot.docs) {
        await deleteDoc(downloadDoc.ref);
      }

      // Delete Firebase Auth user
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
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Settings</h1>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md mb-6">
          <div className="flex border-b">
            <button
              onClick={() => setActiveTab('account')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'account'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <User className="w-5 h-5" />
              Account
            </button>
            <button
              onClick={() => setActiveTab('privacy')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'privacy'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Shield className="w-5 h-5" />
              Privacy
            </button>
            <button
              onClick={() => setActiveTab('storage')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'storage'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Database className="w-5 h-5" />
              Storage
            </button>
            <button
              onClick={() => setActiveTab('danger')}
              className={`flex-1 py-4 px-6 font-semibold transition-colors flex items-center justify-center gap-2 ${
                activeTab === 'danger'
                  ? 'text-red-600 border-b-2 border-red-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl shadow-md p-6">
          {/* Account Tab */}
          {activeTab === 'account' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Account Information</h2>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 p-4  bg-transparent rounded-lg">
                    <User className="w-6 h-6 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Full Name</p>
                      <p className="text-lg font-semibold text-gray-800">{userProfile?.name}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4  bg-transparent rounded-lg">
                    <Mail className="w-6 h-6 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Email Address</p>
                      <p className="text-lg font-semibold text-gray-800">{currentUser?.email}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4  bg-transparent rounded-lg">
                    <Hash className="w-6 h-6 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">
                        {isStudent ? 'College USN' : 'College ID'}
                      </p>
                      <p className="text-lg font-semibold text-gray-800">
                        {isStudent ? userProfile?.collegeUSN : userProfile?.collegeID}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 p-4  bg-transparent rounded-lg">
                    <Building2 className="w-6 h-6 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm text-gray-500">Department</p>
                      <p className="text-lg font-semibold text-gray-800">{userProfile?.department}</p>
                    </div>
                  </div>

                  {isStudent && (
                    <div className="flex items-center gap-4 p-4  bg-transparent rounded-lg">
                      <GraduationCap className="w-6 h-6 text-purple-600" />
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">Year</p>
                        <p className="text-lg font-semibold text-gray-800">{userProfile?.year}</p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => window.location.href = '/dashboard/profile'}
                    className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-600 to-teal-500 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all"
                  >
                    Edit Profile
                  </button>
                </div>
              </div>

              <div className="pt-6 border-t">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Change Password</h3>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordData.newPassword}
                        onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                        className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Enter new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordData.confirmPassword}
                        onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                        className="w-full pl-10 pr-12 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Confirm new password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

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

          {/* Privacy Tab */}
          {activeTab === 'privacy' && (
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-800 mb-4">Privacy Settings</h2>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4  bg-transparent rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-800">Email Notifications</p>
                    <p className="text-sm text-gray-600">Receive updates about new uploads</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between p-4  bg-transparent rounded-lg">
                  <div>
                    <p className="font-semibold text-gray-800">Auto-download for Offline</p>
                    <p className="text-sm text-gray-600">Automatically save files offline</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>
              </div>

              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mt-6">
                <p className="text-sm text-blue-800">
                  <strong>Privacy Information:</strong> Your data is stored securely using Firebase and is only accessible by you. 
                  We do not share your information with third parties.
                </p>
              </div>
            </div>
          )}

          {/* Storage Tab */}
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
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <p>{fileCount} files stored offline</p>
                  </div>
                </div>

                <button
                  onClick={handleClearOfflineFiles}
                  className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" />
                  Clear All Offline Files
                </button>
              </div>

              <div className="p-4  bg-transparent border border-gray-200 rounded-lg mt-6">
                <p className="text-sm text-gray-700">
                  <strong>About Offline Storage:</strong> Downloaded files are stored in your browser's IndexedDB 
                  for offline access. Clearing this will not delete files from the server.
                </p>
              </div>
            </div>
          )}

          {/* Danger Zone Tab */}
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