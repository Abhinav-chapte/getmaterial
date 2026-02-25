import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AuthPage from './pages/AuthPage';
import Dashboard from './pages/Dashboard';
import UploadNotes from './pages/UploadNotes';
import NoteDetail from './pages/NoteDetail';
import SearchResults from './pages/SearchResults';
import MyUploads from './pages/MyUploads';
import MostUpvoted from './pages/MostUpvoted';
import RecentlyAdded from './pages/RecentlyAdded';
import MyDownloads from './pages/MyDownloads';
import MyBookmarks from './pages/MyBookmarks';
import DepartmentPage from './pages/DepartmentPage';
import UserProfile from './pages/UserProfile';
import Settings from './pages/Settings';
import AdminRoute from './components/admin/AdminRoute';
import AdminPanel from './pages/admin/AdminPanel';
import ReportsList from './pages/admin/ReportsList';
import ManageAdmins from './pages/admin/ManageAdmins';

function App() {
  const { currentUser } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={currentUser ? <Navigate to="/dashboard" /> : <AuthPage />}
      />
      <Route
        path="/dashboard"
        element={currentUser ? <Dashboard /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/upload"
        element={currentUser ? <UploadNotes /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/search"
        element={currentUser ? <SearchResults /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/uploads"
        element={currentUser ? <MyUploads /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/upvoted"
        element={currentUser ? <MostUpvoted /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/recent"
        element={currentUser ? <RecentlyAdded /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/downloads"
        element={currentUser ? <MyDownloads /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/bookmarks"
        element={currentUser ? <MyBookmarks /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/profile"
        element={currentUser ? <UserProfile /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/department/:deptCode"
        element={currentUser ? <DepartmentPage /> : <Navigate to="/" />}
      />
      <Route
        path="/notes/:noteId"
        element={currentUser ? <NoteDetail /> : <Navigate to="/" />}
      />
      <Route
        path="/dashboard/settings"
        element={currentUser ? <Settings /> : <Navigate to="/" />}
      />

      {/* ── Admin Routes ── */}
      <Route
        path="/dashboard/admin"
        element={
          <AdminRoute>
            <AdminPanel />
          </AdminRoute>
        }
      />
      <Route
        path="/dashboard/admin/reports"
        element={
          <AdminRoute>
            <ReportsList />
          </AdminRoute>
        }
      />
      <Route
        path="/dashboard/admin/manage-admins"
        element={
          <AdminRoute>
            <ManageAdmins />
          </AdminRoute>
        }
      />
    </Routes>
  );
}

export default App;