import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Star, FileText, ThumbsUp, Eye, Download } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

const MostUpvoted = () => {
  const navigate = useNavigate();
  const [topNotes, setTopNotes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopNotes();
  }, []);

  const fetchTopNotes = async () => {
    try {
      const notesQuery = query(
        collection(db, 'notes'),
        orderBy('upvotes', 'desc'),
        limit(50)
      );
      const snapshot = await getDocs(notesQuery);
      const notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTopNotes(notesData);
    } catch (error) {
      console.error('Error fetching top notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const NoteCard = ({ note, rank }) => (
    <div
      onClick={() => navigate(`/notes/${note.id}`)}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all p-5 cursor-pointer group relative"
    >
      {/* Rank Badge */}
      {rank <= 3 && (
        <div className={`absolute -top-2 -right-2 w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
          rank === 1 ? 'bg-yellow-500' :
          rank === 2 ? 'bg-gray-400' :
          'bg-orange-600'
        }`}>
          #{rank}
        </div>
      )}

      <div className="flex items-start gap-3 mb-3">
        <div className="bg-gradient-to-br from-purple-500 to-blue-500 p-3 rounded-lg">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-800 group-hover:text-purple-600 transition-colors">
            {note.title}
          </h3>
          <p className="text-sm text-gray-600">{note.subject}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          {note.department}
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
          Sem {note.semester}
        </span>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1 text-green-600 font-semibold">
            <ThumbsUp className="w-4 h-4" />
            {note.upvotes || 0}
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <Eye className="w-4 h-4" />
            {note.views || 0}
          </span>
          <span className="flex items-center gap-1 text-gray-500">
            <Download className="w-4 h-4" />
            {note.downloads || 0}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Star className="w-8 h-8 text-yellow-500 fill-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-800">Most Upvoted Notes</h1>
          </div>
          <p className="text-gray-600">
            Top-rated study materials as voted by students
          </p>
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
              {topNotes.reduce((sum, note) => sum + (note.upvotes || 0), 0)}
            </p>
          </div>
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <p className="text-sm text-blue-700 mb-1">Total Downloads</p>
            <p className="text-3xl font-bold text-blue-800">
              {topNotes.reduce((sum, note) => sum + (note.downloads || 0), 0)}
            </p>
          </div>
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
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No upvoted notes yet
            </h3>
            <p className="text-gray-600">
              Be the first to upvote quality study materials!
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default MostUpvoted;