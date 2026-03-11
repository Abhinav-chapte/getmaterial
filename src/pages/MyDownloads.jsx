import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Download, FileText, ThumbsUp, Eye, Calendar, Wifi, WifiOff, X } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import { getOfflineFile, getAllOfflineFiles, deleteOfflineFile } from '../utils/offlineStorage';

const MyDownloads = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineStatus, setOfflineStatus] = useState({});
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [previewFile, setPreviewFile] = useState(null); // { url, title, type }

  // Track online/offline status
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
    if (currentUser) {
      fetchMyDownloads();
    }
  }, [currentUser, isOnline]);

  const fetchMyDownloads = async () => {
    setLoading(true);
    try {
      if (!isOnline) {
        // ── OFFLINE MODE: load everything from IndexedDB only ──
        await loadFromIndexedDB();
        return;
      }

      // ── ONLINE MODE: load from Firestore + check IndexedDB for offline status ──
      const downloadsQuery = query(
        collection(db, 'downloads'),
        where('userId', '==', currentUser.uid)
      );
      const downloadsSnapshot = await getDocs(downloadsQuery);

      if (downloadsSnapshot.empty) {
        // Even if no Firestore records, show locally saved files
        await loadFromIndexedDB();
        return;
      }

      // Group by noteId, keep latest download time
      const downloadsByNote = {};
      downloadsSnapshot.docs.forEach(d => {
        const data = d.data();
        const noteId = data.noteId;
        if (!downloadsByNote[noteId]) downloadsByNote[noteId] = [];
        downloadsByNote[noteId].push({ id: d.id, ...data });
      });

      const notesPromises = Object.keys(downloadsByNote).map(async (noteId) => {
        try {
          const noteDoc = await getDoc(doc(db, 'notes', noteId));
          if (!noteDoc.exists()) return null;
          const noteDownloads = downloadsByNote[noteId];
          const latestDownload = noteDownloads.reduce((latest, current) => {
            const ct = current.downloadedAt?.toDate?.() || new Date(0);
            const lt = latest.downloadedAt?.toDate?.() || new Date(0);
            return ct > lt ? current : latest;
          });
          return {
            id: noteDoc.id,
            ...noteDoc.data(),
            downloadedAt: latestDownload.downloadedAt,
            downloadCount: noteDownloads.length,
          };
        } catch { return null; }
      });

      const notesData = (await Promise.all(notesPromises)).filter(Boolean);
      notesData.sort((a, b) => {
        const aTime = a.downloadedAt?.toDate?.() || new Date(0);
        const bTime = b.downloadedAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      setDownloads(notesData);
      checkOfflineStatusForAll(notesData);
    } catch (error) {
      console.error('Error fetching downloads:', error);
      // Network error — fall back to IndexedDB
      await loadFromIndexedDB();
    } finally {
      setLoading(false);
    }
  };

  // Load only from IndexedDB (offline fallback)
  const loadFromIndexedDB = async () => {
    try {
      const offlineFiles = await getAllOfflineFiles();
      if (offlineFiles.length === 0) {
        setDownloads([]);
        setOfflineStatus({});
        setLoading(false);
        return;
      }

      // Build note cards from IndexedDB data
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

      notes.sort((a, b) =>
        new Date(b._downloadedAt || 0) - new Date(a._downloadedAt || 0)
      );

      setDownloads(notes);

      // All are offline
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

  // ── Open file: show in-app preview (never re-download) ──────────
  const handleOpenFile = async (note) => {
    const offlineFile = await getOfflineFile(note.id);

    if (offlineFile?.fileBlob) {
      try {
        const mimeType = note.fileType || offlineFile.fileBlob.type || 'application/pdf';
        const typedBlob = new Blob([offlineFile.fileBlob], { type: mimeType });
        const url = URL.createObjectURL(typedBlob);
        setPreviewFile({ url, title: note.title, type: mimeType });
        toast.success('📂 Opening offline copy');
        return;
      } catch (err) {
        console.error('Error opening offline blob:', err);
      }
    }

    // Online fallback — open in new tab (view, not download)
    if (isOnline && note.fileURL) {
      window.open(note.fileURL, '_blank');
      toast.info('📡 Opening online version');
    } else {
      toast.error('File not available offline. Please connect to internet to download it first.');
    }
  };

  const handleDeleteOffline = async (noteId) => {
    if (!window.confirm('Delete offline copy? You can re-download it when online.')) return;
    try {
      await deleteOfflineFile(noteId);
      toast.success('Offline copy deleted');
      setOfflineStatus(prev => ({ ...prev, [noteId]: false }));
      // If offline mode, remove from list too
      if (!isOnline) {
        setDownloads(prev => prev.filter(n => n.id !== noteId));
      }
    } catch (error) {
      toast.error('Failed to delete offline copy');
    }
  };

  const closePreview = () => {
    if (previewFile?.url) URL.revokeObjectURL(previewFile.url);
    setPreviewFile(null);
  };

  const getTimeAgo = (date, isoString) => {
    const d = date?.toDate?.() || (isoString ? new Date(isoString) : null);
    if (!d) return 'Recently';
    const diffMs = new Date() - d;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return d.toLocaleDateString();
  };

  const isPDF = (note) =>
    note.fileType === 'application/pdf' || note.title?.toLowerCase().endsWith('.pdf');

  const NoteCard = ({ note }) => {
    const isOffline = offlineStatus[note.id] || false;

    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg flex-shrink-0">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-800 mb-1 truncate">{note.title}</h3>
            <p className="text-gray-600 text-sm truncate">{note.subject}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">{note.department}</span>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Sem {note.semester}</span>
          {note.downloadCount > 1 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              Downloaded {note.downloadCount}x
            </span>
          )}
          {isOffline && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" /> Available Offline
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4 pb-4 border-b">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-gray-600">
              <Eye className="w-4 h-4" />
              <span className="text-sm font-semibold">{note.views || 0}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Views</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600">
              <ThumbsUp className="w-4 h-4" />
              <span className="text-sm font-semibold">{note.upvotes || 0}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Upvotes</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-blue-600">
              <Download className="w-4 h-4" />
              <span className="text-sm font-semibold">{note.downloads || 0}</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Downloads</p>
          </div>
        </div>

        <div className="flex items-center gap-1 text-sm text-gray-500 mb-4">
          <Calendar className="w-4 h-4" />
          <span>Downloaded {getTimeAgo(note.downloadedAt, note._downloadedAt)}</span>
        </div>

        <div className={`grid ${isOffline ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
          {/* View button — only when online */}
          {!note._offlineOnly && (
            <button
              onClick={() => navigate(`/notes/${note.id}`)}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors text-sm"
            >
              <Eye className="w-4 h-4" /> View
            </button>
          )}

          {/* Open button — opens preview, never re-downloads */}
          <button
            onClick={() => handleOpenFile(note)}
            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors text-sm ${
              isOffline
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            } ${note._offlineOnly ? 'col-span-2' : ''}`}
          >
            {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            {isOffline ? 'Open Offline' : 'Open'}
          </button>

          {/* Delete offline copy */}
          {isOffline && (
            <button
              onClick={() => handleDeleteOffline(note.id)}
              className="flex items-center justify-center px-3 py-2 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors text-sm"
              title="Delete offline copy"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    );
  };

  const offlineCount = Object.values(offlineStatus).filter(Boolean).length;

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
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Download className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-800">My Downloads</h1>
          </div>
          <p className="text-gray-600">
            Study materials you've downloaded • {offlineCount} available offline
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Total Downloads</p>
            <p className="text-3xl font-bold text-gray-800">
              {downloads.reduce((sum, n) => sum + (n.downloadCount || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Unique Notes</p>
            <p className="text-3xl font-bold text-blue-600">{downloads.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Departments</p>
            <p className="text-3xl font-bold text-purple-600">
              {new Set(downloads.map(n => n.department)).size}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Offline Files</p>
            <p className="text-3xl font-bold text-green-600">{offlineCount}</p>
          </div>
        </div>

        {/* Downloads Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading your downloads...</p>
          </div>
        ) : downloads.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {downloads.map(note => <NoteCard key={note.id} note={note} />)}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Download className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              {!isOnline ? 'No offline files on this device' : 'No downloads yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {!isOnline
                ? 'Connect to internet and download files to access them offline'
                : 'Start downloading study materials to access them here'
              }
            </p>
            {isOnline && (
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
              >Browse Notes</button>
            )}
          </div>
        )}
      </div>

      {/* ── In-app File Preview Modal ── */}
      {previewFile && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 bg-gray-900">
            <p className="text-white font-semibold truncate flex-1 mr-4">{previewFile.title}</p>
            <button onClick={closePreview} className="p-2 rounded-lg hover:bg-gray-700 transition-colors">
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {previewFile.type === 'application/pdf' || previewFile.url.includes('blob:') ? (
              <iframe
                src={previewFile.url}
                className="w-full h-full border-0"
                title={previewFile.title}
              />
            ) : (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-white">
                  <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-semibold mb-2">{previewFile.title}</p>
                  <p className="text-gray-400 mb-6">This file type can't be previewed in-app</p>
                  <a
                    href={previewFile.url}
                    download={previewFile.title}
                    className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700"
                  >
                    Download to Open
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
};

export default MyDownloads;