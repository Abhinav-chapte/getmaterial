import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { useNavigate } from 'react-router-dom';
import {
  Shield, Search, UserCheck, UserX, Crown, User,
  ArrowLeft, Loader, CheckCircle, AlertTriangle
} from 'lucide-react';
import {
  collection, query, where, getDocs, updateDoc, doc, addDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { toast } from 'react-toastify';

const ManageAdmins = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [searchEmail, setSearchEmail] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [searching, setSearching] = useState(false);
  const [currentAdmins, setCurrentAdmins] = useState([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Only super_admin can access this page
  const isSuperAdmin = userProfile?.role?.trim() === 'super_admin';

  useEffect(() => {
    if (!isSuperAdmin) {
      navigate('/dashboard/admin');
      return;
    }
    fetchCurrentAdmins();
  }, [isSuperAdmin]);

  const fetchCurrentAdmins = async () => {
    try {
      setLoadingAdmins(true);
      const adminsQuery = query(
        collection(db, 'users'),
        where('role', 'in', ['admin', 'super_admin'])
      );
      const snapshot = await getDocs(adminsQuery);
      const admins = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setCurrentAdmins(admins);
    } catch (error) {
      console.error('Error fetching admins:', error);
      toast.error('Failed to load admins');
    } finally {
      setLoadingAdmins(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSearching(true);
    setSearchResult(null);

    try {
      const usersQuery = query(
        collection(db, 'users'),
        where('email', '==', searchEmail.trim().toLowerCase())
      );
      const snapshot = await getDocs(usersQuery);

      if (snapshot.empty) {
        toast.error('No user found with that email');
        setSearchResult(null);
      } else {
        const user = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        setSearchResult(user);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setSearching(false);
    }
  };

  const logAdminAction = async (actionType, targetUser, newRole) => {
    try {
      await addDoc(collection(db, 'adminLogs'), {
        actionType,
        performedBy: currentUser.uid,
        performedByName: userProfile?.name || 'Super Admin',
        targetId: targetUser.id,
        targetName: targetUser.name || targetUser.email,
        targetEmail: targetUser.email,
        newRole,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn('Could not log action:', err);
    }
  };

  const promoteToAdmin = async (user) => {
    if (user.role?.trim() === 'super_admin') {
      toast.error('Cannot change Super Admin role');
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { role: 'admin' });
      await logAdminAction('promote_admin', user, 'admin');
      toast.success(`✅ ${user.name || user.email} is now an Admin!`);
      setSearchResult({ ...user, role: 'admin' });
      fetchCurrentAdmins();
    } catch (error) {
      console.error('Promote error:', error);
      toast.error('Failed to promote user');
    } finally {
      setActionLoading(false);
    }
  };

  const demoteToStudent = async (user) => {
    if (user.role?.trim() === 'super_admin') {
      toast.error('Cannot demote Super Admin');
      return;
    }
    if (user.id === currentUser.uid) {
      toast.error('You cannot demote yourself');
      return;
    }
    setActionLoading(true);
    try {
      await updateDoc(doc(db, 'users', user.id), { role: user.role?.includes('professor') ? 'professor' : 'student' });
      await logAdminAction('demote_admin', user, 'student');
      toast.success(`${user.name || user.email} has been demoted`);
      setSearchResult({ ...user, role: 'student' });
      fetchCurrentAdmins();
    } catch (error) {
      console.error('Demote error:', error);
      toast.error('Failed to demote user');
    } finally {
      setActionLoading(false);
    }
  };

  const getRoleBadge = (role) => {
    const r = role?.trim();
    if (r === 'super_admin') return { label: 'Super Admin', color: 'bg-yellow-100 text-yellow-800', icon: Crown };
    if (r === 'admin') return { label: 'Admin', color: 'bg-purple-100 text-purple-800', icon: Shield };
    if (r === 'professor') return { label: 'Professor', color: 'bg-blue-100 text-blue-800', icon: User };
    return { label: 'Student', color: 'bg-gray-100 text-gray-700', icon: User };
  };

  if (!isSuperAdmin) return null;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard/admin')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Crown className="w-7 h-7 text-yellow-500" />
              Manage Admins
            </h1>
            <p className="text-gray-500 text-sm">Search users by email and promote or demote their role</p>
          </div>
        </div>

        {/* Search Section */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Search User by Email</h2>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Enter user's email address..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors"
              />
            </div>
            <button
              type="submit"
              disabled={searching}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-teal-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-60 flex items-center gap-2"
            >
              {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {searching ? 'Searching...' : 'Search'}
            </button>
          </form>

          {/* Search Result */}
          {searchResult && (
            <div className="mt-5 p-4 border-2 border-purple-100 bg-purple-50 rounded-xl">
              <p className="text-xs text-purple-600 font-semibold uppercase tracking-wide mb-3">Search Result</p>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {searchResult.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-800">{searchResult.name || 'Unknown'}</p>
                    <p className="text-sm text-gray-500">{searchResult.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500">{searchResult.department}</span>
                      {searchResult.collegeUSN && (
                        <span className="text-xs text-gray-400">• {searchResult.collegeUSN}</span>
                      )}
                      {searchResult.collegeID && (
                        <span className="text-xs text-gray-400">• ID: {searchResult.collegeID}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Role Badge */}
                  {(() => {
                    const badge = getRoleBadge(searchResult.role);
                    const Icon = badge.icon;
                    return (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${badge.color}`}>
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>
                    );
                  })()}

                  {/* Action Buttons */}
                  {searchResult.role?.trim() !== 'super_admin' && searchResult.id !== currentUser.uid && (
                    <>
                      {searchResult.role?.trim() === 'admin' ? (
                        <button
                          onClick={() => demoteToStudent(searchResult)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 font-medium text-sm flex items-center gap-1 transition-colors disabled:opacity-60"
                        >
                          <UserX className="w-4 h-4" />
                          Demote
                        </button>
                      ) : (
                        <button
                          onClick={() => promoteToAdmin(searchResult)}
                          disabled={actionLoading}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-teal-500 text-white rounded-lg hover:shadow-md font-medium text-sm flex items-center gap-1 transition-all disabled:opacity-60"
                        >
                          <UserCheck className="w-4 h-4" />
                          Make Admin
                        </button>
                      )}
                    </>
                  )}

                  {searchResult.id === currentUser.uid && (
                    <span className="text-sm text-gray-500 italic">That's you!</span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Current Admins List */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Current Admins ({currentAdmins.length})
          </h2>

          {loadingAdmins ? (
            <div className="flex items-center justify-center py-8">
              <Loader className="w-6 h-6 animate-spin text-purple-600" />
            </div>
          ) : currentAdmins.length === 0 ? (
            <p className="text-gray-500 text-center py-6">No admins found</p>
          ) : (
            <div className="space-y-3">
              {currentAdmins.map((admin) => {
                const badge = getRoleBadge(admin.role);
                const Icon = badge.icon;
                return (
                  <div
                    key={admin.id}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                        {admin.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {admin.name}
                          {admin.id === currentUser.uid && (
                            <span className="ml-2 text-xs text-purple-600 font-semibold">(You)</span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">{admin.email}</p>
                        <p className="text-xs text-gray-400">{admin.department}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-1 ${badge.color}`}>
                        <Icon className="w-3 h-3" />
                        {badge.label}
                      </span>

                      {admin.role?.trim() !== 'super_admin' && admin.id !== currentUser.uid && (
                        <button
                          onClick={() => demoteToStudent(admin)}
                          disabled={actionLoading}
                          className="px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium flex items-center gap-1 transition-colors disabled:opacity-60"
                        >
                          <UserX className="w-3 h-3" />
                          Demote
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Info Box */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              Admins can delete any file and review reports. Only Super Admins can manage admin roles.
              Be careful when promoting users — they will have moderation powers over all content.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ManageAdmins;