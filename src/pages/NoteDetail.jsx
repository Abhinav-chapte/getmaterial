import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import {
  Download, ThumbsUp, ThumbsDown, Eye, Calendar, User,
  FileText, Share2, Flag, Bookmark, ExternalLink, CheckCircle,
  X, Maximize2, AlertTriangle, Trash2, Loader, ShieldAlert
} from 'lucide-react';
import {
  doc, getDoc, updateDoc, increment, addDoc, collection,
  query, where, getDocs, deleteDoc, serverTimestamp, limit, orderBy
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import { saveFileOffline } from '../utils/offlineStorage';
import ReportButton from '../components/admin/ReportButton';
import { saveRecentlyViewed } from '../utils/recentlyViewed';

const NoteDetail = () => {
  const { noteId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [relatedNotes, setRelatedNotes] = useState([]);

  const isAdmin = ['admin', 'super_admin'].includes(userProfile?.role?.trim());

  useEffect(() => {
    fetchNoteDetails();
    if (currentUser) {
      checkUserVote();
      checkBookmark();
    }
  }, [noteId, currentUser]);

  const fetchNoteDetails = async () => {
    try {
      const noteDoc = await getDoc(doc(db, 'notes', noteId));
      if (noteDoc.exists()) {
        const noteData = { id: noteDoc.id, ...noteDoc.data() };
        setNote(noteData);

        // Save to recently viewed
        saveRecentlyViewed({
          id: noteData.id,
          title: noteData.title,
          subject: noteData.subject,
          department: noteData.department,
          semester: noteData.semester,
          upvotes: noteData.upvotes || 0,
          views: noteData.views || 0,
          viewedAt: new Date().toISOString(),
        });

        await updateDoc(doc(db, 'notes', noteId), { views: increment(1) });

        // Fetch related notes after we have the note data
        fetchRelatedNotes(noteData);
      } else {
        toast.error('Note not found');
        navigate('/dashboard');
      }
    } catch (error) {
      console.error('Error fetching note:', error);
      toast.error('Failed to load note');
    } finally {
      setLoading(false);
    }
  };

  // ── Related Notes: same subject first, fill rest with same dept+sem ──
  const fetchRelatedNotes = async (currentNote) => {
    try {
      const MAX = 4;
      const seen = new Set([currentNote.id]);
      let related = [];

      // Step 1: same subject
      if (currentNote.subject) {
        const subjectSnap = await getDocs(
          query(
            collection(db, 'notes'),
            where('subject', '==', currentNote.subject),
            where('status', '!=', 'hidden'),
            limit(MAX + 1)
          )
        );
        subjectSnap.docs.forEach(d => {
          if (!seen.has(d.id) && related.length < MAX) {
            seen.add(d.id);
            related.push({ id: d.id, ...d.data(), _matchReason: 'Same Subject' });
          }
        });
      }

      // Step 2: fill remaining slots with same department + semester
      if (related.length < MAX && currentNote.department) {
        const deptSnap = await getDocs(
          query(
            collection(db, 'notes'),
            where('department', '==', currentNote.department),
            where('semester', '==', currentNote.semester),
            limit(MAX * 2)
          )
        );
        deptSnap.docs.forEach(d => {
          if (!seen.has(d.id) && related.length < MAX && d.data().status !== 'hidden') {
            seen.add(d.id);
            related.push({ id: d.id, ...d.data(), _matchReason: 'Same Department' });
          }
        });
      }

      setRelatedNotes(related);
    } catch (err) {
      console.error('Error fetching related notes:', err);
    }
  };

  const checkUserVote = async () => {
    try {
      const votesQuery = query(
        collection(db, 'votes'),
        where('userId', '==', currentUser.uid),
        where('noteId', '==', noteId)
      );
      const voteSnapshot = await getDocs(votesQuery);
      if (!voteSnapshot.empty) setUserVote(voteSnapshot.docs[0].data().voteType);
    } catch (error) { console.error('Error checking vote:', error); }
  };

  const checkBookmark = async () => {
    try {
      const bookmarksQuery = query(
        collection(db, 'bookmarks'),
        where('userId', '==', currentUser.uid),
        where('noteId', '==', noteId)
      );
      const bookmarkSnapshot = await getDocs(bookmarksQuery);
      setIsBookmarked(!bookmarkSnapshot.empty);
    } catch (error) { console.error('Error checking bookmark:', error); }
  };

  const handleVote = async (voteType) => {
    if (!currentUser) { toast.error('Please login to vote'); return; }
    try {
      const votesQuery = query(
        collection(db, 'votes'),
        where('userId', '==', currentUser.uid),
        where('noteId', '==', noteId)
      );
      const voteSnapshot = await getDocs(votesQuery);
      if (!voteSnapshot.empty) {
        const existingVote = voteSnapshot.docs[0];
        const existingVoteType = existingVote.data().voteType;
        if (existingVoteType === voteType) {
          await deleteDoc(existingVote.ref);
          await updateDoc(doc(db, 'notes', noteId), {
            [voteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(-1)
          });
          setUserVote(null);
          toast.info('Vote removed');
        } else {
          await updateDoc(existingVote.ref, { voteType });
          await updateDoc(doc(db, 'notes', noteId), {
            [existingVoteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(-1),
            [voteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(1)
          });
          setUserVote(voteType);
          toast.success('Vote changed');
        }
      } else {
        await addDoc(collection(db, 'votes'), {
          userId: currentUser.uid, noteId, voteType, createdAt: new Date()
        });
        await updateDoc(doc(db, 'notes', noteId), {
          [voteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(1)
        });
        setUserVote(voteType);
        toast.success(`${voteType === 'upvote' ? 'Upvoted' : 'Downvoted'}!`);
      }
      fetchNoteDetails();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to vote');
    }
  };

  const handleDownload = async () => {
    if (!currentUser) { toast.error('Please login to download'); return; }
    if (downloading) return;
    setDownloading(true);

    const mimeToExt = {
      'application/pdf': 'pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
      'application/vnd.ms-excel': 'xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
      'image/jpeg': 'jpg', 'image/png': 'png',
    };
    const ext = mimeToExt[note.fileType] || 'pdf';
    const fileName = `${note.title.replace(/[^a-z0-9\s]/gi, '_').replace(/\s+/g, '_')}.${ext}`;

    try {
      toast.info('⏳ Downloading & saving for offline...');

      // Log to Firestore
      await addDoc(collection(db, 'downloads'), {
        userId: currentUser.uid, noteId, downloadedAt: serverTimestamp()
      });
      await updateDoc(doc(db, 'notes', noteId), { downloads: increment(1) });

      // Fetch blob — strategy 1: direct, strategy 2: cloudinary fl_attachment
      let blob = null;
      try {
        const r = await fetch(note.fileURL, { mode: 'cors' });
        if (r.ok) blob = await r.blob();
        else throw new Error(`HTTP ${r.status}`);
      } catch {
        try {
          const attachUrl = note.fileURL.includes('cloudinary.com')
            ? note.fileURL.replace('/upload/', '/upload/fl_attachment/')
            : note.fileURL;
          const r2 = await fetch(attachUrl, { mode: 'cors' });
          if (r2.ok) blob = await r2.blob();
        } catch (e2) { console.warn('Both fetch strategies failed:', e2); }
      }

      if (blob) {
        // Ensure correct MIME type preserved on blob
        const mimeType = note.fileType || blob.type || 'application/octet-stream';
        const typedBlob = new Blob([blob], { type: mimeType });

        // ── Save to IndexedDB (Spotify approach — available offline forever) ──
        try {
          await saveFileOffline(noteId, typedBlob, {
            title: note.title,
            subject: note.subject,
            department: note.department,
            semester: note.semester,
            fileSize: typedBlob.size,
            fileType: mimeType,
            uploaderName: note.uploaderName,
          });
          toast.success('✅ Saved! Open in My Downloads even without internet.');
        } catch (offlineErr) {
          console.warn('IndexedDB save failed:', offlineErr);
          toast.success('✅ Downloaded successfully!');
        }

        // Trigger device download
        const blobUrl = window.URL.createObjectURL(typedBlob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = fileName;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 3000);

      } else {
        // Fallback — direct link (won't save offline)
        const link = document.createElement('a');
        link.href = note.fileURL;
        link.download = fileName;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.warning('⚠️ Downloaded but could not save offline. Try on a stable connection.');
      }

      fetchNoteDetails();
    } catch (error) {
      console.error('Download error:', error);
      toast.error('Download failed. Please try again.');
    } finally { setDownloading(false); }
  };

  const handleBookmark = async () => {
    if (!currentUser) { toast.error('Please login to bookmark'); return; }
    try {
      const bookmarksQuery = query(
        collection(db, 'bookmarks'),
        where('userId', '==', currentUser.uid),
        where('noteId', '==', noteId)
      );
      const bookmarkSnapshot = await getDocs(bookmarksQuery);
      if (!bookmarkSnapshot.empty) {
        await deleteDoc(bookmarkSnapshot.docs[0].ref);
        setIsBookmarked(false);
        toast.info('Bookmark removed');
      } else {
        await addDoc(collection(db, 'bookmarks'), {
          userId: currentUser.uid, noteId, createdAt: new Date()
        });
        setIsBookmarked(true);
        toast.success('Bookmarked!');
      }
    } catch (error) {
      console.error('Error bookmarking:', error);
      toast.error('Failed to bookmark');
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: note.title, text: `Check out: ${note.title}`, url: shareUrl });
        toast.success('Shared successfully!');
      } catch (error) { if (error.name !== 'AbortError') copyToClipboard(shareUrl); }
    } else { copyToClipboard(shareUrl); }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('📋 Link copied to clipboard!');
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text; document.body.appendChild(textArea); textArea.select();
      try { document.execCommand('copy'); toast.success('📋 Link copied to clipboard!'); }
      catch { toast.error('Failed to copy link'); }
      document.body.removeChild(textArea);
    }
  };

  const handleAdminDelete = async () => {
    if (!window.confirm(`Permanently delete "${note.title}"? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'notes', noteId));
      const reportsSnap = await getDocs(query(collection(db, 'reports'), where('noteId', '==', noteId)));
      for (const reportDoc of reportsSnap.docs) {
        await updateDoc(reportDoc.ref, {
          status: 'resolved', action: 'deleted',
          reviewedBy: currentUser.uid, reviewedByName: userProfile?.name,
          reviewedAt: serverTimestamp(),
        });
      }
      await addDoc(collection(db, 'adminLogs'), {
        actionType: 'delete_note', performedBy: currentUser.uid,
        performedByName: userProfile?.name || 'Admin',
        targetId: noteId, targetName: note.title,
        reason: 'Admin deletion from note detail page', timestamp: serverTimestamp(),
      });
      toast.success('✅ Note deleted successfully');
      navigate('/dashboard');
    } catch (error) {
      console.error('Admin delete error:', error);
      toast.error('Failed to delete note');
    } finally { setDeleting(false); }
  };

  const handleAdminRestore = async () => {
    try {
      await updateDoc(doc(db, 'notes', noteId), { status: 'active', reportCount: 0, reportedBy: [] });
      await addDoc(collection(db, 'adminLogs'), {
        actionType: 'restore_note', performedBy: currentUser.uid,
        performedByName: userProfile?.name || 'Admin',
        targetId: noteId, targetName: note.title,
        reason: 'Admin restored from note detail page', timestamp: serverTimestamp(),
      });
      toast.success('✅ Note restored successfully');
      fetchNoteDetails();
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore note');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
      </Layout>
    );
  }

  if (!note) {
    return (
      <Layout>
        <div className="text-center py-12"><p className="text-gray-600">Note not found</p></div>
      </Layout>
    );
  }

  const isPDF = note.fileType === 'application/pdf';
  const isHidden = note.status === 'hidden';

  // ── Related Note Card ────────────────────────────────────────
  const RelatedNoteCard = ({ rNote }) => (
    <div
      onClick={() => navigate(`/notes/${rNote.id}`)}
      className="bg-white rounded-xl border border-gray-100 hover:border-purple-300 hover:shadow-lg transition-all p-4 cursor-pointer group"
    >
      <div className="flex items-start gap-3">
        <div className="bg-gradient-to-br from-purple-400 to-blue-500 p-2.5 rounded-lg flex-shrink-0">
          <FileText className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-800 text-sm group-hover:text-purple-600 transition-colors line-clamp-2 leading-snug">
            {rNote.title}
          </h4>
          <p className="text-xs text-gray-500 truncate mt-0.5">{rNote.subject}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
        <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-xs rounded-full">{rNote.department}</span>
        <span className="px-2 py-0.5 bg-purple-50 text-purple-600 text-xs rounded-full">Sem {rNote.semester}</span>
        <span className={`px-2 py-0.5 text-xs rounded-full ml-auto ${
          rNote._matchReason === 'Same Subject'
            ? 'bg-green-50 text-green-600'
            : 'bg-orange-50 text-orange-600'
        }`}>
          {rNote._matchReason === 'Same Subject' ? '📚 Same Subject' : '🏛️ Same Dept'}
        </span>
      </div>
      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
        <span className="flex items-center gap-1"><ThumbsUp className="w-3 h-3" />{rNote.upvotes || 0}</span>
        <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{rNote.views || 0}</span>
        <span className="flex items-center gap-1"><Download className="w-3 h-3" />{rNote.downloads || 0}</span>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Admin banner */}
        {isHidden && isAdmin && (
          <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-300 rounded-xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <ShieldAlert className="w-6 h-6 text-orange-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-orange-800">Admin View — File Under Review</p>
                <p className="text-sm text-orange-700">This file has been hidden after {note.reportCount || 5}+ reports.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleAdminRestore}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-colors"
              >✅ Restore File</button>
              <button onClick={handleAdminDelete} disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-60 flex items-center gap-1"
              >
                {deleting ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Preview */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {isHidden && !isAdmin ? (
                <div className="bg-gradient-to-br from-gray-50 to-orange-50 p-12 min-h-[500px] flex items-center justify-center">
                  <div className="max-w-lg w-full text-center">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-orange-300 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                      <div className="relative bg-white rounded-full w-36 h-36 flex items-center justify-center mx-auto shadow-2xl">
                        <ShieldAlert className="w-20 h-20 text-orange-500" />
                      </div>
                    </div>
                    <div className="mb-6">
                      <h2 className="text-2xl font-bold text-gray-800 mb-3">File Under Review</h2>
                      <p className="text-gray-600 mb-2">This file has been reported and is under admin review.</p>
                      <p className="text-gray-500 text-sm">If valid, it will be restored shortly.</p>
                    </div>
                    <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-5 text-left">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="font-semibold text-orange-800 mb-1">Why is this hidden?</p>
                          <p className="text-sm text-orange-700">Files are hidden when 5+ users report them. Admins will review and restore or remove it.</p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
                      <Flag className="w-4 h-4 text-red-400" />
                      <span>{note.reportCount || 5}+ reports received</span>
                    </div>
                  </div>
                </div>

              ) : isPDF ? (
                <div className="relative bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-12 min-h-[600px] flex items-center justify-center">
                  <div className="max-w-lg w-full text-center">
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-purple-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                      <div className="relative bg-white rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-2xl">
                        <FileText className="w-20 h-20 text-purple-600" />
                      </div>
                    </div>
                    <div className="mb-8">
                      <h2 className="text-3xl font-bold text-gray-800 mb-3">{note.title}</h2>
                      <p className="text-xl text-gray-600 mb-2">{note.subject}</p>
                      <div className="flex items-center justify-center gap-3 text-sm text-gray-500 flex-wrap">
                        <span className="px-3 py-1 bg-white rounded-full shadow-sm">📄 PDF Document</span>
                        <span className="px-3 py-1 bg-white rounded-full shadow-sm">💾 {(note.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                        {note.professor && <span className="px-3 py-1 bg-white rounded-full shadow-sm">👨‍🏫 {note.professor}</span>}
                      </div>
                    </div>
                    <div className="mb-8 space-y-3">
                      <button onClick={() => setShowPreview(true)}
                        className="w-full bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 text-white px-8 py-6 rounded-2xl font-bold hover:shadow-2xl flex items-center justify-center gap-3 text-xl shadow-xl transition-all transform hover:scale-105"
                      ><Eye className="w-7 h-7" /> Preview PDF</button>
                      <button onClick={handleDownload} disabled={downloading}
                        className="w-full bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 text-white px-8 py-6 rounded-2xl font-bold hover:shadow-2xl flex items-center justify-center gap-3 text-xl shadow-xl transition-all transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed"
                      >
                        <Download className={`w-7 h-7 ${downloading ? 'animate-bounce' : ''}`} />
                        {downloading ? 'Downloading...' : 'Download PDF'}
                      </button>
                    </div>
                    <div className="bg-white bg-opacity-60 rounded-xl p-6 border border-white shadow-lg">
                      <div className="flex items-start gap-3 text-left">
                        <div className="bg-blue-100 rounded-full p-2 mt-0.5 flex-shrink-0">
                          <Eye className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">Preview Before Download</h4>
                          <p className="text-sm text-gray-600">Click "Preview PDF" to view in browser, or "Download PDF" to save for offline access.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              ) : (
                <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-12 min-h-[600px] flex items-center justify-center">
                  <div className="max-w-lg w-full text-center">
                    <div className="bg-white rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-2xl mb-8">
                      <FileText className="w-20 h-20 text-gray-400" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-800 mb-3">{note.title}</h2>
                    <p className="text-xl text-gray-600 mb-4">{note.subject}</p>
                    <p className="text-gray-500 mb-8">This file type doesn't support inline preview</p>
                    <button onClick={handleDownload} disabled={downloading}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-6 rounded-2xl font-bold hover:shadow-2xl flex items-center justify-center gap-3 text-xl shadow-xl transition-all transform hover:scale-105 disabled:opacity-70"
                    >
                      <Download className={`w-7 h-7 ${downloading ? 'animate-bounce' : ''}`} />
                      {downloading ? 'Downloading...' : 'Download File'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* ── RELATED NOTES ── */}
            {relatedNotes.length > 0 && (
              <div className="mt-6">
                <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                  🔗 You Might Also Like
                  <span className="text-sm font-normal text-gray-500">
                    — based on {note.subject}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {relatedNotes.map(rNote => (
                    <RelatedNoteCard key={rNote.id} rNote={rNote} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Details */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
              {isAdmin && (
                <div className="mb-5 pb-5 border-b-2 border-dashed border-red-200">
                  <p className="text-xs font-bold text-red-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3" /> Admin Actions
                  </p>
                  <div className="flex gap-2">
                    {isHidden && (
                      <button onClick={handleAdminRestore}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-300 rounded-lg hover:bg-green-100 text-sm font-semibold transition-colors"
                      >✅ Restore</button>
                    )}
                    <button onClick={handleAdminDelete} disabled={deleting}
                      className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-50 text-red-600 border border-red-300 rounded-lg hover:bg-red-100 text-sm font-semibold transition-colors disabled:opacity-60"
                    >
                      {deleting ? <Loader className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      {deleting ? 'Deleting...' : 'Delete Note'}
                    </button>
                  </div>
                </div>
              )}

              <h1 className="text-2xl font-bold text-gray-800 mb-2">{note.title}</h1>
              <p className="text-lg text-gray-600 mb-4">{note.subject}</p>

              {isHidden && (
                <div className="mb-4 px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500 flex-shrink-0" />
                  <p className="text-sm text-orange-700 font-medium">Under admin review</p>
                </div>
              )}

              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">{note.department}</span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">Sem {note.semester}</span>
                {note.tags?.map((tag, i) => (
                  <span key={i} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{tag}</span>
                ))}
              </div>

              {note.description && (
                <div className="mb-4 pb-4 border-b">
                  <h3 className="font-semibold text-gray-800 mb-2">Description</h3>
                  <p className="text-gray-600 text-sm">{note.description}</p>
                </div>
              )}

              <div className="mb-4 pb-4 border-b">
                <h3 className="font-semibold text-gray-800 mb-2">Uploaded By</h3>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {note.uploaderName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{note.uploaderName}</p>
                    <p className="text-sm text-gray-500">{note.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}</p>
                  </div>
                </div>
                {note.professor && (
                  <p className="text-sm text-gray-600 mt-2"><strong>Professor:</strong> {note.professor}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="text-center p-3 rounded-lg">
                  <Eye className="w-5 h-5 text-gray-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{note.views || 0}</p>
                  <p className="text-xs text-gray-600">Views</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <ThumbsUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{note.upvotes || 0}</p>
                  <p className="text-xs text-gray-600">Upvotes</p>
                </div>
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <Download className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-800">{note.downloads || 0}</p>
                  <p className="text-xs text-gray-600">Downloads</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={() => handleVote('upvote')} disabled={isHidden && !isAdmin}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                    userVote === 'upvote' ? 'bg-green-500 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                ><ThumbsUp className="w-5 h-5" /> Upvote</button>
                <button onClick={() => handleVote('downvote')} disabled={isHidden && !isAdmin}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                    userVote === 'downvote' ? 'bg-red-500 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                ><ThumbsDown className="w-5 h-5" /> Downvote</button>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <button onClick={handleBookmark}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isBookmarked ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                ><Bookmark className="w-4 h-4" />{isBookmarked ? 'Saved' : 'Save'}</button>
                <button onClick={handleShare}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                ><Share2 className="w-4 h-4" /> Share</button>
              </div>

              {!isHidden && (
                <ReportButton noteId={noteId} noteTitle={note.title} reportedBy={note.reportedBy || []} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-600 to-blue-600">
              <div className="flex items-center gap-3">
                <FileText className="w-6 h-6 text-white" />
                <div>
                  <h3 className="text-lg font-bold text-white">{note.title}</h3>
                  <p className="text-sm text-white opacity-90">{note.subject}</p>
                </div>
              </div>
              <button onClick={() => setShowPreview(false)}
                className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
              ><X className="w-6 h-6 text-white" /></button>
            </div>
            <div className="flex-1 overflow-hidden">
              <iframe src={note.fileURL} className="w-full h-full" title={note.title} />
            </div>
            <div className="p-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{(note.fileSize / 1024 / 1024).toFixed(2)} MB</span> • PDF
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowPreview(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
                >Close</button>
                <button onClick={handleDownload} disabled={downloading}
                  className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:shadow-lg font-medium flex items-center gap-2 disabled:opacity-70"
                >
                  <Download className="w-4 h-4" />
                  {downloading ? 'Downloading...' : 'Download'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default NoteDetail;