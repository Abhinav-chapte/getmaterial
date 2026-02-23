import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Download, FileText, ThumbsUp, Eye, Calendar, Wifi, WifiOff } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import { getOfflineFile, deleteOfflineFile } from '../utils/offlineStorage';

const MyDownloads = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [downloads, setDownloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offlineStatus, setOfflineStatus] = useState({});

  useEffect(() => {
    if (currentUser) {
      fetchMyDownloads();
    }
  }, [currentUser]);

  const fetchMyDownloads = async () => {
    setLoading(true);
    try {
      console.log('🔍 Fetching downloads for user:', currentUser.uid);

      // Get all download records for current user
      const downloadsQuery = query(
        collection(db, 'downloads'),
        where('userId', '==', currentUser.uid)
      );
      const downloadsSnapshot = await getDocs(downloadsQuery);

      console.log('📊 Total download records found:', downloadsSnapshot.size);

      if (downloadsSnapshot.empty) {
        console.log('❌ No downloads found for this user');
        setDownloads([]);
        setLoading(false);
        return;
      }

      // Group downloads by noteId
      const downloadsByNote = {};
      downloadsSnapshot.docs.forEach(downloadDoc => {
        const data = downloadDoc.data();
        const noteId = data.noteId;
        
        if (!downloadsByNote[noteId]) {
          downloadsByNote[noteId] = [];
        }
        downloadsByNote[noteId].push({
          id: downloadDoc.id,
          ...data
        });
      });

      console.log('📝 Unique notes downloaded:', Object.keys(downloadsByNote).length);

      // Fetch note details for each downloaded note
      const notesPromises = Object.keys(downloadsByNote).map(async (noteId) => {
        try {
          const noteDoc = await getDoc(doc(db, 'notes', noteId));
          if (noteDoc.exists()) {
            const noteDownloads = downloadsByNote[noteId];
            
            // Find the latest download time
            const latestDownload = noteDownloads.reduce((latest, current) => {
              const currentTime = current.downloadedAt?.toDate?.() || new Date(0);
              const latestTime = latest.downloadedAt?.toDate?.() || new Date(0);
              return currentTime > latestTime ? current : latest;
            });

            return {
              id: noteDoc.id,
              ...noteDoc.data(),
              downloadedAt: latestDownload.downloadedAt,
              downloadCount: noteDownloads.length
            };
          } else {
            console.warn('⚠️ Note not found:', noteId);
            return null;
          }
        } catch (error) {
          console.error('❌ Error fetching note:', noteId, error);
          return null;
        }
      });

      const notesData = (await Promise.all(notesPromises)).filter(note => note !== null);
      
      // Sort by most recently downloaded
      notesData.sort((a, b) => {
        const aTime = a.downloadedAt?.toDate?.() || new Date(0);
        const bTime = b.downloadedAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      console.log('✅ Final notes to display:', notesData.length);
      setDownloads(notesData);

      // Check offline status for each note
      checkOfflineStatusForAll(notesData);
    } catch (error) {
      console.error('❌ Error fetching downloads:', error);
      toast.error('Failed to load downloads');
    } finally {
      setLoading(false);
    }
  };

  const checkOfflineStatusForAll = async (notes) => {
    const statusMap = {};
    for (const note of notes) {
      const offlineFile = await getOfflineFile(note.id);
      statusMap[note.id] = !!offlineFile;
    }
    setOfflineStatus(statusMap);
  };

  const getTimeAgo = (date) => {
    if (!date) return 'Recently';
    const now = new Date();
    const downloadDate = date.toDate();
    const diffMs = now - downloadDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return downloadDate.toLocaleDateString();
  };

  const handleOpenFile = async (note) => {
    // Try to get offline version first
    const offlineFile = await getOfflineFile(note.id);
    
    if (offlineFile) {
      try {
        const url = URL.createObjectURL(offlineFile.fileBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${note.title}.pdf`;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success('📂 Opening offline version');
      } catch (error) {
        console.error('Error opening offline file:', error);
        // Fallback to online version
        window.open(note.fileURL, '_blank');
        toast.info('Opening online version');
      }
    } else {
      // No offline version, open from Cloudinary
      window.open(note.fileURL, '_blank');
      toast.info('📡 Opening online version');
    }
  };

  const handleDeleteOffline = async (noteId) => {
    if (!window.confirm('Delete offline copy? You can still re-download it later.')) {
      return;
    }

    try {
      await deleteOfflineFile(noteId);
      toast.success('Offline copy deleted');
      // Update offline status
      setOfflineStatus(prev => ({
        ...prev,
        [noteId]: false
      }));
    } catch (error) {
      console.error('Error deleting offline file:', error);
      toast.error('Failed to delete offline copy');
    }
  };

  const NoteCard = ({ note }) => {
    const isOffline = offlineStatus[note.id] || false;

    return (
      <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-800 mb-1">
              {note.title}
            </h3>
            <p className="text-gray-600">{note.subject}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
            {note.department}
          </span>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
            Sem {note.semester}
          </span>
          {note.downloadCount > 1 && (
            <span className="px-3 py-1 bg-orange-100 text-orange-700 text-xs font-medium rounded-full">
              Downloaded {note.downloadCount}x
            </span>
          )}
          {isOffline && (
            <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-medium rounded-full flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              Available Offline
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

        <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
          <div className="flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            <span>Downloaded {getTimeAgo(note.downloadedAt)}</span>
          </div>
        </div>

        <div className={`grid ${isOffline ? 'grid-cols-3' : 'grid-cols-2'} gap-2`}>
          <button
            onClick={() => navigate(`/notes/${note.id}`)}
            className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
          >
            <Eye className="w-4 h-4" />
            View
          </button>
          <button
            onClick={() => handleOpenFile(note)}
            className={`flex items-center justify-center gap-1 px-3 py-2 rounded-lg font-medium transition-colors ${
              isOffline 
                ? 'bg-green-50 text-green-700 hover:bg-green-100' 
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            {isOffline ? <WifiOff className="w-4 h-4" /> : <Wifi className="w-4 h-4" />}
            Open
          </button>
          {isOffline && (
            <button
              onClick={() => handleDeleteOffline(note.id)}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium transition-colors"
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Total Downloads</p>
            <p className="text-3xl font-bold text-gray-800">
              {downloads.reduce((sum, note) => sum + (note.downloadCount || 0), 0)}
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
            {downloads.map(note => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Download className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No downloads yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start downloading study materials to access them here
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r via-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
            >
              Browse Notes
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyDownloads;