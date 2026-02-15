import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { 
  Download, ThumbsUp, ThumbsDown, Eye, Calendar, User, 
  FileText, Share2, Flag, Bookmark, ExternalLink 
} from 'lucide-react';
import { doc, getDoc, updateDoc, increment, addDoc, collection, query, where, getDocs, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import { saveFileOffline } from '../utils/offlineStorage';

const NoteDetail = () => {
  const { noteId } = useParams();
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userVote, setUserVote] = useState(null);
  const [isBookmarked, setIsBookmarked] = useState(false);

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
        setNote({ id: noteDoc.id, ...noteDoc.data() });
        
        // Increment view count
        await updateDoc(doc(db, 'notes', noteId), {
          views: increment(1)
        });
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

  const checkUserVote = async () => {
    try {
      const votesQuery = query(
        collection(db, 'votes'),
        where('userId', '==', currentUser.uid),
        where('noteId', '==', noteId)
      );
      const voteSnapshot = await getDocs(votesQuery);
      if (!voteSnapshot.empty) {
        setUserVote(voteSnapshot.docs[0].data().voteType);
      }
    } catch (error) {
      console.error('Error checking vote:', error);
    }
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
    } catch (error) {
      console.error('Error checking bookmark:', error);
    }
  };

  const handleVote = async (voteType) => {
    if (!currentUser) {
      toast.error('Please login to vote');
      return;
    }

    try {
      // Check if user already voted
      const votesQuery = query(
        collection(db, 'votes'),
        where('userId', '==', currentUser.uid),
        where('noteId', '==', noteId)
      );
      const voteSnapshot = await getDocs(votesQuery);

      if (!voteSnapshot.empty) {
        // User already voted
        const existingVote = voteSnapshot.docs[0];
        const existingVoteType = existingVote.data().voteType;

        if (existingVoteType === voteType) {
          // Remove vote
          await deleteDoc(existingVote.ref);
          await updateDoc(doc(db, 'notes', noteId), {
            [voteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(-1)
          });
          setUserVote(null);
          toast.info('Vote removed');
        } else {
          // Change vote
          await updateDoc(existingVote.ref, { voteType });
          await updateDoc(doc(db, 'notes', noteId), {
            [existingVoteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(-1),
            [voteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(1)
          });
          setUserVote(voteType);
          toast.success('Vote changed');
        }
      } else {
        // New vote
        await addDoc(collection(db, 'votes'), {
          userId: currentUser.uid,
          noteId: noteId,
          voteType: voteType,
          createdAt: new Date()
        });
        await updateDoc(doc(db, 'notes', noteId), {
          [voteType === 'upvote' ? 'upvotes' : 'downvotes']: increment(1)
        });
        setUserVote(voteType);
        toast.success(`${voteType === 'upvote' ? 'Upvoted' : 'Downvoted'}!`);
      }

      // Refresh note data
      fetchNoteDetails();
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Failed to vote');
    }
  };

  const handleDownload = async () => {
    if (!currentUser) {
      toast.error('Please login to download');
      return;
    }

    try {
      // Track download in downloads collection
      await addDoc(collection(db, 'downloads'), {
        userId: currentUser.uid,
        noteId: noteId,
        downloadedAt: serverTimestamp()
      });

      // Increment download count
      await updateDoc(doc(db, 'notes', noteId), {
        downloads: increment(1)
      });

      toast.info('⏳ Preparing download and saving for offline access...');
      
      try {
        // Fetch the file
        const response = await fetch(note.fileURL);
        const blob = await response.blob();
        
        // Save to IndexedDB for offline access
        try {
          await saveFileOffline(noteId, blob, {
            title: note.title,
            subject: note.subject,
            department: note.department,
            semester: note.semester,
            fileSize: note.fileSize,
            fileType: note.fileType,
            uploaderName: note.uploaderName
          });
          console.log('✅ File saved for offline access');
        } catch (offlineError) {
          console.error('❌ Failed to save for offline:', offlineError);
          // Continue with download even if offline save fails
        }
        
        // Trigger download
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${note.title}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success('✅ Downloaded and saved for offline access!');
      } catch (fetchError) {
        console.error('Fetch download failed:', fetchError);
        // Fallback
        window.open(note.fileURL, '_blank');
        toast.success('File opened in new tab!');
      }
      
      // Refresh note data
      fetchNoteDetails();
    } catch (error) {
      console.error('Error downloading:', error);
      window.open(note.fileURL, '_blank');
      toast.warning('Download started (tracking failed)');
    }
  };

  const handleBookmark = async () => {
    if (!currentUser) {
      toast.error('Please login to bookmark');
      return;
    }

    try {
      const bookmarksQuery = query(
        collection(db, 'bookmarks'),
        where('userId', '==', currentUser.uid),
        where('noteId', '==', noteId)
      );
      const bookmarkSnapshot = await getDocs(bookmarksQuery);

      if (!bookmarkSnapshot.empty) {
        // Remove bookmark
        await deleteDoc(bookmarkSnapshot.docs[0].ref);
        setIsBookmarked(false);
        toast.info('Bookmark removed');
      } else {
        // Add bookmark
        await addDoc(collection(db, 'bookmarks'), {
          userId: currentUser.uid,
          noteId: noteId,
          createdAt: new Date()
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
    const shareText = `Check out this note: ${note.title} - ${note.subject}`;

    // Check if Web Share API is supported (mostly on mobile)
    if (navigator.share) {
      try {
        await navigator.share({
          title: note.title,
          text: shareText,
          url: shareUrl,
        });
        toast.success('Shared successfully!');
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fallback to copy link
          copyToClipboard(shareUrl);
        }
      }
    } else {
      // Fallback: Copy link to clipboard
      copyToClipboard(shareUrl);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('📋 Link copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        toast.success('📋 Link copied to clipboard!');
      } catch (err) {
        toast.error('Failed to copy link');
      }
      document.body.removeChild(textArea);
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
        <div className="text-center py-12">
          <p className="text-gray-600">Note not found</p>
        </div>
      </Layout>
    );
  }

  const isPDF = note.fileType === 'application/pdf';

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Preview/Download Area */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              {isPDF ? (
                <div className="relative bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 p-12 min-h-[600px] flex items-center justify-center">
                  <div className="max-w-lg w-full text-center">
                    {/* PDF Icon with Animation */}
                    <div className="relative mb-8">
                      <div className="absolute inset-0 bg-purple-400 rounded-full blur-2xl opacity-20 animate-pulse"></div>
                      <div className="relative bg-white rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-2xl">
                        <FileText className="w-20 h-20 text-purple-600" />
                      </div>
                    </div>
                    
                    {/* File Info */}
                    <div className="mb-8">
                      <h2 className="text-3xl font-bold text-gray-800 mb-3">
                        {note.title}
                      </h2>
                      <p className="text-xl text-gray-600 mb-2">{note.subject}</p>
                      <div className="flex items-center justify-center gap-3 text-sm text-gray-500 flex-wrap">
                        <span className="px-3 py-1 bg-white rounded-full shadow-sm">
                          📄 PDF Document
                        </span>
                        <span className="px-3 py-1 bg-white rounded-full shadow-sm">
                          💾 {(note.fileSize / 1024 / 1024).toFixed(2)} MB
                        </span>
                        {note.professor && (
                          <span className="px-3 py-1 bg-white rounded-full shadow-sm">
                            👨‍🏫 {note.professor}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    {/* Action Button - Single Download */}
                    <div className="mb-8">
                      <button
                        onClick={handleDownload}
                        className="w-full bg-gradient-to-r from-purple-600 via-purple-700 to-blue-600 text-white px-8 py-6 rounded-2xl font-bold hover:shadow-2xl flex items-center justify-center gap-3 text-xl shadow-xl transition-all transform hover:scale-105 active:scale-100"
                      >
                        <Download className="w-7 h-7" />
                        Download PDF
                      </button>
                      <p className="text-sm text-gray-600 text-center mt-4">
                        📥 Click to download • {(note.fileSize / 1024 / 1024).toFixed(2)} MB • Opens in your default PDF viewer
                      </p>
                    </div>
                    
                    {/* Helper Text */}
                    <div className="bg-white bg-opacity-60 backdrop-blur-sm rounded-xl p-6 border border-white shadow-lg">
                      <div className="flex items-start gap-3 text-left">
                        <div className="bg-purple-100 rounded-full p-2 mt-1">
                          <Download className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-800 mb-1">How to Access</h4>
                          <p className="text-sm text-gray-600">
                            Click the <strong>Download PDF</strong> button to save the file to your device. 
                            Once downloaded, you can open it with any PDF reader application for viewing, 
                            printing, or offline access.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                // Non-PDF files
                <div className="relative bg-gradient-to-br from-gray-50 to-gray-100 p-12 min-h-[600px] flex items-center justify-center">
                  <div className="max-w-lg w-full text-center">
                    {/* File Icon */}
                    <div className="relative mb-8">
                      <div className="bg-white rounded-full w-40 h-40 flex items-center justify-center mx-auto shadow-2xl">
                        <FileText className="w-20 h-20 text-gray-400" />
                      </div>
                    </div>
                    
                    {/* File Info */}
                    <div className="mb-8">
                      <h2 className="text-3xl font-bold text-gray-800 mb-3">
                        {note.title}
                      </h2>
                      <p className="text-xl text-gray-600 mb-4">{note.subject}</p>
                      <p className="text-gray-500">
                        This file type doesn't support inline preview
                      </p>
                    </div>
                    
                    {/* Action Button */}
                    <div className="mb-8">
                      <button
                        onClick={handleDownload}
                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-6 rounded-2xl font-bold hover:shadow-2xl flex items-center justify-center gap-3 text-xl shadow-xl transition-all transform hover:scale-105"
                      >
                        <Download className="w-7 h-7" />
                        Download File
                      </button>
                      <p className="text-sm text-gray-600 text-center mt-4">
                        📥 Click to download this file
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Details & Actions */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-md p-6 sticky top-6">
              {/* Title */}
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {note.title}
              </h1>
              <p className="text-lg text-gray-600 mb-4">{note.subject}</p>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                  {note.department}
                </span>
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                  Sem {note.semester}
                </span>
                {note.tags?.map((tag, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              {/* Description */}
              {note.description && (
                <div className="mb-4 pb-4 border-b">
                  <h3 className="font-semibold text-gray-800 mb-2">Description</h3>
                  <p className="text-gray-600 text-sm">{note.description}</p>
                </div>
              )}

              {/* Uploader Info */}
              <div className="mb-4 pb-4 border-b">
                <h3 className="font-semibold text-gray-800 mb-2">Uploaded By</h3>
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                    {note.uploaderName?.charAt(0) || 'U'}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800">{note.uploaderName}</p>
                    <p className="text-sm text-gray-500">
                      {note.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
                    </p>
                  </div>
                </div>
                {note.professor && (
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Professor:</strong> {note.professor}
                  </p>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
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

              {/* Vote Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={() => handleVote('upvote')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                    userVote === 'upvote'
                      ? 'bg-green-500 text-white'
                      : 'bg-green-50 text-green-700 hover:bg-green-100'
                  }`}
                >
                  <ThumbsUp className="w-5 h-5" />
                  Upvote
                </button>
                <button
                  onClick={() => handleVote('downvote')}
                  className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-semibold transition-all ${
                    userVote === 'downvote'
                      ? 'bg-red-500 text-white'
                      : 'bg-red-50 text-red-700 hover:bg-red-100'
                  }`}
                >
                  <ThumbsDown className="w-5 h-5" />
                  Downvote
                </button>
              </div>

              {/* Secondary Actions */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  onClick={handleBookmark}
                  className={`flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                    isBookmarked
                      ? 'bg-yellow-500 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                  {isBookmarked ? 'Saved' : 'Save'}
                </button>
                <button 
                  onClick={handleShare}
                  className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>

              {/* Report Button */}
              <button className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-red-600 mt-3">
                <Flag className="w-4 h-4" />
                Report inappropriate content
              </button>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default NoteDetail;