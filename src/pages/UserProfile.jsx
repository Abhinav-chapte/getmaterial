import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { User, Mail, Hash, Building2, GraduationCap, Edit2, Save, X, Shield, Camera, Loader } from 'lucide-react';
import { doc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

const CLOUD_NAME = 'dh0ssuhe3';
const UPLOAD_PRESET = 'getmaterial_notes';

const UserProfile = () => {
  const { currentUser, userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profilePicture, setProfilePicture] = useState(userProfile?.profilePicture || '');
  const [stats, setStats] = useState({ uploads: 0, downloads: 0, bookmarks: 0 });
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    department: userProfile?.department || '',
    year: userProfile?.year || '',
    collegeUSN: userProfile?.collegeUSN || '',
    collegeID: userProfile?.collegeID || '',
  });

  const departments = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AI/ML', 'ISE', 'DS', 'RA'];
  const isStudent = !!(userProfile?.collegeUSN);
  const isProfessor = !!(userProfile?.collegeID) && !userProfile?.collegeUSN;

  const getRoleLabel = () => {
    const role = userProfile?.role?.trim();
    if (role === 'super_admin') return '👑 Super Admin';
    if (role === 'admin') return '🛡️ Admin';
    if (role === 'professor') return '👨‍🏫 Professor';
    return '🎓 Student';
  };

  useEffect(() => {
    setProfilePicture(userProfile?.profilePicture || '');
  }, [userProfile]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!currentUser) return;
      try {
        const uploadsSnap = await getDocs(query(collection(db, 'notes'), where('uploadedBy', '==', currentUser.uid)));
        const downloadsSnap = await getDocs(query(collection(db, 'downloads'), where('userId', '==', currentUser.uid)));
        const bookmarksSnap = await getDocs(query(collection(db, 'bookmarks'), where('userId', '==', currentUser.uid)));
        setStats({ uploads: uploadsSnap.size, downloads: downloadsSnap.size, bookmarks: bookmarksSnap.size });
      } catch (error) { console.error('Error fetching stats:', error); }
    };
    fetchStats();
  }, [currentUser]);

  // ── Profile Picture Upload ────────────────────────────────────
  const handlePhotoClick = () => {
    if (!uploadingPhoto) fileInputRef.current?.click();
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate: images only, max 5MB
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image too large. Max size is 5MB.');
      return;
    }

    setUploadingPhoto(true);
    toast.info('⏳ Uploading profile picture...');

    try {
      // Upload to Cloudinary as image type
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', UPLOAD_PRESET);
      formData.append('folder', 'profile_pictures');
      // Note: transformation not allowed with unsigned upload
      // Use Cloudinary URL transformation on delivery instead

      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
        { method: 'POST', body: formData }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || 'Upload failed');
      }

      const data = await response.json();
      // Apply face-crop transformation on the delivery URL
      const photoURL = data.secure_url.replace('/upload/', '/upload/w_400,h_400,c_fill,g_face/');

      // Save URL to Firestore
      await updateDoc(doc(db, 'users', currentUser.uid), { profilePicture: photoURL });
      setProfilePicture(photoURL);
      toast.success('✅ Profile picture updated!');

      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (error) {
      console.error('Photo upload error:', error);
      toast.error('Failed to upload photo. Please try again.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'collegeUSN' ? value.toUpperCase() : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isStudent) {
        if (!formData.collegeUSN.startsWith('3GN')) { toast.error('Invalid USN! Must start with "3GN"'); setLoading(false); return; }
        if (formData.collegeUSN.length !== 10) { toast.error('USN must be 10 characters (e.g., 3GN21IS001)'); setLoading(false); return; }
        if (!formData.year) { toast.error('Please select your year'); setLoading(false); return; }
      }
      if (isProfessor && (!formData.collegeID || formData.collegeID.trim().length < 4)) {
        toast.error('College ID must be at least 4 characters'); setLoading(false); return;
      }
      const updateData = { name: formData.name, department: formData.department };
      if (isStudent) { updateData.collegeUSN = formData.collegeUSN; updateData.year = formData.year; }
      else { updateData.collegeID = formData.collegeID; }
      await updateDoc(doc(db, 'users', currentUser.uid), updateData);
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally { setLoading(false); }
  };

  const handleCancel = () => {
    setFormData({
      name: userProfile?.name || '',
      department: userProfile?.department || '',
      year: userProfile?.year || '',
      collegeUSN: userProfile?.collegeUSN || '',
      collegeID: userProfile?.collegeID || '',
    });
    setIsEditing(false);
  };

  // ── Avatar component (reused in header + sidebar initial) ──
  const Avatar = ({ size = 'lg' }) => {
    const sizeClass = size === 'lg' ? 'w-24 h-24 text-3xl' : 'w-16 h-16 text-xl';
    return (
      <div
        className={`relative ${sizeClass} rounded-full cursor-pointer group flex-shrink-0`}
        onClick={handlePhotoClick}
        title="Click to change profile picture"
      >
        {profilePicture ? (
          <img
            src={profilePicture}
            alt={userProfile?.name}
            className={`${sizeClass} rounded-full object-cover shadow-lg border-4 border-white`}
          />
        ) : (
          <div className={`${sizeClass} bg-white rounded-full flex items-center justify-center text-purple-600 font-bold shadow-lg border-4 border-white border-opacity-50`}>
            {userProfile?.name?.charAt(0) || 'U'}
          </div>
        )}

        {/* Camera overlay on hover */}
        <div className={`absolute inset-0 rounded-full flex items-center justify-center bg-black transition-opacity duration-200 ${
          uploadingPhoto ? 'bg-opacity-60' : 'bg-opacity-0 group-hover:bg-opacity-50'
        }`}>
          {uploadingPhoto
            ? <Loader className="w-6 h-6 text-white animate-spin" />
            : <Camera className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
          }
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handlePhotoChange}
        />
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-teal-500 rounded-xl p-8 mb-6 text-white">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-5">
              <Avatar size="lg" />
              <div>
                <h1 className="text-3xl font-bold">{userProfile?.name}</h1>
                <p className="text-purple-100 mt-1">{getRoleLabel()} • {userProfile?.department}</p>
                <p className="text-purple-200 text-sm mt-1 flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5" />
                  Click photo to change
                </p>
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
              >
                <Edit2 className="w-4 h-4" /> Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Profile Details */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile Information</h2>

          {!isEditing ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <User className="w-6 h-6 text-purple-600 flex-shrink-0" />
                <div><p className="text-sm text-gray-500">Full Name</p><p className="text-lg font-semibold text-gray-800">{userProfile?.name}</p></div>
              </div>
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Mail className="w-6 h-6 text-purple-600 flex-shrink-0" />
                <div><p className="text-sm text-gray-500">Email Address</p><p className="text-lg font-semibold text-gray-800">{currentUser?.email}</p></div>
              </div>
              {isStudent && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Hash className="w-6 h-6 text-purple-600 flex-shrink-0" />
                  <div><p className="text-sm text-gray-500">College USN</p><p className="text-lg font-semibold text-gray-800">{userProfile?.collegeUSN}</p></div>
                </div>
              )}
              {isProfessor && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Hash className="w-6 h-6 text-purple-600 flex-shrink-0" />
                  <div><p className="text-sm text-gray-500">College ID</p><p className="text-lg font-semibold text-gray-800">{userProfile?.collegeID}</p></div>
                </div>
              )}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Building2 className="w-6 h-6 text-purple-600 flex-shrink-0" />
                <div><p className="text-sm text-gray-500">Department</p><p className="text-lg font-semibold text-gray-800">{userProfile?.department}</p></div>
              </div>
              {isStudent && userProfile?.year && userProfile.year !== 'N/A' && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <GraduationCap className="w-6 h-6 text-purple-600 flex-shrink-0" />
                  <div><p className="text-sm text-gray-500">Year</p><p className="text-lg font-semibold text-gray-800">{userProfile?.year}</p></div>
                </div>
              )}
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Shield className="w-6 h-6 text-purple-600 flex-shrink-0" />
                <div><p className="text-sm text-gray-500">Role</p><p className="text-lg font-semibold text-gray-800">{getRoleLabel()}</p></div>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input type="text" name="name" value={formData.name} onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address (Cannot be changed)</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input type="email" value={currentUser?.email} disabled
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed" />
                </div>
              </div>
              {isStudent && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">College USN</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input type="text" name="collegeUSN" value={formData.collegeUSN} onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                      placeholder="3GN21IS001" required />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">ⓘ USN must start with "3GN" (GNDEC Bidar code)</p>
                </div>
              )}
              {isProfessor && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">College ID</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input type="text" name="collegeID" value={formData.collegeID} onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                      placeholder="PROF001" required />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
                  <select name="department" value={formData.department} onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                    <option value="">Select</option>
                    {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                  </select>
                </div>
                {isStudent && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                    <select name="year" value={formData.year} onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent" required>
                      <option value="">Select</option>
                      <option value="1st Year">1st Year</option>
                      <option value="2nd Year">2nd Year</option>
                      <option value="3rd Year">3rd Year</option>
                      <option value="4th Year">4th Year</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-6">
                <button type="submit" disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 transform hover:scale-105 transition-all"
                ><Save className="w-5 h-5" />{loading ? 'Saving...' : 'Save Changes'}</button>
                <button type="button" onClick={handleCancel}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                ><X className="w-5 h-5" />Cancel</button>
              </div>
            </form>
          )}
        </div>

        {/* Account Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
            <p className="text-3xl font-bold text-purple-600">{stats.uploads}</p>
            <p className="text-gray-600 mt-1">Uploads</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
            <p className="text-3xl font-bold text-teal-600">{stats.downloads}</p>
            <p className="text-gray-600 mt-1">Downloads</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center hover:shadow-lg transition-shadow">
            <p className="text-3xl font-bold text-green-600">{stats.bookmarks}</p>
            <p className="text-gray-600 mt-1">Bookmarks</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;