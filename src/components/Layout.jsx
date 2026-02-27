import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import {
  BookOpen, Rocket, Search, Upload, Home, Star, Clock,
  Download, Cloud, LogOut, Menu, X, User, Settings,
  Laptop, Cpu, Cog, Building, Zap, Brain, Database, Bot, FileText, Heart, Shield
} from 'lucide-react';

const Layout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileSearch, setMobileSearch] = useState('');
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  const handleMobileSearch = (e) => {
    if (e.key === 'Enter' && mobileSearch.trim()) {
      navigate(`/dashboard/search?q=${encodeURIComponent(mobileSearch)}`);
      setMobileSearch('');
      setSidebarOpen(false);
    }
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

  const adminLinks = [
    { name: 'Admin Panel', path: '/dashboard/admin', icon: Shield },
  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-transparent">
      {/* ── Top Navigation Bar ── */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-full mx-auto px-4">
          <div className="flex justify-between items-center h-16">

            {/* Left: Hamburger + Logo */}
            <div className="flex items-center space-x-3">
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

            {/* Center: Search Bar — desktop only */}
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

            {/* Right: Upload button + Profile */}
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
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-2 z-50">
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
                      <User className="w-4 h-4" /> My Profile
                    </Link>
                    <Link
                      to="/dashboard/settings"
                      className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 text-gray-700"
                      onClick={() => setProfileOpen(false)}
                    >
                      <Settings className="w-4 h-4" /> Settings
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-4 py-2 hover:bg-red-50 text-red-600"
                    >
                      <LogOut className="w-4 h-4" /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Mobile Search Bar — shown below navbar on small screens only ── */}
        <div className="md:hidden px-4 pb-3">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              onKeyDown={handleMobileSearch}
              placeholder="Search notes, subjects, professors..."
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm bg-gray-50"
            />
            {/* Search button for touch users */}
            {mobileSearch.trim() && (
              <button
                onClick={() => {
                  navigate(`/dashboard/search?q=${encodeURIComponent(mobileSearch)}`);
                  setMobileSearch('');
                }}
                className="absolute right-2 top-1.5 bg-gradient-to-r from-purple-600 to-teal-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"
              >
                Search
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* ── Sidebar ── */}
        <aside
          className={`${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0`}
          style={{ top: 0, paddingTop: '0' }}
        >
          {/* Sidebar scroll area — offset for navbar height on mobile */}
          <div className="h-full overflow-y-auto py-6 pt-20 lg:pt-6">

            {/* Mobile: Upload button inside sidebar */}
            <div className="px-4 mb-5 lg:hidden">
              <Link
                to="/dashboard/upload"
                onClick={() => setSidebarOpen(false)}
                className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-purple-600 to-teal-500 text-white px-4 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Upload className="w-5 h-5" />
                Upload Notes
              </Link>
            </div>

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

            {/* Admin Links */}
            {(userProfile?.role === 'admin' || userProfile?.role === 'super_admin') && (
              <div className="px-4 mb-6">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                  Admin
                </h3>
                <div className="space-y-1">
                  {adminLinks.map((link) => {
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
            )}

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
                      <span className="font-medium text-sm">{dept.code}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-1 p-4 lg:p-8 min-w-0">
          {children}
        </main>
      </div>

      {/* Mobile Sidebar Overlay */}
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