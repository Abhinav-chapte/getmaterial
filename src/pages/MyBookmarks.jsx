import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { Bookmark, FileText, ThumbsUp, Eye, Download, Calendar, X } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

const MyBookmarks = () => {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentUser) {
      fetchMyBookmarks();
    }
  }, [currentUser]);

  const fetchMyBookmarks = async () => {
    setLoading(true);
    try {
      console.log('🔖 Fetching bookmarks for user:', currentUser.uid);

      const bookmarksQuery = query(
        collection(db, 'bookmarks'),
        where('userId', '==', currentUser.uid)
      );
      const bookmarksSnapshot = await getDocs(bookmarksQuery);

      console.log('📊 Total bookmarks found:', bookmarksSnapshot.size);

      if (bookmarksSnapshot.empty) {
        console.log('❌ No bookmarks found for this user');
        setBookmarks([]);
        setLoading(false);
        return;
      }

      const notesPromises = bookmarksSnapshot.docs.map(async (bookmarkDoc) => {
        try {
          const bookmarkData = bookmarkDoc.data();
          const noteDoc = await getDoc(doc(db, 'notes', bookmarkData.noteId));
          
          if (noteDoc.exists()) {
            return {
              id: noteDoc.id,
              ...noteDoc.data(),
              bookmarkId: bookmarkDoc.id,
              bookmarkedAt: bookmarkData.createdAt
            };
          } else {
            console.warn('⚠️ Note not found:', bookmarkData.noteId);
            return null;
          }
        } catch (error) {
          console.error('❌ Error fetching note:', error);
          return null;
        }
      });

      const notesData = (await Promise.all(notesPromises)).filter(note => note !== null);
      
      notesData.sort((a, b) => {
        const aTime = a.bookmarkedAt?.toDate?.() || new Date(0);
        const bTime = b.bookmarkedAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      });

      console.log('✅ Final bookmarks to display:', notesData.length);
      setBookmarks(notesData);
    } catch (error) {
      console.error('❌ Error fetching bookmarks:', error);
      toast.error('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveBookmark = async (bookmarkId, noteTitle) => {
    if (!window.confirm(`Remove "${noteTitle}" from bookmarks?`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'bookmarks', bookmarkId));
      toast.success('Bookmark removed');
      fetchMyBookmarks();
    } catch (error) {
      console.error('Error removing bookmark:', error);
      toast.error('Failed to remove bookmark');
    }
  };

  const getTimeAgo = (date) => {
    if (!date) return 'Recently';
    const now = new Date();
    const bookmarkDate = date.toDate();
    const diffMs = now - bookmarkDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return bookmarkDate.toLocaleDateString();
  };

  const NoteCard = ({ note }) => (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-5 relative">
      <button
        onClick={() => handleRemoveBookmark(note.bookmarkId, note.title)}
        className="absolute top-3 right-3 p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
        title="Remove bookmark"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-start gap-3 mb-3">
        <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-3 rounded-lg">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 pr-8">
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
        <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-medium rounded-full flex items-center gap-1">
          <Bookmark className="w-3 h-3 fill-current" />
          Saved
        </span>
      </div>

      {note.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">
          {note.description}
        </p>
      )}

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
          <span>Saved {getTimeAgo(note.bookmarkedAt)}</span>
        </div>
      </div>

      <button
        onClick={() => navigate(`/notes/${note.id}`)}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-4 py-2 rounded-lg font-semibold hover:shadow-lg transition-all"
      >
        View Note
      </button>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Bookmark className="w-8 h-8 text-yellow-600 fill-current" />
            <h1 className="text-3xl font-bold text-gray-800">My Bookmarks</h1>
          </div>
          <p className="text-gray-600">
            Study materials you've saved for later
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Total Bookmarks</p>
            <p className="text-3xl font-bold text-yellow-600">{bookmarks.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Departments</p>
            <p className="text-3xl font-bold text-blue-600">
              {new Set(bookmarks.map(n => n.department)).size}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6">
            <p className="text-sm text-gray-600 mb-1">Subjects</p>
            <p className="text-3xl font-bold text-purple-600">
              {new Set(bookmarks.map(n => n.subject)).size}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading your bookmarks...</p>
          </div>
        ) : bookmarks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {bookmarks.map(note => (
              <NoteCard key={note.id} note={note} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Bookmark className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No bookmarks yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start bookmarking notes to save them for later study
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
            >
              Browse Notes
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyBookmarks;