import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { User, Mail, Hash, Building2, GraduationCap, Edit2, Save, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

const UserProfile = () => {
  const { currentUser, userProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: userProfile?.name || '',
    department: userProfile?.department || '',
    year: userProfile?.year || '',
    collegeUSN: userProfile?.collegeUSN || '',
    collegeID: userProfile?.collegeID || '',
  });

  const departments = [
    'CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AI/ML', 'ISE', 'DS', 'RA'
  ];

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Auto-uppercase for USN
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
      // Validation
      if (userProfile.role === 'student') {
        // Validate USN starts with 3GN
        if (!formData.collegeUSN.startsWith('3GN')) {
          toast.error('Invalid USN! Student USN must start with "3GN"');
          setLoading(false);
          return;
        }

        if (formData.collegeUSN.length !== 10) {
          toast.error('Invalid USN format! USN should be 10 characters');
          setLoading(false);
          return;
        }

        if (!formData.year) {
          toast.error('Please select your year');
          setLoading(false);
          return;
        }
      }

      if (userProfile.role === 'professor') {
        if (!formData.collegeID || formData.collegeID.trim().length < 4) {
          toast.error('College ID must be at least 4 characters');
          setLoading(false);
          return;
        }
      }

      // Update Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      const updateData = {
        name: formData.name,
        department: formData.department,
      };

      // Add role-specific fields
      if (userProfile.role === 'student') {
        updateData.collegeUSN = formData.collegeUSN;
        updateData.year = formData.year;
      } else {
        updateData.collegeID = formData.collegeID;
      }

      await updateDoc(userRef, updateData);
      
      toast.success('Profile updated successfully!');
      setIsEditing(false);
      
      // Reload page to refresh userProfile from context
      setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
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

  const isStudent = userProfile?.role === 'student';
  const isProfessor = userProfile?.role === 'professor';

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl p-8 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-purple-600 text-3xl font-bold">
                {userProfile?.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="text-3xl font-bold">{userProfile?.name}</h1>
                <p className="text-purple-100 mt-1">
                  {isProfessor ? '👨‍🏫 Professor' : '🎓 Student'} • {userProfile?.department}
                </p>
              </div>
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-2 px-4 py-2 bg-white text-purple-600 rounded-lg hover:bg-purple-50 transition-colors font-semibold"
              >
                <Edit2 className="w-4 h-4" />
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Profile Details */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-6">Profile Information</h2>

          {!isEditing ? (
            // View Mode
            <div className="space-y-6">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <User className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="text-lg font-semibold text-gray-800">{userProfile?.name}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Mail className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-500">Email Address</p>
                  <p className="text-lg font-semibold text-gray-800">{currentUser?.email}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Hash className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-500">
                    {isStudent ? 'College USN' : 'College ID'}
                  </p>
                  <p className="text-lg font-semibold text-gray-800">
                    {isStudent ? userProfile?.collegeUSN : userProfile?.collegeID}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <Building2 className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="text-lg font-semibold text-gray-800">{userProfile?.department}</p>
                </div>
              </div>

              {isStudent && (
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <GraduationCap className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="text-sm text-gray-500">Year</p>
                    <p className="text-lg font-semibold text-gray-800">{userProfile?.year}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <User className="w-6 h-6 text-purple-600" />
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <p className="text-lg font-semibold text-gray-800">
                    {isProfessor ? 'Professor' : 'Student'}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Edit Mode
            <form onSubmit={handleSubmit} className="space-y-4">
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
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address (Cannot be changed)
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={currentUser?.email}
                    disabled
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-gray-100 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {isStudent ? 'College USN' : 'College ID'}
                </label>
                <div className="relative">
                  <Hash className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    name={isStudent ? 'collegeUSN' : 'collegeID'}
                    value={isStudent ? formData.collegeUSN : formData.collegeID}
                    onChange={handleChange}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent uppercase"
                    placeholder={isStudent ? '3GN21IS001' : 'PROF001'}
                    required
                  />
                </div>
                {isStudent && (
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

                {isStudent && (
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

              <div className="flex gap-3 mt-6">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg font-semibold disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Account Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-3xl font-bold text-purple-600">0</p>
            <p className="text-gray-600 mt-1">Uploads</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-3xl font-bold text-blue-600">0</p>
            <p className="text-gray-600 mt-1">Downloads</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <p className="text-3xl font-bold text-green-600">0</p>
            <p className="text-gray-600 mt-1">Bookmarks</p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default UserProfile;