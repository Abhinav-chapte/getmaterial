import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { Link } from 'react-router-dom';
import {
  Shield, Flag, Users, FileText,
  AlertTriangle, CheckCircle, Crown, ArrowRight, Loader, EyeOff
} from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

const AdminPanel = () => {
  const { currentUser, userProfile } = useAuth();
  const [stats, setStats] = useState({
    totalFiles: 0,
    pendingReports: 0,
    hiddenFiles: 0,
    totalAdmins: 0,
  });
  const [recentReports, setRecentReports] = useState([]);
  const [loading, setLoading] = useState(true);

  const isAdmin = ['admin', 'super_admin'].includes(userProfile?.role?.trim());
  const isSuperAdmin = userProfile?.role?.trim() === 'super_admin';

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      // Total files
      const filesSnap = await getDocs(collection(db, 'notes'));
      const totalFiles = filesSnap.size;

      // Hidden files
      const hiddenSnap = await getDocs(
        query(collection(db, 'notes'), where('status', '==', 'hidden'))
      );
      const hiddenFiles = hiddenSnap.size;

      // Pending reports
      const reportsSnap = await getDocs(
        query(collection(db, 'reports'), where('status', '==', 'pending'))
      );
      const pendingReports = reportsSnap.size;

      // Total admins
      const adminsSnap = await getDocs(
        query(collection(db, 'users'), where('role', 'in', ['admin', 'super_admin']))
      );
      const totalAdmins = adminsSnap.size;

      setStats({ totalFiles, pendingReports, hiddenFiles, totalAdmins });

      // Recent pending reports (latest 5, sorted client-side)
      const recent = reportsSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 5);
      setRecentReports(recent);

    } catch (error) {
      console.error('Error fetching admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <Loader className="animate-spin rounded-full h-12 w-12 text-purple-600 mx-auto" />
            <p className="text-gray-600 mt-4">Loading admin panel...</p>
          </div>
        </div>
      </Layout>
    );
  }

  const statCards = [
    {
      icon: FileText,
      label: 'Total Files',
      value: stats.totalFiles,
      iconColor: 'text-purple-600',
      bg: 'bg-purple-50',
      link: '/dashboard',
    },
    {
      icon: Flag,
      label: 'Pending Reports',
      value: stats.pendingReports,
      iconColor: 'text-red-600',
      bg: 'bg-red-50',
      link: '/dashboard/admin/reports',
      urgent: stats.pendingReports > 0,
    },
    {
      icon: EyeOff,
      label: 'Hidden Files',
      value: stats.hiddenFiles,
      iconColor: 'text-orange-600',
      bg: 'bg-orange-50',
      link: '/dashboard/admin/reports',
    },
    {
      icon: Users,
      label: 'Total Admins',
      value: stats.totalAdmins,
      iconColor: 'text-teal-600',
      bg: 'bg-teal-50',
      link: isSuperAdmin ? '/dashboard/admin/manage-admins' : '#',
    },
  ];

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">

        {/* Header Banner */}
        <div className="bg-gradient-to-r from-purple-600 to-teal-500 rounded-xl p-8 mb-8 text-white shadow-xl">
          <div className="flex items-center gap-3 mb-1">
            <Shield className="w-10 h-10" />
            <h1 className="text-3xl font-bold">Admin Panel</h1>
          </div>
          <p className="text-purple-100 mt-1">
            Welcome, {userProfile?.name} •{' '}
            <span className="font-semibold">
              {isSuperAdmin ? '👑 Super Admin' : '🛡️ Admin'}
            </span>
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.label}
                to={card.link}
                className={`bg-white rounded-xl shadow-md p-6 hover:shadow-lg transition-all ${
                  card.urgent ? 'ring-2 ring-red-300' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 font-medium">{card.label}</p>
                    <p className="text-3xl font-bold text-gray-800 mt-2">{card.value}</p>
                    {card.urgent && (
                      <p className="text-xs text-red-500 font-medium mt-1 flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> Needs attention
                      </p>
                    )}
                  </div>
                  <div className={`${card.bg} p-4 rounded-lg`}>
                    <Icon className={`w-8 h-8 ${card.iconColor}`} />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-800 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              to="/dashboard/admin/reports"
              className="flex items-center gap-3 p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 transition-colors group"
            >
              <div className="bg-purple-100 p-2 rounded-lg">
                <Flag className="w-6 h-6 text-purple-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-800">View Reports</p>
                <p className="text-sm text-gray-500">Review reported files</p>
              </div>
              {stats.pendingReports > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {stats.pendingReports}
                </span>
              )}
              <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </Link>

            {isSuperAdmin && (
              <Link
                to="/dashboard/admin/manage-admins"
                className="flex items-center gap-3 p-4 border-2 border-teal-200 rounded-lg hover:bg-teal-50 transition-colors group"
              >
                <div className="bg-teal-100 p-2 rounded-lg">
                  <Crown className="w-6 h-6 text-teal-600" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-800">Manage Admins</p>
                  <p className="text-sm text-gray-500">Promote or demote users</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-teal-600 transition-colors" />
              </Link>
            )}
          </div>
        </div>

        {/* Recent Pending Reports */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
              <Flag className="w-5 h-5 text-red-500" />
              Recent Pending Reports
            </h2>
            <Link
              to="/dashboard/admin/reports"
              className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
            >
              View All <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {recentReports.length > 0 ? (
            <div className="space-y-3">
              {recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-1">
                    <p className="font-semibold text-gray-800">{report.noteTitle}</p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      By: {report.reportedByName}{' '}
                      {report.reportedByUSN !== 'N/A' && (
                        <span className="text-gray-400">({report.reportedByUSN})</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Reason: <span className="font-medium">{report.reason}</span>
                    </p>
                  </div>
                  <Link
                    to="/dashboard/admin/reports"
                    className="ml-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 font-medium text-sm whitespace-nowrap"
                  >
                    Review →
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No pending reports!</p>
              <p className="text-sm text-gray-500">All files are in good standing.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default AdminPanel;