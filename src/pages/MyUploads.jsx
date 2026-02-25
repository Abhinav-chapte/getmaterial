import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Layout from '../components/Layout';
import { FileText, Edit, Trash2, Eye, ThumbsUp, Download, Upload } from 'lucide-react';
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';

// Note Card Component (moved outside to prevent re-renders)
const NoteCard = ({ note, onEdit, onDelete, onSave, onCancel, editingNoteId, editForm, onInputChange, onTagToggle, tagOptions, navigate }) => {
  const isEditing = editingNoteId === note.id;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
      {isEditing ? (
        // Edit Mode
        <div className="space-y-4" onClick={(e) => e.stopPropagation()}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => {
                e.stopPropagation();
                onInputChange('title', e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subject
            </label>
            <input
              type="text"
              value={editForm.subject}
              onChange={(e) => {
                e.stopPropagation();
                onInputChange('subject', e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={editForm.description}
              onChange={(e) => {
                e.stopPropagation();
                onInputChange('description', e.target.value);
              }}
              onClick={(e) => e.stopPropagation()}
              rows="3"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tags
            </label>
            <div className="flex flex-wrap gap-2">
              {tagOptions.map(tag => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagToggle(tag);
                  }}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-all ${
                    editForm.tags.includes(tag)
                      ? 'bg-gradient-to-r via-purple-600 to-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSave(note.id);
              }}
              className="flex-1 bg-green-500 text-white px-4 py-2 rounded-lg font-semibold hover:bg-green-600 transition-colors"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        // View Mode - keep as is
        <>
          <div className="flex items-start gap-4 mb-4">
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
            {note.tags?.map((tag, index) => (
              <span
                key={index}
                className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>

          {note.description && (
            <p className="text-sm text-gray-600 mb-4">{note.description}</p>
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
            <span>Uploaded: {note.createdAt?.toDate?.()?.toLocaleDateString()}</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() => navigate(`/notes/${note.id}`)}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 font-medium transition-colors"
            >
              <Eye className="w-4 h-4" />
              View
            </button>
            <button
              onClick={() => onEdit(note)}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 font-medium transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
            <button
              onClick={() => onDelete(note.id, note.title)}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 font-medium transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const MyUploads = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [myNotes, setMyNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState(null);
  const [editForm, setEditForm] = useState({
    title: '',
    subject: '',
    description: '',
    tags: []
  });

  const tagOptions = ['Exam Prep', 'Assignment', 'Class Notes', 'Lab Manual', 'Previous Year Papers'];

  useEffect(() => {
    fetchMyUploads();
  }, [currentUser]);

  const fetchMyUploads = async () => {
    try {
      const notesQuery = query(
        collection(db, 'notes'),
        where('uploadedBy', '==', currentUser.uid)
      );
      const snapshot = await getDocs(notesQuery);
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by most recent
      notesData.sort((a, b) => b.createdAt?.toDate?.() - a.createdAt?.toDate?.());
      setMyNotes(notesData);
    } catch (error) {
      console.error('Error fetching uploads:', error);
      toast.error('Failed to load your uploads');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (noteId, noteTitle) => {
    if (!window.confirm(`Are you sure you want to delete "${noteTitle}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'notes', noteId));
      toast.success('Note deleted successfully');
      fetchMyUploads(); // Refresh list
    } catch (error) {
      console.error('Error deleting note:', error);
      toast.error('Failed to delete note');
    }
  };

  const handleEditClick = (note) => {
    setEditingNote(note.id);
    setEditForm({
      title: note.title,
      subject: note.subject,
      description: note.description || '',
      tags: note.tags || []
    });
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setEditForm({
      title: '',
      subject: '',
      description: '',
      tags: []
    });
  };

  const handleSaveEdit = async (noteId) => {
    try {
      await updateDoc(doc(db, 'notes', noteId), {
        title: editForm.title,
        subject: editForm.subject,
        description: editForm.description,
        tags: editForm.tags,
        updatedAt: new Date()
      });
      
      toast.success('Note updated successfully!');
      setEditingNote(null);
      fetchMyUploads(); // Refresh list
    } catch (error) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const handleTagToggle = useCallback((tag) => {
  setEditForm(prev => ({
    ...prev,
    tags: prev.tags.includes(tag)
      ? prev.tags.filter(t => t !== tag)
      : [...prev.tags, tag]
  }));
}, []);

const handleInputChange = useCallback((field, value) => {
  setEditForm(prev => ({
    ...prev,
    [field]: value
  }));
}, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">My Uploads</h1>
            <p className="text-gray-600">
              Manage your uploaded study materials
            </p>
          </div>
          <button
            onClick={() => navigate('/dashboard/upload')}
            className="flex items-center gap-2 bg-gradient-to-r via-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
          >
            <Upload className="w-5 h-5" />
            Upload New Note
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600 mb-1">Total Uploads</p>
            <p className="text-2xl font-bold text-gray-800">{myNotes.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600 mb-1">Total Views</p>
            <p className="text-2xl font-bold text-gray-800">
              {myNotes.reduce((sum, note) => sum + (note.views || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600 mb-1">Total Upvotes</p>
            <p className="text-2xl font-bold text-green-600">
              {myNotes.reduce((sum, note) => sum + (note.upvotes || 0), 0)}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-600 mb-1">Total Downloads</p>
            <p className="text-2xl font-bold text-blue-600">
              {myNotes.reduce((sum, note) => sum + (note.downloads || 0), 0)}
            </p>
          </div>
        </div>

        {/* Notes Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading your uploads...</p>
          </div>
        ) : myNotes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myNotes.map(note => (
  <NoteCard 
    key={note.id} 
    note={note}
    onEdit={handleEditClick}
    onDelete={handleDelete}
    onSave={handleSaveEdit}
    onCancel={handleCancelEdit}
    editingNoteId={editingNote}
    editForm={editForm}
    onInputChange={handleInputChange}
    onTagToggle={handleTagToggle}
    tagOptions={tagOptions}
    navigate={navigate}
  />
))}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <Upload className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No uploads yet
            </h3>
            <p className="text-gray-600 mb-6">
              Start sharing your study materials with fellow students!
            </p>
            <button
              onClick={() => navigate('/dashboard/upload')}
              className="bg-gradient-to-r via-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
            >
              Upload Your First Note
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MyUploads;