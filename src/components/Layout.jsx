import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  BookOpen, Rocket, Search, Upload, Home, Star, Clock, 
  Download, Cloud, LogOut, Menu, X, User, Settings,
  Laptop, Cpu, Cog, Building, Zap, Brain, Database, Bot, FileText, Heart 
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [profileOpen, setProfileOpen] = useState(false);
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const departments = [
    { name: 'Computer Science', code: 'CSE', icon: Laptop, color: 'text-teal-500' },
    { name: 'Electronics', code: 'ECE', icon: Cpu, color: 'text-orange-500' },
    { name: 'Mechanical', code: 'MECH', icon: Cog, color: 'text-gray-500' },
    { name: 'Civil', code: 'CIVIL', icon: Building, color: 'text-yellow-700' },
    { name: 'Electrical', code: 'EEE', icon: Zap, color: 'text-yellow-500' },
    { name: 'AI & ML', code: 'AI/ML', icon: Brain, color: 'text-purple-500' },
    { name: 'Information Science', code: 'ISE', icon: FileText, color: 'text-pink-500' },
    { name: 'Data Science', code: 'DS', icon: Database, color: 'text-indigo-500' },
    { name: 'Robotics', code: 'RA', icon: Bot, color: 'text-teal-500' },
  ];

  const quickLinks = [
    { name: 'All Notes', path: '/dashboard', icon: BookOpen },
    { name: 'Most Upvoted', path: '/dashboard/upvoted', icon: Star },
    { name: 'Recently Added', path: '/dashboard/recent', icon: Clock },
    { name: 'My Downloads', path: '/dashboard/downloads', icon: Download },
    { name: 'My Uploads', path: '/dashboard/uploads', icon: Cloud },
    { name: 'My Bookmarks', path: '/dashboard/bookmarks', icon: Heart },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-transparent">
      {/* Top Navigation Bar */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4">
          <div className="flex justify-between items-center h-16">
            {/* Left: Logo & Menu Toggle */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 rounded-lg hover:bg-gray-100 lg:hidden"
              >
                {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
              
              <Link to="/dashboard" className="flex items-center space-x-2">
                <div className="bg-gradient-to-r from-purple-600 to-teal-500 p-2 rounded-lg">
                  <BookOpen className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-800 flex items-center gap-1">
                    Get Notes <Rocket className="w-5 h-5 text-purple-600" />
                  </h1>
                  <p className="text-xs text-gray-500">GNDEC Bidar</p>
                </div>
              </Link>
            </div>

            {/* Center: Search Bar */}
            <div className="hidden md:flex flex-1 max-w-2xl mx-8">
              <div className="relative w-full">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search notes by subject, department, or professor..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.target.value.trim()) {
                      navigate(`/dashboard/search?q=${encodeURIComponent(e.target.value)}`);
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

            {/* Right: Upload & Profile */}
            <div className="flex items-center space-x-3">
              <Link
                to="/dashboard/upload"
                className="hidden md:flex items-center gap-2 bg-gradient-to-r from-purple-600 to-teal-500 text-white px-4 py-2 rounded-lg font-medium hover:shadow-lg transform hover:scale-105 transition-all"
              >
                <Upload className="w-4 h-4" />
                Upload Notes
              </Link>

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center space-x-2 p-2 rounded-lg hover:bg-gray-100"
                >
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold">
                    {userProfile?.name?.charAt(0) || 'U'}
                  </div>
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <p className="font-semibold text-gray-800">{userProfile?.name}</p>
                      <p className="text-sm text-gray-500">{userProfile?.department} • {userProfile?.year}</p>
                      <p className="text-xs text-gray-400 mt-1">{currentUser?.email}</p>
                    </div>
                    <Link
                      to="/dashboard/profile"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                      onClick={() => setProfileOpen(false)}
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      to="/dashboard/settings"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-600"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 mt-16 lg:mt-0`}
        >
          <div className="h-full overflow-y-auto py-6">
            {/* Quick Links */}
            <div className="px-4 mb-6">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Quick Links
              </h3>
              <div className="space-y-1">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <Link
                      key={link.path}
                      to={link.path}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        isActive(link.path)
                          ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow-md'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className="w-5 h-5" />
                      <span className="font-medium">{link.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Departments */}
            <div className="px-4">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Departments
              </h3>
              <div className="space-y-1">
                {departments.map((dept) => {
                  const Icon = dept.icon;
                  return (
                    <Link
                      key={dept.code}
                      to={`/dashboard/department/${encodeURIComponent(dept.code)}`}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon className={`w-5 h-5 ${dept.color}`} />
                      <div className="flex-1">
                        <span className="font-medium text-sm">{dept.code}</span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-6 lg:p-8 mt-16 lg:mt-0">
          {children}
        </main>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
};

export default Layout;