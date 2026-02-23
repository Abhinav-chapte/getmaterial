import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Search, Filter, X, FileText, ThumbsUp, Eye, Download } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';

const SearchResults = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    department: searchParams.get('dept') || '',
    semester: searchParams.get('sem') || '',
    sortBy: 'recent'
  });
  const [showFilters, setShowFilters] = useState(false);

  const departments = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AI/ML', 'ISE', 'DS', 'RA'];
  const semesters = [1, 2, 3, 4, 5, 6, 7, 8];

  useEffect(() => {
    if (searchQuery || filters.department || filters.semester) {
      performSearch();
    }
  }, [searchQuery, filters]);

  const performSearch = async () => {
    setLoading(true);
    try {
      let notesQuery = collection(db, 'notes');
      const constraints = [];

      // Apply filters
      if (filters.department) {
        constraints.push(where('department', '==', filters.department));
      }
      if (filters.semester) {
        constraints.push(where('semester', '==', parseInt(filters.semester)));
      }

      // Create query
      if (constraints.length > 0) {
        notesQuery = query(notesQuery, ...constraints);
      } else {
        notesQuery = query(notesQuery);
      }

      const snapshot = await getDocs(notesQuery);
      let notesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Client-side search filtering (Firestore doesn't support full-text search)
      if (searchQuery) {
        const lowerQuery = searchQuery.toLowerCase();
        notesData = notesData.filter(note =>
          note.title?.toLowerCase().includes(lowerQuery) ||
          note.subject?.toLowerCase().includes(lowerQuery) ||
          note.description?.toLowerCase().includes(lowerQuery) ||
          note.professor?.toLowerCase().includes(lowerQuery) ||
          note.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
        );
      }

      // Sort results
      if (filters.sortBy === 'recent') {
        notesData.sort((a, b) => b.createdAt?.toDate?.() - a.createdAt?.toDate?.());
      } else if (filters.sortBy === 'upvoted') {
        notesData.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
      } else if (filters.sortBy === 'downloaded') {
        notesData.sort((a, b) => (b.downloads || 0) - (a.downloads || 0));
      }

      setResults(notesData);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (filters.department) params.set('dept', filters.department);
    if (filters.semester) params.set('sem', filters.semester);
    setSearchParams(params);
    performSearch();
  };

  const clearFilters = () => {
    setFilters({
      department: '',
      semester: '',
      sortBy: 'recent'
    });
    setSearchParams({});
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
        <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full">
          {note.department}
        </span>
        <span className="px-3 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
          Sem {note.semester}
        </span>
      </div>

      {note.description && (
        <p className="text-sm text-gray-600 mb-3 line-clamp-2">{note.description}</p>
      )}

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
        <span className="text-xs">
          {note.createdAt?.toDate?.()?.toLocaleDateString() || 'Recently'}
        </span>
      </div>
    </div>
  );

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Search Header */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes by subject, department, or professor..."
                className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
            >
              <Filter className="w-5 h-5" />
              Filters
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-gradient-to-r via-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg"
            >
              Search
            </button>
          </form>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={filters.department}
                  onChange={(e) => setFilters({ ...filters, department: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Semester
                </label>
                <select
                  value={filters.semester}
                  onChange={(e) => setFilters({ ...filters, semester: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">All Semesters</option>
                  {semesters.map(sem => (
                    <option key={sem} value={sem}>Semester {sem}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sort By
                </label>
                <select
                  value={filters.sortBy}
                  onChange={(e) => setFilters({ ...filters, sortBy: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="recent">Most Recent</option>
                  <option value="upvoted">Most Upvoted</option>
                  <option value="downloaded">Most Downloaded</option>
                </select>
              </div>
            </div>
          )}

          {/* Active Filters */}
          {(filters.department || filters.semester) && (
            <div className="mt-4 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-600">Active filters:</span>
              {filters.department && (
                <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full flex items-center gap-1">
                  {filters.department}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setFilters({ ...filters, department: '' })}
                  />
                </span>
              )}
              {filters.semester && (
                <span className="px-3 py-1 bg-purple-100 text-purple-700 text-sm rounded-full flex items-center gap-1">
                  Semester {filters.semester}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => setFilters({ ...filters, semester: '' })}
                  />
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-red-600 hover:text-red-700 font-medium"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* Results */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800">
              {searchQuery && `Showing results for "${searchQuery}"`}
              {!searchQuery && (filters.department || filters.semester) && 'Filtered Results'}
              {!searchQuery && !filters.department && !filters.semester && 'All Notes'}
            </h2>
            <p className="text-gray-600">
              Found <strong>{results.length}</strong> notes
            </p>
          </div>

          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Searching...</p>
            </div>
          ) : results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.map(note => (
                <NoteCard key={note.id} note={note} />
              ))}
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-md p-12 text-center">
              <Search className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                No results found
              </h3>
              <p className="text-gray-600 mb-4">
                Try adjusting your search or filters
              </p>
              <button
                onClick={clearFilters}
                className="text-purple-600 hover:text-purple-700 font-semibold"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default SearchResults;