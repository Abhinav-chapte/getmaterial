import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Download, FileText, ThumbsUp, Eye, Calendar, Wifi, WifiOff, X, Search, Filter, SlidersHorizontal } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import { getOfflineFile, getAllOfflineFiles, deleteOfflineFile } from '../utils/offlineStorage';

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const DEPARTMENTS = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AI/ML', 'ISE', 'DS', 'RA'];

const MyDownloads = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineStatus, setOfflineStatus] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [previewFile, setPreviewFile] = useState(null);

  // ── Filter state ──
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDept, setSelectedDept] = useState(null);
  const [selectedSem, setSelectedSem] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (currentUser) fetchMyDownloads();
  }, [currentUser, isOnline]);

  const fetchMyDownloads = async () => {
    setLoading(true);
    try {
      if (!isOnline) {
        await loadFromIndexedDB();
        return;
      }
      const downloadsQuery = query(
        collection(db, 'downloads'),
        where('userId', '==', currentUser.uid)
      );
      const downloadsSnapshot = await getDocs(downloadsQuery);
      if (downloadsSnapshot.empty) {
        await loadFromIndexedDB();
        return;
      }
      const downloadsByNote = {};
      downloadsSnapshot.docs.forEach(d => {
        const data = d.data();
        if (!downloadsByNote[data.noteId]) downloadsByNote[data.noteId] = [];
        downloadsByNote[data.noteId].push({ id: d.id, ...data });
      });
      const notesPromises = Object.keys(downloadsByNote).map(async (noteId) => {
        try {
          const noteDoc = await getDoc(doc(db, 'notes', noteId));
          if (!noteDoc.exists()) return null;
          const noteDownloads = downloadsByNote[noteId];
          const latest = noteDownloads.reduce((a, b) =>
            (a.downloadedAt?.toDate?.() || new Date(0)) > (b.downloadedAt?.toDate?.() || new Date(0)) ? a : b
          );
          return { id: noteDoc.id, ...noteDoc.data(), downloadedAt: latest.downloadedAt, downloadCount: noteDownloads.length };
        } catch { return null; }
      });
      const notesData = (await Promise.all(notesPromises)).filter(Boolean);
      notesData.sort((a, b) =>
        (b.downloadedAt?.toDate?.() || new Date(0)) - (a.downloadedAt?.toDate?.() || new Date(0))
      );
      setDownloads(notesData);
      checkOfflineStatusForAll(notesData);
    } catch (error) {
      console.error('Error fetching downloads:', error);
      await loadFromIndexedDB();
    } finally {
      setLoading(false);
    }
  };

  const loadFromIndexedDB = async () => {
    try {
      const offlineFiles = await getAllOfflineFiles();
      if (!offlineFiles.length) { setDownloads([]); setOfflineStatus({}); setLoading(false); return; }
      const notes = offlineFiles.map(f => ({
        id: f.noteId,
        title: f.noteData?.title || 'Unknown',
        subject: f.noteData?.subject || '',
        department: f.noteData?.department || '',
        semester: f.noteData?.semester || '',
        upvotes: f.noteData?.upvotes || 0,
        views: f.noteData?.views || 0,
        downloads: f.noteData?.downloads || 0,
        fileType: f.noteData?.fileType || '',
        downloadedAt: null,
        downloadCount: 1,
        _offlineOnly: true,
        _downloadedAt: f.downloadedAt,
      }));
      notes.sort((a, b) => new Date(b._downloadedAt || 0) - new Date(a._downloadedAt || 0));
      setDownloads(notes);
      const statusMap = {};
      notes.forEach(n => { statusMap[n.id] = true; });
      setOfflineStatus(statusMap);
    } catch (err) {
      console.error('IndexedDB load error:', err);
      setDownloads([]);
    } finally {
      setLoading(false);
    }
  };

  const checkOfflineStatusForAll = async (notes) => {
    const statusMap = {};
    for (const note of notes) {
      const f = await getOfflineFile(note.id);
      statusMap[note.id] = !!f;
    }
    setOfflineStatus(statusMap);
  };

  // ── Filter logic (100% client-side — works offline) ──────────────
  const filteredDownloads = useMemo(() => {
    return downloads.filter(note => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || (
        note.title?.toLowerCase().includes(q) ||
        note.subject?.toLowerCase().includes(q) ||
        note.department?.toLowerCase().includes(q)
      );
      const matchesDept = !selectedDept || note.department === selectedDept;
      const matchesSem = !selectedSem || String(note.semester) === String(selectedSem);
      return matchesSearch && matchesDept && matchesSem;
    });
  }, [downloads, searchQuery, selectedDept, selectedSem]);

  const hasActiveFilters = searchQuery || selectedDept || selectedSem;

  const clearAllFilters = () => {
    setSearchQuery('');
    setSelectedDept(null);
    setSelectedSem(null);
  };

  // ── Get unique departments from actual downloads ──────────────────
  const availableDepts = useMemo(() => {
    const depts = [...new Set(downloads.map(n => n.department).filter(Boolean))];
    return DEPARTMENTS.filter(d => depts.includes(d));
  }, [downloads]);

  const availableSems = useMemo(() => {
    const sems = [...new Set(downloads.map(n => String(n.semester)).filter(Boolean))];
    return SEMESTERS.filter(s => sems.includes(String(s)));
  }, [downloads]);

  // ── Open file ────────────────────────────────────────────────────
  const handleOpenFile = async (note) => {
    const offlineFile = await getOfflineFile(note.id);
    if (offlineFile?.fileBlob) {
      try {
        const mimeType = note.fileType || offlineFile.fileBlob.type || 'application/octet-stream';
        const typedBlob = new Blob([offlineFile.fileBlob], { type: mimeType });
        const blobUrl = URL.createObjectURL(typedBlob);
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          const a = document.createElement('a');
          a.href = blobUrl; a.target = '_blank'; a.rel = 'noopener';
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
          toast.success('Opening offline file...');
        } else {
          setPreviewFile({ url: blobUrl, title: note.title, type: mimeType });
          toast.success('Opening offline copy');
        }
        return;
      } catch (err) { console.error('Error opening offline blob:', err); }
    }
    if (isOnline && note.fileURL) {
      window.open(note.fileURL, '_blank');
      toast.info('Opening online version');
    } else {
      toast.error('File not available offline. Connect to internet and download it first.');
    }
  };

  const handleDeleteOffline = async (noteId) => {
    if (!window.confirm('Delete offline copy? You can re-download it when online.')) return;
    try {
      await deleteOfflineFile(noteId);
      toast.success('Offline copy deleted');
      setOfflineStatus(prev => ({ ...prev, [noteId]: false }));
      if (!isOnline) setDownloads(prev => prev.filter(n => n.id !== noteId));
    } catch { toast.error('Failed to delete offline copy'); }
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const getTimeAgo = (date, isoString) => {
    const d = date?.toDate?.() || (isoString ? new Date(isoString) : null);
    if (!d) return 'Recently';
    const diff = new Date() - d;
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  };

  const offlineCount = Object.values(offlineStatus).filter(Boolean).length;

  const NoteCard = ({ note }) => {
    const isOffline = offlineStatus[note.id] || false;
    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg flex-shrink-0">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-gray-800 mb-0.5 line-clamp-2">{note.title}</h3>
            <p className="text-gray-500 text-sm truncate">{note.subject}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">{note.department}</span>
          <span className="px-2.5 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Sem {note.semester}</span>
          {note.downloadCount > 1 && (
            <span className="px-2.5 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              {note.downloadCount}x
            </span>
          )}
          {isOffline && (
            <span className="px-2.5 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Offline
            </span>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-gray-400 mb-3 pb-3 border-b">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{note.views || 0}</span>
            <span className="flex items-center gap-1 text-green-600"><ThumbsUp className="w-3.5 h-3.5" />{note.upvotes || 0}</span>
            <span className="flex items-center gap-1 text-blue-600"><Download className="w-3.5 h-3.5" />{note.downloads || 0}</span>
          </div>
          <span className="flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5" />
            {getTimeAgo(note.downloadedAt, note._downloadedAt)}
          </span>
        </div>

        <div className={`grid ${isOffline ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
          {!note._offlineOnly && (
            <button onClick={() => navigate(`/notes/${note.id}`)}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors text-sm"
            ><Eye className="w-4 h-4" /> View</button>
          )}
          <button
            onClick={() => handleOpenFile(note)}
            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
              isOffline ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            } ${note._offlineOnly ? 'col-span-2' : ''}`}
          >
            {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            {isOffline ? 'Open Offline' : 'Open'}
          </button>
          {isOffline && (
            <button onClick={() => handleDeleteOffline(note.id)}
              className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors text-sm"
              title="Delete offline copy"
            >🗑️</button>
          )}
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Offline banner */}
        {!isOnline && (
          <div className="mb-6 p-4 bg-orange-50 border-2 border-orange-300 rounded-xl flex items-center gap-3">
            <WifiOff className="w-6 h-6 text-orange-600 flex-shrink-0" />
            <div>
              <p className="font-bold text-orange-800">You're offline</p>
              <p className="text-sm text-orange-700">Showing {offlineCount} file{offlineCount !== 1 ? 's' : ''} saved on this device.</p>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <Download className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">My Downloads</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {downloads.length} files downloaded • {offlineCount} available offline
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow-md p-5">
            <p className="text-xs text-gray-500 mb-1">Total Downloads</p>
            <p className="text-3xl font-bold text-gray-800">
              {downloads.reduce((s, n) => s + (n.downloadCount || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-5">
            <p className="text-xs text-gray-500 mb-1">Unique Notes</p>
            <p className="text-3xl font-bold text-blue-600">{downloads.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-5">
            <p className="text-xs text-gray-500 mb-1">Departments</p>
            <p className="text-3xl font-bold text-purple-600">
              {new Set(downloads.map(n => n.department)).size}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-5">
            <p className="text-xs text-gray-500 mb-1">Offline Files</p>
            <p className="text-3xl font-bold text-green-600">{offlineCount}</p>
          </div>
        </div>

        {/* ── Search & Filter Bar ── */}
        {downloads.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md p-4 mb-6">

            {/* Search input + filter toggle */}
            <div className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by title, subject, branch..."
                  className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-400 focus:border-transparent text-sm bg-gray-50"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                  ><X className="w-5 h-5" /></button>
                )}
              </div>
              <button
                onClick={() => setShowFilters(p => !p)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all ${
                  showFilters || selectedDept || selectedSem
                    ? 'bg-purple-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span className="hidden sm:inline">Filters</span>
                {(selectedDept || selectedSem) && (
                  <span className="bg-white text-purple-600 text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                    {(selectedDept ? 1 : 0) + (selectedSem ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Expandable filter pills */}
            {showFilters && (
              <div className="space-y-3 pt-3 border-t border-gray-100">

                {/* Department filter */}
                {availableDepts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Department</p>
                    <div className="flex flex-wrap gap-2">
                      {availableDepts.map(dept => (
                        <button
                          key={dept}
                          onClick={() => setSelectedDept(p => p === dept ? null : dept)}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                            selectedDept === dept
                              ? 'bg-blue-600 text-white shadow-md scale-105'
                              : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >{dept}</button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Semester filter */}
                {availableSems.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Semester</p>
                    <div className="flex flex-wrap gap-2">
                      {availableSems.map(sem => (
                        <button
                          key={sem}
                          onClick={() => setSelectedSem(p => p === sem ? null : sem)}
                          className={`px-3 py-1.5 rounded-full text-sm font-semibold transition-all ${
                            selectedSem === sem
                              ? 'bg-purple-600 text-white shadow-md scale-105'
                              : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                          }`}
                        >Sem {sem}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Active filter summary + clear */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <p className="text-sm text-purple-600 font-medium">
                  {filteredDownloads.length} of {downloads.length} files
                  {searchQuery && <span> matching "<strong>{searchQuery}</strong>"</span>}
                  {selectedDept && <span> in <strong>{selectedDept}</strong></span>}
                  {selectedSem && <span> Sem <strong>{selectedSem}</strong></span>}
                </p>
                <button onClick={clearAllFilters}
                  className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium transition-colors"
                ><X className="w-3.5 h-3.5" /> Clear all</button>
              </div>
            )}
          </div>
        )}

        {/* Downloads Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading your downloads...</p>
          </div>
        ) : downloads.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Download className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {!isOnline ? 'No offline files on this device' : 'No downloads yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {!isOnline
                ? 'Connect to internet and download files to access them offline'
                : 'Start downloading study materials to access them here'}
            </p>
            {isOnline && (
              <button onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
              >Browse Notes</button>
            )}
          </div>
        ) : filteredDownloads.length === 0 ? (
          // No results for current filter
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No files match your search</h3>
            <p className="text-gray-500 mb-4">
              Try different keywords or clear filters
            </p>
            <button onClick={clearAllFilters}
              className="bg-gradient-to-r from-purple-600 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
            >Clear Filters</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredDownloads.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        )}
      </div>

      {/* Desktop in-app preview modal */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
            <p className="text-white font-semibold truncate flex-1 mr-4">{previewFile.title}</p>
            <button onClick={closePreview} className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe src={previewFile.url} className="w-full h-full border-0" title={previewFile.title} />
          </div>
        </div>
      )}
    </Layout>
  );
};

export default MyDownloads;