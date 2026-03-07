import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import {
  Star, FileText, ThumbsUp, Eye, Download,
  CheckSquare, Square, ShoppingCart, Loader, CheckCircle, X
} from 'lucide-react';
import {
  collection, query, orderBy, limit, getDocs,
  addDoc, updateDoc, doc, increment, serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

// ── Robust file downloader (works for PDF, PPTX, DOCX, XLSX, images) ──────────
const forceDownload = async (fileURL, fileName, fileType) => {
  // Strategy 1: fetch as blob — most reliable, preserves file integrity
  try {
    const response = await fetch(fileURL, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();

    // Ensure blob has correct MIME type
    const mimeType = fileType || blob.type || 'application/octet-stream';
    const typedBlob = new Blob([blob], { type: mimeType });

    const blobUrl = window.URL.createObjectURL(typedBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } catch (err) {
    console.warn('Blob download failed, trying Cloudinary flag:', err);
  }

  // Strategy 2: Cloudinary fl_attachment flag — forces server-side download header
  try {
    const attachUrl = fileURL.includes('cloudinary.com')
      ? fileURL.replace('/upload/', '/upload/fl_attachment/')
      : fileURL;
    const response2 = await fetch(attachUrl, { mode: 'cors' });
    if (!response2.ok) throw new Error(`HTTP ${response2.status}`);
    const blob2 = await response2.blob();
    const mimeType2 = fileType || blob2.type || 'application/octet-stream';
    const typedBlob2 = new Blob([blob2], { type: mimeType2 });
    const blobUrl2 = window.URL.createObjectURL(typedBlob2);
    const link2 = document.createElement('a');
    link2.href = blobUrl2;
    link2.download = fileName;
    link2.style.display = 'none';
    document.body.appendChild(link2);
    link2.click();
    document.body.removeChild(link2);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl2), 5000);
    return true;
  } catch (err2) {
    console.warn('Cloudinary flag download failed, using direct link:', err2);
  }

  // Strategy 3: Last resort — direct anchor with download attribute
  const link3 = document.createElement('a');
  link3.href = fileURL;
  link3.download = fileName;
  link3.style.display = 'none';
  document.body.appendChild(link3);
  link3.click();
  document.body.removeChild(link3);
  return false;
};

const getFileExtension = (fileType) => {
  const map = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'text/plain': 'txt',
  };
  return map[fileType] || 'pdf';
};

const safeFileName = (title, fileType) =>
  `${(title || 'file').replace(/[^a-z0-9\s\-_]/gi, '_').replace(/\s+/g, '_')}.${getFileExtension(fileType)}`;

// ─────────────────────────────────────────────────────────────────────────────

const MostUpvoted = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [topNotes, setTopNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Download Queue state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedNotes, setSelectedNotes] = useState([]);
  const [downloadingQueue, setDownloadingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ current: 0, total: 0, currentTitle: '' });

  useEffect(() => { fetchTopNotes(); }, []);
  useEffect(() => { if (!selectMode) setSelectedNotes([]); }, [selectMode]);

  const fetchTopNotes = async () => {
    try {
      const snapshot = await getDocs(
        query(collection(db, 'notes'), orderBy('upvotes', 'desc'), limit(50))
      );
      setTopNotes(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error('Error fetching top notes:', error);
    } finally {
      setLoading(false);
    }
  };

  // ── Selection helpers ─────────────────────────────────────────
  const toggleSelect = (note) => {
    setSelectedNotes(prev => {
      if (prev.find(n => n.id === note.id)) return prev.filter(n => n.id !== note.id);
      if (prev.length >= 10) { toast.warning('Maximum 10 notes at a time'); return prev; }
      return [...prev, note];
    });
  };
  const isSelected = (id) => selectedNotes.some(n => n.id === id);

  // ── Queue download ────────────────────────────────────────────
  const downloadOne = async (note, index) => {
    setQueueProgress({ current: index + 1, total: selectedNotes.length, currentTitle: note.title });

    // Stagger so browser doesn't block parallel downloads
    if (index > 0) await new Promise(r => setTimeout(r, index * 1500));

    try {
      if (currentUser) {
        await addDoc(collection(db, 'downloads'), {
          userId: currentUser.uid, noteId: note.id, downloadedAt: serverTimestamp(),
        });
        await updateDoc(doc(db, 'notes', note.id), { downloads: increment(1) });
      }
      const fileName = safeFileName(note.title, note.fileType);
      await forceDownload(note.fileURL, fileName, note.fileType);
    } catch (err) {
      console.error(`Failed: ${note.title}`, err);
      toast.error(`Failed to download: ${note.title}`);
    }
  };

  const handleDownloadQueue = async () => {
    if (!currentUser) { toast.error('Please login to download'); return; }
    if (selectedNotes.length === 0) return;
    setDownloadingQueue(true);
    setQueueProgress({ current: 0, total: selectedNotes.length, currentTitle: '' });
    try {
      for (let i = 0; i < selectedNotes.length; i++) {
        await downloadOne(selectedNotes[i], i);
      }
      setQueueProgress(p => ({ ...p, currentTitle: 'Done!' }));
      toast.success(`✅ ${selectedNotes.length} file${selectedNotes.length > 1 ? 's' : ''} downloaded!`);
      setTimeout(() => {
        setDownloadingQueue(false);
        setSelectMode(false);
        setQueueProgress({ current: 0, total: 0, currentTitle: '' });
      }, 1500);
    } catch (err) {
      console.error('Queue error:', err);
      setDownloadingQueue(false);
    }
  };

  // ── Note Card ─────────────────────────────────────────────────
  const NoteCard = ({ note, rank }) => {
    const selected = isSelected(note.id);
    return (
      <div
        onClick={() => selectMode ? toggleSelect(note) : navigate(`/notes/${note.id}`)}
        className={`relative bg-white rounded-lg shadow-md hover:shadow-xl transition-all p-5 cursor-pointer group ${
          selectMode && selected ? 'ring-2 ring-purple-500 bg-purple-50' : ''
        } ${selectMode ? 'hover:ring-2 hover:ring-purple-300' : ''}`}
      >
        {/* Rank badge — hidden in select mode */}
        {!selectMode && rank <= 3 && (
          <div className={`absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white z-10 ${
            rank === 1 ? 'bg-yellow-500' : rank === 2 ? 'bg-gray-400' : 'bg-orange-600'
          }`}>#{rank}</div>
        )}

        {/* Checkbox in select mode */}
        {selectMode && (
          <div className="absolute top-3 right-3 z-10">
            {selected
              ? <CheckSquare className="w-6 h-6 text-purple-600" />
              : <Square className="w-6 h-6 text-gray-300" />
            }
          </div>
        )}

        <div className="flex items-start gap-3 mb-3">
          <div className={`p-3 rounded-lg flex-shrink-0 ${
            selectMode && selected
              ? 'bg-gradient-to-br from-purple-500 to-purple-700'
              : 'bg-gradient-to-br from-purple-500 to-blue-500'
          }`}>
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1 min-w-0 pr-6">
            <h3 className={`font-semibold transition-colors truncate ${
              selectMode && selected ? 'text-purple-700' : 'text-gray-800 group-hover:text-purple-600'
            }`}>{note.title}</h3>
            <p className="text-sm text-gray-600 truncate">{note.subject}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">{note.department}</span>
          <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">Sem {note.semester}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-green-600 font-semibold">
              <ThumbsUp className="w-4 h-4" />{note.upvotes || 0}
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <Eye className="w-4 h-4" />{note.views || 0}
            </span>
            <span className="flex items-center gap-1 text-gray-500">
              <Download className="w-4 h-4" />{note.downloads || 0}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-800">Most Upvoted Notes</h1>
          </div>
          <p className="text-gray-600">Top-rated study materials as voted by students</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg p-6 border border-yellow-200">
            <p className="text-sm text-yellow-700 mb-1">Total Top Notes</p>
            <p className="text-3xl font-bold text-yellow-800">{topNotes.length}</p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
            <p className="text-sm text-green-700 mb-1">Total Upvotes</p>
            <p className="text-3xl font-bold text-green-800">
              {topNotes.reduce((sum, n) => sum + (n.upvotes || 0), 0)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <p className="text-sm text-blue-700 mb-1">Total Downloads</p>
            <p className="text-3xl font-bold text-blue-800">
              {topNotes.reduce((sum, n) => sum + (n.downloads || 0), 0)}
            </p>
          </div>
        </div>

        {/* ── Toolbar: Select + Queue bar ── */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-sm text-gray-500">
              {topNotes.length} notes • Sorted by most upvoted
            </p>
            <button
              onClick={() => setSelectMode(p => !p)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                selectMode
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {selectMode ? <X className="w-4 h-4" /> : <CheckSquare className="w-4 h-4" />}
              {selectMode ? 'Cancel' : 'Select to Download'}
            </button>
          </div>

          {/* Queue Bar */}
          {selectMode && (
            <div className={`p-4 rounded-2xl border-2 transition-all ${
              selectedNotes.length > 0 ? 'bg-purple-50 border-purple-300' : 'bg-gray-50 border-gray-200'
            }`}>
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <ShoppingCart className={`w-5 h-5 ${selectedNotes.length > 0 ? 'text-purple-600' : 'text-gray-400'}`} />
                  <div>
                    <p className={`font-semibold ${selectedNotes.length > 0 ? 'text-purple-700' : 'text-gray-500'}`}>
                      {selectedNotes.length === 0
                        ? 'Tap notes to select them (max 10)'
                        : `${selectedNotes.length} note${selectedNotes.length > 1 ? 's' : ''} selected`
                      }
                    </p>
                    {selectedNotes.length > 0 && (
                      <p className="text-xs text-purple-500 mt-0.5 max-w-sm truncate">
                        {selectedNotes.map(n => n.title).join(', ')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {selectedNotes.length > 0 && (
                    <button onClick={() => setSelectedNotes([])}
                      className="px-3 py-2 text-sm text-gray-500 hover:text-red-500 font-medium transition-colors"
                    >Clear</button>
                  )}
                  <button
                    onClick={handleDownloadQueue}
                    disabled={selectedNotes.length === 0 || downloadingQueue}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-teal-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadingQueue
                      ? <Loader className="w-4 h-4 animate-spin" />
                      : <Download className="w-4 h-4" />
                    }
                    {downloadingQueue
                      ? `Downloading ${queueProgress.current}/${queueProgress.total}...`
                      : selectedNotes.length > 1
                        ? `Download All (${selectedNotes.length})`
                        : 'Download'
                    }
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              {downloadingQueue && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-purple-600 mb-1">
                    <span className="truncate max-w-xs">📥 {queueProgress.currentTitle}</span>
                    <span>{queueProgress.current}/{queueProgress.total}</span>
                  </div>
                  <div className="w-full bg-purple-100 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-teal-500 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${queueProgress.total > 0 ? (queueProgress.current / queueProgress.total) * 100 : 0}%` }}
                    />
                  </div>
                  {queueProgress.currentTitle === 'Done!' && (
                    <p className="text-center text-green-600 font-semibold text-sm mt-2 flex items-center justify-center gap-1">
                      <CheckCircle className="w-4 h-4" /> All downloads complete!
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading top notes...</p>
          </div>
        ) : topNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {topNotes.map((note, index) => (
              <NoteCard key={note.id} note={note} rank={index + 1} />
            ))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Star className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">No upvoted notes yet</h3>
            <p className="text-gray-600">Be the first to upvote quality study materials!</p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MostUpvoted;