import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Link } from 'react-router-dom';
import {
  Shield, Flag, Users, FileText,
  AlertTriangle, CheckCircle, Crown, ArrowRight, Loader,
  EyeOff, Star, Search, X, Pin, PinOff
} from 'lucide-react';
import {
  collection, query, where, getDocs,
  doc, getDoc, setDoc, updateDoc
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { toast } from 'react-toastify';

const MAX_FEATURED = 2;

const AdminPanel = () => {
  const { currentUser, userProfile } = useAuth();
  const [stats, setStats] = useState({
    totalFiles: 0,
    pendingReports: 0,
    hiddenFiles: 0,
    totalAdmins: 0,
  });
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);

  // Featured Notes state
  const [featuredNotes, setFeaturedNotes] = useState([]); // currently pinned
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [pinning, setPinning] = useState(false);

  const isAdmin = ['admin', 'super_admin'].includes(userProfile?.role?.trim());
  const isSuperAdmin = userProfile?.role?.trim() === 'super_admin';

  useEffect(() => {
    fetchAdminData();
    fetchFeaturedNotes();
  }, []);

  const fetchAdminData = async () => {
    try {
      const filesSnap = await getDocs(collection(db, 'notes'));
      const hiddenSnap = await getDocs(
        query(collection(db, 'notes'), where('status', '==', 'hidden'))
      );
      const reportsSnap = await getDocs(
        query(collection(db, 'reports'), where('status', '==', 'pending'))
      );
      const adminsSnap = await getDocs(
        query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']))
      );

      setStats({
        totalFiles: filesSnap.size,
        pendingReports: reportsSnap.size,
        hiddenFiles: hiddenSnap.size,
        totalAdmins: adminsSnap.size,
      });

      const recent = reportsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 5);
      setRecentReports(recent);
    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load currently pinned featured notes from Firestore
  const fetchFeaturedNotes = async () => {
    try {
      const snap = await getDoc(doc(db, 'featured', 'notes'));
      if (snap.exists()) {
        setFeaturedNotes(snap.data().notes || []);
      }
    } catch (err) {
      console.error('Error loading featured notes:', err);
    }
  };

  // Search notes by title
  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchResults([]);
    try {
      const snap = await getDocs(collection(db, 'notes'));
      const q = searchQuery.toLowerCase();
      const results = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(n =>
          (n.title || '').toLowerCase().includes(q) ||
          (n.subject || '').toLowerCase().includes(q)
        )
        .slice(0, 8);
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Pin a note as featured
  const handlePin = async (note) => {
    if (featuredNotes.length >= MAX_FEATURED) {
      toast.error(`Maximum ${MAX_FEATURED} featured notes allowed. Unpin one first.`);
      return;
    }
    if (featuredNotes.find(n => n.id === note.id)) {
      toast.info('This note is already featured!');
      return;
    }
    setPinning(true);
    try {
      const updated = [...featuredNotes, {
        id: note.id,
        title: note.title,
        subject: note.subject,
        department: note.department,
        semester: note.semester,
        upvotes: note.upvotes || 0,
        views: note.views || 0,
        pinnedAt: new Date().toISOString(),
        pinnedBy: userProfile?.name || 'Admin',
      }];
      await setDoc(doc(db, 'featured', 'notes'), { notes: updated });
      setFeaturedNotes(updated);
      setSearchResults([]);
      setSearchQuery('');
      toast.success(`✅ "${note.title}" pinned as Note of the Week!`);
    } catch (err) {
      toast.error('Failed to pin note');
    } finally {
      setPinning(false);
    }
  };

  // Unpin a featured note
  const handleUnpin = async (noteId) => {
    setPinning(true);
    try {
      const updated = featuredNotes.filter(n => n.id !== noteId);
      await setDoc(doc(db, 'featured', 'notes'), { notes: updated });
      setFeaturedNotes(updated);
      toast.success('Note unpinned successfully');
    } catch (err) {
      toast.error('Failed to unpin note');
    } finally {
      setPinning(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader className="animate-spin rounded-full h-12 w-12 text-purple-600 mx-auto" />
            <p className="text-gray-600 mt-4">Loading admin panel...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    { icon: FileText, label: 'Total Files', value: stats.totalFiles, iconColor: 'text-purple-600', bg: 'bg-purple-50', link: '/dashboard' },
    { icon: Flag, label: 'Pending Reports', value: stats.pendingReports, iconColor: 'text-red-600', bg: 'bg-red-50', link: '/dashboard/admin/reports', urgent: stats.pendingReports > 0 },
    { icon: EyeOff, label: 'Hidden Files', value: stats.hiddenFiles, iconColor: 'text-orange-600', bg: 'bg-orange-50', link: '/dashboard/admin/reports' },
    { icon: Users, label: 'Total Admins', value: stats.totalAdmins, iconColor: 'text-teal-600', bg: 'bg-teal-50', link: isSuperAdmin ? '/dashboard/admin/manage-admins' : '#' },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-teal-500 rounded-xl p-8 mb-8 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-10 h-10" />
            <h1 className="text-3xl font-bold">Admin Panel</h1>
          </div>
          <p className="text-purple-100 mt-1">
            Welcome, {userProfile?.name} •{' '}
            <span className="font-semibold">
              {isSuperAdmin ? '👑 Super Admin' : '🛡️ Admin'}
            </span>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.label} to={card.link}
                className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all ${card.urgent ? 'ring-2 ring-red-300' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{card.label}</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{card.value}</p>
                    {card.urgent && (
                      <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Needs attention
                      </p>
                    )}
                  </div>
                  <div className={`${card.bg} p-4 rounded-lg`}>
                    <Icon className={`w-8 h-8 ${card.iconColor}`} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* ── FEATURED NOTES OF THE WEEK ── */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-400" />
            <h2 className="text-xl font-bold text-gray-800">Note of the Week</h2>
            <span className="ml-auto text-sm text-gray-500">
              {featuredNotes.length}/{MAX_FEATURED} pinned
            </span>
          </div>
          <p className="text-sm text-gray-500 mb-5">
            Pin up to {MAX_FEATURED} notes — they appear as a featured banner on the dashboard for all students.
          </p>

          {/* Currently pinned */}
          {featuredNotes.length > 0 ? (
            <div className="space-y-3 mb-5">
              {featuredNotes.map(note => (
                <div key={note.id}
                  className="flex items-center gap-3 p-4 bg-yellow-50 border-2 border-yellow-200 rounded-xl"
                >
                  <Star className="w-5 h-5 text-yellow-500 fill-yellow-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{note.title}</p>
                    <p className="text-sm text-gray-500">
                      {note.subject} • {note.department} • Sem {note.semester}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Pinned by {note.pinnedBy} on {new Date(note.pinnedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={() => handleUnpin(note.id)}
                    disabled={pinning}
                    className="flex items-center gap-1.5 px-3 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 font-medium text-sm transition-colors flex-shrink-0"
                  >
                    <PinOff className="w-4 h-4" /> Unpin
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 bg-gray-50 rounded-xl mb-5 border-2 border-dashed border-gray-200">
              <Star className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 font-medium">No featured notes yet</p>
              <p className="text-sm text-gray-400">Search and pin a note below</p>
            </div>
          )}

          {/* Search to pin */}
          {featuredNotes.length < MAX_FEATURED && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Search a note to pin:</p>
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="Search by title or subject..."
                    className="w-full pl-9 pr-4 py-2 border-2 border-gray-200 rounded-lg focus:border-purple-400 focus:outline-none text-sm"
                  />
                </div>
                <button
                  onClick={handleSearch}
                  disabled={searching}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium text-sm transition-colors flex items-center gap-1"
                >
                  {searching ? <Loader className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  Search
                </button>
              </div>

              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="border-2 border-gray-100 rounded-xl overflow-hidden">
                  {searchResults.map((note, i) => (
                    <div key={note.id}
                      className={`flex items-center gap-3 p-3 hover:bg-purple-50 transition-colors ${i !== 0 ? 'border-t border-gray-100' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate text-sm">{note.title}</p>
                        <p className="text-xs text-gray-500">{note.subject} • {note.department} • Sem {note.semester}</p>
                      </div>
                      <button
                        onClick={() => handlePin(note)}
                        disabled={pinning || !!featuredNotes.find(n => n.id === note.id)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200 font-semibold text-xs transition-colors flex-shrink-0 disabled:opacity-50"
                      >
                        <Pin className="w-3 h-3" />
                        {featuredNotes.find(n => n.id === note.id) ? 'Pinned' : 'Pin'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link to="/dashboard/admin/reports"
              className="flex items-center gap-3 p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors group"
            >
              <div className="bg-purple-100 p-2 rounded-lg">
                <Flag className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">View Reports</p>
                <p className="text-sm text-gray-500">Review reported files</p>
              </div>
              {stats.pendingReports > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {stats.pendingReports}
                </span>
              )}
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </Link>

            {isSuperAdmin && (
              <Link to="/dashboard/admin/manage-admins"
                className="flex items-center gap-3 p-4 border-2 border-teal-200 rounded-lg hover:bg-teal-50 transition-colors group"
              >
                <div className="bg-teal-100 p-2 rounded-lg">
                  <Crown className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Manage Admins</p>
                  <p className="text-sm text-gray-500">Promote or demote users</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
              </Link>
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              Recent Pending Reports
            </h2>
            <Link to="/dashboard/admin/reports"
              className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentReports.length > 0 ? (
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div key={report.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{report.noteTitle}</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      By: {report.reportedByName}{' '}
                      {report.reportedByUSN !== 'N/A' && (
                        <span className="text-gray-400">({report.reportedByUSN})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Reason: <span className="font-medium">{report.reason}</span>
                    </p>
                  </div>
                  <Link to="/dashboard/admin/reports"
                    className="ml-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium text-sm whitespace-nowrap"
                  >
                    Review →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No pending reports!</p>
              <p className="text-sm text-gray-500">All files are in good standing.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminPanel;