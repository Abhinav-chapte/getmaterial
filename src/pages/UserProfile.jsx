import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { User, Edit2, Save, X, Upload as UploadIcon, Download, ThumbsUp } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

const UserProfile = () => {
  const { currentUser, userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: userProfile?.name || '',
    department: userProfile?.department || '',
    year: userProfile?.year || ''
  });

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        name: editForm.name,
        department: editForm.department,
        year: editForm.year
      });
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      window.location.reload(); // Refresh to show updated data
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    }
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Profile Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl shadow-xl p-8 mb-8 text-white">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-4xl font-bold backdrop-blur-sm">
              {userProfile?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1">
              {isEditing ? (
                <div className="space-y-3">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full px-4 py-2 bg-white bg-opacity-20 rounded-lg text-white placeholder-white placeholder-opacity-70 border border-white border-opacity-30 focus:outline-none focus:border-opacity-100"
                    placeholder="Name"
                  />
                </div>
              ) : (
                <div>
                  <h1 className="text-3xl font-bold mb-2">{userProfile?.name}</h1>
                  <p className="text-purple-100">{userProfile?.department} • {userProfile?.year}</p>
                  <p className="text-purple-100 text-sm mt-1">{currentUser?.email}</p>
                </div>
              )}
            </div>
            <button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              className="bg-white bg-opacity-20 hover:bg-opacity-30 px-6 py-3 rounded-lg font-semibold backdrop-blur-sm transition-all flex items-center gap-2"
            >
              {isEditing ? (
                <>
                  <Save className="w-4 h-4" />
                  Save
                </>
              ) : (
                <>
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </>
              )}
            </button>
            {isEditing && (
              <button
                onClick={() => setIsEditing(false)}
                className="bg-white bg-opacity-20 hover:bg-opacity-30 p-3 rounded-lg backdrop-blur-sm transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Dropdowns - FIXED VERSION */}
          {isEditing && (
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-white text-sm font-medium mb-2">Department</label>
                <select
                  value={editForm.department}
                  onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                  className="w-full px-4 py-2 bg-white text-gray-800 rounded-lg border-2 border-white border-opacity-30 focus:outline-none focus:border-purple-300 font-medium"
                >
                  <option value="CSE">CSE - Computer Science</option>
                  <option value="ECE">ECE - Electronics</option>
                  <option value="MECH">MECH - Mechanical</option>
                  <option value="CIVIL">CIVIL - Civil Engineering</option>
                  <option value="EEE">EEE - Electrical</option>
                  <option value="AI/ML">AI/ML - AI & Machine Learning</option>
                  <option value="ISE">ISE - Information Science</option>
                  <option value="DS">DS - Data Science</option>
                  <option value="RA">RA - Robotics & Automation</option>
                </select>
              </div>
              <div>
                <label className="block text-white text-sm font-medium mb-2">Year</label>
                <select
                  value={editForm.year}
                  onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                  className="w-full px-4 py-2 bg-white text-gray-800 rounded-lg border-2 border-white border-opacity-30 focus:outline-none focus:border-purple-300 font-medium"
                >
                  <option value="1st Year">1st Year</option>
                  <option value="2nd Year">2nd Year</option>
                  <option value="3rd Year">3rd Year</option>
                  <option value="4th Year">4th Year</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-blue-100 p-3 rounded-lg">
                <UploadIcon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Notes Uploaded</p>
                <p className="text-2xl font-bold text-gray-800">{userProfile?.uploadCount || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-green-100 p-3 rounded-lg">
                <ThumbsUp className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Upvotes Received</p>
                <p className="text-2xl font-bold text-gray-800">{userProfile?.upvotesReceived || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-4">
              <div className="bg-purple-100 p-3 rounded-lg">
                <Download className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Downloads</p>
                <p className="text-2xl font-bold text-gray-800">{userProfile?.downloadCount || 0}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Account Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Email:</span>
              <span className="font-semibold text-gray-800">{currentUser?.email}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">College USN:</span>
              <span className="font-semibold text-gray-800">{userProfile?.collegeUSN}</span>
            </div>
            <div className="flex justify-between py-3 border-b border-gray-200">
              <span className="text-gray-600 font-medium">Role:</span>
              <span className="font-semibold text-gray-800 capitalize">{userProfile?.role}</span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-gray-600 font-medium">Member Since:</span>
              <span className="font-semibold text-gray-800">
                {userProfile?.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
              </span>
            </div>
          </div>
        </div>

        {/* College Info Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-500 text-sm">
            Guru Nanak Dev Engineering College Bidar
          </p>
          <p className="text-gray-400 text-xs mt-1">
            Created by Abhinav Chapte • {userProfile?.department} • {userProfile?.year}
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;