import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { FileText, ThumbsUp, Eye, Download, Filter } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

const DepartmentPage = () => {
  const { deptCode: encodedDeptCode } = useParams();
const deptCode = decodeURIComponent(encodedDeptCode);
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSemester, setSelectedSemester] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const departmentNames = {
    'CSE': 'Computer Science & Engineering',
    'ECE': 'Electronics & Communication Engineering',
    'MECH': 'Mechanical Engineering',
    'CIVIL': 'Civil Engineering',
    'EEE': 'Electrical & Electronics Engineering',
    'AI/ML': 'Artificial Intelligence & Machine Learning',
    'ISE': 'Information Science & Engineering',
    'DS': 'Data Science',
    'RA': 'Robotics & Automation'
  };

  useEffect(() => {
    fetchDepartmentNotes();
  }, [deptCode, selectedSemester, sortBy]);

  const fetchDepartmentNotes = async () => {
    setLoading(true);
    try {
      let notesQuery = query(
        collection(db, 'notes'),
        where('department', '==', deptCode)
      );

      const snapshot = await getDocs(notesQuery);
      let notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Filter by semester
      if (selectedSemester !== 'all') {
        notesData = notesData.filter(note => note.semester === parseInt(selectedSemester));
      }

      // Sort
      if (sortBy === 'recent') {
        notesData.sort((a, b) => b.createdAt?.toDate?.() - a.createdAt?.toDate?.());
      } else if (sortBy === 'upvoted') {
        notesData.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      } else if (sortBy === 'downloaded') {
        notesData.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      }

      setNotes(notesData);
    } catch (error) {
      console.error('Error fetching department notes:', error);
    } finally {
      setLoading(false);
    }
  };

  const NoteCard = ({ note }) => (
    <div
      onClick={() => navigate(`/notes/${note.id}`)}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all p-5 cursor-pointer group"
    >
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
        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
          Sem {note.semester}
        </span>
        {note.tags?.slice(0, 2).map((tag, index) => (
          <span
            key={index}
            className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded-full"
          >
            {tag}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1">
            <ThumbsUp className="w-4 h-4" />
            {note.upvotes || 0}
          </span>
          <span className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            {note.views || 0}
          </span>
          <span className="flex items-center gap-1">
            <Download className="w-4 h-4" />
            {note.downloads || 0}
          </span>
        </div>
      </div>
    </div>
  );

  // Group notes by semester
  const notesBySemester = {};
  notes.forEach(note => {
    const sem = note.semester || 'Other';
    if (!notesBySemester[sem]) {
      notesBySemester[sem] = [];
    }
    notesBySemester[sem].push(note);
  });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            {departmentNames[deptCode] || deptCode}
          </h1>
          <p className="text-gray-600">
            Study materials for {deptCode} students
          </p>
        </div>

        {/* Filters & Stats */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Semester
                </label>
                <select
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="all">All Semesters</option>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="recent">Most Recent</option>
                  <option value="upvoted">Most Upvoted</option>
                  <option value="downloaded">Most Downloaded</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-800">{notes.length}</p>
                <p className="text-sm text-gray-600">Total Notes</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">
                  {notes.reduce((sum, n) => sum + (n.upvotes || 0), 0)}
                </p>
                <p className="text-sm text-gray-600">Upvotes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading notes...</p>
          </div>
        ) : notes.length > 0 ? (
          selectedSemester === 'all' ? (
            // Grouped by semester
            <div className="space-y-8">
              {Object.keys(notesBySemester).sort().map(sem => (
                <div key={sem}>
                  <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Semester {sem}
                    <span className="text-lg font-normal text-gray-600 ml-2">
                      ({notesBySemester[sem].length} notes)
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {notesBySemester[sem].map(note => (
                      <NoteCard key={note.id} note={note} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // Simple grid for filtered semester
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {notes.map(note => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          )
        ) : (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-800 mb-2">
              No notes found
            </h3>
            <p className="text-gray-600 mb-6">
              Be the first to upload notes for this {selectedSemester !== 'all' ? `semester in ${deptCode}` : 'department'}!
            </p>
            <button
              onClick={() => navigate('/dashboard/upload')}
              className="w-full bg-gradient-to-r from-purple-600 to-teal-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg">
              Upload Notes
            </button>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default DepartmentPage;