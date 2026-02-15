import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { 
  Settings as SettingsIcon, User, Bell, Shield, Trash2, 
  HardDrive, Download, Eye, EyeOff, Lock, Moon, Sun, Save
} from 'lucide-react';
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { updatePassword, deleteUser } from 'firebase/auth';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import { getAllOfflineFiles, deleteOfflineFile } from '../utils/offlineStorage';

const Settings = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('account');
  const [offlineFiles, setOfflineFiles] = useState([]);
  const [storageSize, setStorageSize] = useState(0);
  const [settings, setSettings] = useState({
    emailNotifications: true,
    profileVisibility: 'public',
    autoDownloadOffline: false,
    darkMode: false,
  });
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: '',
  });
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    checkOfflineStorage();
  }, []);

  const checkOfflineStorage = async () => {
    try {
      const files = await getAllOfflineFiles();
      setOfflineFiles(files);
      
      // Calculate total storage size
      const totalSize = files.reduce((sum, file) => {
        return sum + (file.fileBlob?.size || 0);
      }, 0);
      setStorageSize(totalSize);
    } catch (error) {
      console.error('Error checking offline storage:', error);
    }
  };

  const handleClearOfflineStorage = async () => {
    if (!window.confirm(`Delete all ${offlineFiles.length} offline files? You can re-download them later.`)) {
      return;
    }

    try {
      for (const file of offlineFiles) {
        await deleteOfflineFile(file.noteId);
      }
      toast.success('Offline storage cleared!');
      checkOfflineStorage();
    } catch (error) {
      console.error('Error clearing storage:', error);
      toast.error('Failed to clear storage');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await updatePassword(currentUser, passwordForm.newPassword);
      toast.success('Password updated successfully!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please log out and log back in, then try again');
      } else {
        toast.error('Failed to update password');
      }
    }
  };

  const handleDeleteAccount = async () => {
    const confirmation = window.prompt(
      'Are you sure you want to delete your account? This action cannot be undone.\n\nType "DELETE" to confirm:'
    );

    if (confirmation !== 'DELETE') {
      toast.info('Account deletion cancelled');
      return;
    }

    try {
      // Delete user data from Firestore
      await deleteDoc(doc(db, 'users', currentUser.uid));

      // Delete user's notes
      const notesQuery = query(
        collection(db, 'notes'),
        where('uploadedBy', '==', currentUser.uid)
      );
      const notesSnapshot = await getDocs(notesQuery);
      for (const noteDoc of notesSnapshot.docs) {
        await deleteDoc(noteDoc.ref);
      }

      // Delete user's votes
      const votesQuery = query(
        collection(db, 'votes'),
        where('userId', '==', currentUser.uid)
      );
      const votesSnapshot = await getDocs(votesQuery);
      for (const voteDoc of votesSnapshot.docs) {
        await deleteDoc(voteDoc.ref);
      }

      // Delete user's bookmarks
      const bookmarksQuery = query(
        collection(db, 'bookmarks'),
        where('userId', '==', currentUser.uid)
      );
      const bookmarksSnapshot = await getDocs(bookmarksQuery);
      for (const bookmarkDoc of bookmarksSnapshot.docs) {
        await deleteDoc(bookmarkDoc.ref);
      }

      // Delete Firebase Auth user
      await deleteUser(currentUser);

      toast.success('Account deleted successfully');
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      if (error.code === 'auth/requires-recent-login') {
        toast.error('Please log out and log back in, then try deleting your account');
      } else {
        toast.error('Failed to delete account');
      }
    }
  };

  const handleToggleSetting = (key) => {
    setSettings(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
    toast.success('Setting updated');
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const tabs = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'privacy', name: 'Privacy', icon: Shield },
    { id: 'storage', name: 'Storage', icon: HardDrive },
    { id: 'danger', name: 'Danger Zone', icon: Trash2 },
  ];

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <SettingsIcon className="w-8 h-8 text-gray-700" />
            <h1 className="text-3xl font-bold text-gray-800">Settings</h1>
          </div>
          <p className="text-gray-600">
            Manage your account preferences and settings
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-md overflow-hidden">
          <div className="border-b border-gray-200">
            <div className="flex overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'text-purple-600 border-b-2 border-purple-600 bg-purple-50'
                        : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-6">
            {/* Account Tab */}
            {activeTab === 'account' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Account Information</h3>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="text-sm text-gray-600">Name</p>
                        <p className="font-medium text-gray-800">{userProfile?.name}</p>
                      </div>
                      <button
                        onClick={() => navigate('/dashboard/profile')}
                        className="text-purple-600 hover:text-purple-700 font-medium"
                      >
                        Edit
                      </button>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Email</p>
                      <p className="font-medium text-gray-800">{currentUser?.email}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Department</p>
                      <p className="font-medium text-gray-800">{userProfile?.department}</p>
                    </div>

                    <div className="p-4 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-600">Year</p>
                      <p className="font-medium text-gray-800">{userProfile?.year}</p>
                    </div>
                  </div>
                </div>

                {/* Change Password */}
                <div className="border-t pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Change Password</h3>
                  <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                    <div className="relative">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        New Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                          placeholder="Enter new password"
                          minLength={6}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500"
                        >
                          {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
                        placeholder="Confirm new password"
                        minLength={6}
                      />
                    </div>

                    <button
                      type="submit"
                      className="bg-purple-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-purple-700 transition-colors flex items-center gap-2"
                    >
                      <Lock className="w-4 h-4" />
                      Update Password
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* Privacy Tab */}
            {activeTab === 'privacy' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Privacy Settings</h3>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">Email Notifications</p>
                        <p className="text-sm text-gray-600">Receive email updates about your notes</p>
                      </div>
                      <button
                        onClick={() => handleToggleSetting('emailNotifications')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.emailNotifications ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.emailNotifications ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-800">Auto-Download for Offline</p>
                        <p className="text-sm text-gray-600">Automatically save downloads for offline access</p>
                      </div>
                      <button
                        onClick={() => handleToggleSetting('autoDownloadOffline')}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          settings.autoDownloadOffline ? 'bg-purple-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            settings.autoDownloadOffline ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div>
                          <p className="font-medium text-blue-900">Your Privacy Matters</p>
                          <p className="text-sm text-blue-700 mt-1">
                            Your personal information is never shared with third parties. All uploads are visible to students at GNDEC Bidar only.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Storage Tab */}
            {activeTab === 'storage' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Offline Storage</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Storage Used</p>
                        <p className="text-3xl font-bold text-gray-800">{formatBytes(storageSize)}</p>
                      </div>
                      <HardDrive className="w-12 h-12 text-gray-400" />
                    </div>
                    <div className="text-sm text-gray-600">
                      {offlineFiles.length} file{offlineFiles.length !== 1 ? 's' : ''} stored offline
                    </div>
                  </div>

                  {offlineFiles.length > 0 && (
                    <button
                      onClick={handleClearOfflineStorage}
                      className="bg-red-50 text-red-700 px-6 py-3 rounded-lg font-semibold hover:bg-red-100 transition-colors flex items-center gap-2"
                    >
                      <Trash2 className="w-5 h-5" />
                      Clear All Offline Files
                    </button>
                  )}

                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-start gap-3">
                      <Download className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-blue-900">About Offline Storage</p>
                        <p className="text-sm text-blue-700 mt-1">
                          Files are stored in your browser's local storage. You can access them even without an internet connection. Clearing storage will not delete files from the server.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Danger Zone Tab */}
            {activeTab === 'danger' && (
              <div className="space-y-6">
                <div className="border-2 border-red-200 rounded-lg p-6 bg-red-50">
                  <h3 className="text-lg font-semibold text-red-800 mb-2 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    Danger Zone
                  </h3>
                  <p className="text-sm text-red-600 mb-6">
                    These actions are permanent and cannot be undone. Please proceed with caution.
                  </p>

                  <div className="space-y-4">
                    <div className="bg-white rounded-lg p-4 border border-red-200">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="font-semibold text-gray-800">Delete Account</p>
                          <p className="text-sm text-gray-600">Permanently delete your account and all data</p>
                        </div>
                      </div>
                      <button
                        onClick={handleDeleteAccount}
                        className="mt-4 bg-red-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-red-700 transition-colors"
                      >
                        Delete My Account
                      </button>
                    </div>

                    <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
                      <p className="text-sm text-yellow-800">
                        <strong>Note:</strong> Deleting your account will remove all your uploaded notes, bookmarks, votes, and download history. This action cannot be reversed.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;