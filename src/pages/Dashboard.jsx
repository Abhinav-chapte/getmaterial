import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { collection, query, orderBy, limit, getDocs, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { TrendingUp, Clock, Users, Download, FileText, ThumbsUp, Eye, Filter, X } from 'lucide-react';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];

const Dashboard = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalNotes: 0,
    activeUsers: 0,
    departments: 9,
    downloadsToday: 0,
  });
  const [recentNotes, setRecentNotes] = useState([]);
  const [filteredNotes, setFilteredNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(false);

  // Semester filter state — null means "All"
  const [selectedSemester, setSelectedSemester] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Re-filter whenever semester selection changes
  useEffect(() => {
    if (selectedSemester === null) {
      setFilteredNotes(recentNotes);
    } else {
      fetchNotesBySemester(selectedSemester);
    }
  }, [selectedSemester, recentNotes]);

  const fetchDashboardData = async () => {
    try {
      // Recent notes (default — no semester filter)
      const notesQuery = query(
        collection(db, 'notes'),
        orderBy('createdAt', 'desc'),
        limit(6)
      );
      const notesSnapshot = await getDocs(notesQuery);
      const notesData = notesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setRecentNotes(notesData);
      setFilteredNotes(notesData);

      // Total notes
      const allNotesSnapshot = await getDocs(collection(db, 'notes'));
      const totalNotesCount = allNotesSnapshot.size;

      // Active users
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const activeUsersCount = usersSnapshot.size;

      // Downloads today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const downloadsSnapshot = await getDocs(
        query(collection(db, 'downloads'), where('downloadedAt', '>=', today))
      );

      setStats({
        totalNotes: totalNotesCount,
        activeUsers: activeUsersCount,
        departments: 9,
        downloadsToday: downloadsSnapshot.size,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch notes filtered by semester — tries BOTH string "8" and number 8
  // because different uploads may have stored semester differently
  const fetchNotesBySemester = async (sem) => {
    setFilterLoading(true);
    try {
      // Query 1: semester stored as string e.g. "8"
      const snapStr = await getDocs(query(
        collection(db, 'notes'),
        where('semester', '==', String(sem)),
        orderBy('createdAt', 'desc')
      ));

      // Query 2: semester stored as number e.g. 8
      const snapNum = await getDocs(query(
        collection(db, 'notes'),
        where('semester', '==', sem),
        orderBy('createdAt', 'desc')
      ));

      // Merge both results, deduplicate by note id
      const seen = new Set();
      const merged = [];
      [...snapStr.docs, ...snapNum.docs].forEach(d => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          merged.push({ id: d.id, ...d.data() });
        }
      });

      // Sort by createdAt descending
      merged.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setFilteredNotes(merged);
    } catch (error) {
      console.error('Error fetching by semester:', error);
      // Last resort: client-side filter from all notes already in memory
      const allSnap = await getDocs(collection(db, 'notes'));
      const all = allSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = all.filter(n => String(n.semester) === String(sem));
      setFilteredNotes(filtered);
    } finally {
      setFilterLoading(false);
    }
  };

  const handleSemesterClick = (sem) => {
    setSelectedSemester(prev => (prev === sem ? null : sem));
  };

  const clearFilter = () => setSelectedSemester(null);

  // ── Sub-components ────────────────────────────────────────────

  const StatCard = ({ icon: Icon, label, value, color }) => (
    <div className="bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600 font-medium">{label}</p>
          <p className="text-3xl font-bold text-gray-800 mt-2">{value}</p>
        </div>
        <div className={`${color} bg-opacity-10 p-4 rounded-lg`}>
          <Icon className={`w-8 h-8 ${color.replace('bg-', 'text-')}`} />
        </div>
      </div>
    </div>
  );

  const NoteCard = ({ note }) => (
    <div
      onClick={() => navigate(`/notes/${note.id}`)}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all p-5 cursor-pointer group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg flex-shrink-0">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-gray-800 group-hover:text-purple-600 transition-colors truncate">
            {note.title || 'Untitled Note'}
          </h3>
          <p className="text-sm text-gray-600 truncate">{note.subject || 'General'}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          {note.department || 'N/A'}
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
          Sem {note.semester || 'N/A'}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-4 h-4" /> {note.upvotes || 0}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" /> {note.views || 0}
          </span>
        </div>
        <span className="text-xs">
          {note.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
        </span>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-teal-500 rounded-2xl shadow-xl p-8 mb-8 text-white">
          <h1 className="text-3xl font-bold mb-2">
            Welcome back, {userProfile?.name}! 👋
          </h1>
          <p className="text-purple-100 text-lg">
            {userProfile?.department} • {userProfile?.year} • {userProfile?.role}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatCard icon={FileText} label="Total Notes" value={stats.totalNotes} color="bg-blue-500" />
          <StatCard icon={Users} label="Active Users" value={stats.activeUsers} color="bg-green-500" />
          <StatCard icon={TrendingUp} label="Departments" value={stats.departments} color="bg-purple-500" />
          <StatCard icon={Download} label="Downloads Today" value={stats.downloadsToday} color="bg-orange-500" />
        </div>

        {/* ── SEMESTER FILTER ── */}
        <div className="bg-white rounded-2xl shadow-md p-5 mb-8">
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-purple-600" />
              <h3 className="font-bold text-gray-800">Filter by Semester</h3>
            </div>
            {selectedSemester && (
              <button
                onClick={clearFilter}
                className="flex items-center gap-1 px-3 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-sm font-medium hover:bg-red-100 transition-colors"
              >
                <X className="w-3 h-3" />
                Clear Filter
              </button>
            )}
          </div>

          {/* Semester Pills */}
          <div className="flex flex-wrap gap-2">
            {/* "All" pill */}
            <button
              onClick={clearFilter}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                selectedSemester === null
                  ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow-md scale-105'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              All
            </button>

            {SEMESTERS.map((sem) => (
              <button
                key={sem}
                onClick={() => handleSemesterClick(sem)}
                className={`px-4 py-2 rounded-full text-sm font-semibold transition-all ${
                  selectedSemester === sem
                    ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow-md scale-105'
                    : 'bg-gray-100 text-gray-600 hover:bg-purple-50 hover:text-purple-700'
                }`}
              >
                Sem {sem}
              </button>
            ))}
          </div>

          {/* Active filter info */}
          {selectedSemester && (
            <p className="text-sm text-purple-600 font-medium mt-3">
              📚 Showing notes for Semester {selectedSemester}
              {filterLoading ? ' — loading...' : ` — ${filteredNotes.length} note${filteredNotes.length !== 1 ? 's' : ''} found`}
            </p>
          )}
        </div>

        {/* ── FILTERED NOTES SECTION (shown when semester selected) ── */}
        {selectedSemester !== null && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              📖 Semester {selectedSemester} Notes
            </h2>

            {filterLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                <p className="text-gray-600 mt-4">Loading semester {selectedSemester} notes...</p>
              </div>
            ) : filteredNotes.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredNotes.map(note => (
                  <NoteCard key={note.id} note={note} />
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No notes for Semester {selectedSemester} yet
                </h3>
                <p className="text-gray-600 mb-4">Be the first to upload for this semester!</p>
                <button
                  onClick={() => navigate('/dashboard/upload')}
                  className="bg-gradient-to-r from-purple-600 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all"
                >
                  Upload Notes
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── TRENDING THIS WEEK (hidden when filter active) ── */}
        {selectedSemester === null && (
          <>
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  🔥 Trending This Week
                </h2>
                <button
                  onClick={() => navigate('/dashboard/upvoted')}
                  className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 transition-colors"
                >
                  View All →
                </button>
              </div>

              {loading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
                  <p className="text-gray-600 mt-4">Loading notes...</p>
                </div>
              ) : recentNotes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recentNotes.slice(0, 3).map(note => (
                    <NoteCard key={note.id} note={note} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md p-12 text-center">
                  <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-800 mb-2">No notes yet</h3>
                  <p className="text-gray-600 mb-4">Be the first to share study materials!</p>
                  <button
                    onClick={() => navigate('/dashboard/upload')}
                    className="bg-gradient-to-r from-purple-600 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
                  >
                    Upload First Note
                  </button>
                </div>
              )}
            </div>

            {/* Recently Uploaded */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Clock className="w-6 h-6" /> Recently Uploaded
                </h2>
                <button
                  onClick={() => navigate('/dashboard/recent')}
                  className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1 transition-colors"
                >
                  View All →
                </button>
              </div>

              {recentNotes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recentNotes.slice(0, 3).map(note => (
                    <NoteCard key={note.id} note={note} />
                  ))}
                </div>
              ) : (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                  <p className="text-gray-600">No recent uploads</p>
                </div>
              )}
            </div>
          </>
        )}

      </div>
    </Layout>
  );
};

export default Dashboard;