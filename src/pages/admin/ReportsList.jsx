import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import Layout from '../../components/Layout';
import { useNavigate } from 'react-router-dom';
import {
  Flag, ArrowLeft, Trash2, Eye, CheckCircle,
  Loader, AlertTriangle, RotateCcw, ExternalLink, Filter
} from 'lucide-react';
import {
  collection, query, orderBy, getDocs, doc, updateDoc,
  deleteDoc, getDoc, addDoc, serverTimestamp, where
} from 'firebase/firestore';
import { db } from '../../firebase/config';
import { toast } from 'react-toastify';

const ReportsList = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending | reviewed | all
  const [actionLoading, setActionLoading] = useState(null);

  const isAdmin = ['admin', 'super_admin'].includes(userProfile?.role?.trim());

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchReports();
  }, [isAdmin, filter]);

  const fetchReports = async () => {
    setLoading(true);
    try {
      let q;
      if (filter === 'all') {
        q = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
      } else {
        q = query(
          collection(db, 'reports'),
          where('status', '==', filter),
          orderBy('createdAt', 'desc')
        );
      }
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setReports(data);
    } catch (error) {
      console.error('Error fetching reports:', error);
      // Fallback without orderBy if index missing
      try {
        const snapshot = await getDocs(collection(db, 'reports'));
        const data = snapshot.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(r => filter === 'all' ? true : r.status === filter)
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        setReports(data);
      } catch (err) {
        toast.error('Failed to load reports');
      }
    } finally {
      setLoading(false);
    }
  };

  const logAction = async (actionType, targetId, targetName, reason) => {
    try {
      await addDoc(collection(db, 'adminLogs'), {
        actionType,
        performedBy: currentUser.uid,
        performedByName: userProfile?.name || 'Admin',
        targetId,
        targetName,
        reason: reason || '',
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.warn('Log failed:', err);
    }
  };

  // Delete the reported note and mark report resolved
  const handleDeleteNote = async (report) => {
    if (!window.confirm(`Delete the note "${report.noteTitle}"? This cannot be undone.`)) return;

    setActionLoading(report.id);
    try {
      // Delete the note
      await deleteDoc(doc(db, 'notes', report.noteId));

      // Mark report as resolved
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'resolved',
        reviewedBy: currentUser.uid,
        reviewedByName: userProfile?.name,
        reviewedAt: serverTimestamp(),
        action: 'deleted'
      });

      // Also resolve all other reports for the same note
      const otherReports = reports.filter(
        r => r.noteId === report.noteId && r.id !== report.id
      );
      for (const r of otherReports) {
        await updateDoc(doc(db, 'reports', r.id), {
          status: 'resolved',
          action: 'deleted'
        });
      }

      await logAction('delete_reported_note', report.noteId, report.noteTitle, `Reported: ${report.reason}`);
      toast.success('✅ Note deleted and report resolved');
      fetchReports();
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to delete note');
    } finally {
      setActionLoading(null);
    }
  };

  // Restore a hidden note (mark report reviewed, unhide note)
  const handleRestoreNote = async (report) => {
    setActionLoading(report.id);
    try {
      // Check if note exists
      const noteDoc = await getDoc(doc(db, 'notes', report.noteId));
      if (noteDoc.exists()) {
        await updateDoc(doc(db, 'notes', report.noteId), {
          status: 'active',
          reportCount: 0,
          reportedBy: []
        });
      }

      // Mark report as reviewed
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'reviewed',
        reviewedBy: currentUser.uid,
        reviewedByName: userProfile?.name,
        reviewedAt: serverTimestamp(),
        action: 'restored'
      });

      await logAction('restore_note', report.noteId, report.noteTitle, 'False report - note restored');
      toast.success('✅ Note restored and report marked reviewed');
      fetchReports();
    } catch (error) {
      console.error('Restore error:', error);
      toast.error('Failed to restore note');
    } finally {
      setActionLoading(null);
    }
  };

  // Dismiss report without action
  const handleDismiss = async (report) => {
    setActionLoading(report.id);
    try {
      await updateDoc(doc(db, 'reports', report.id), {
        status: 'reviewed',
        reviewedBy: currentUser.uid,
        reviewedByName: userProfile?.name,
        reviewedAt: serverTimestamp(),
        action: 'dismissed'
      });
      await logAction('dismiss_report', report.noteId, report.noteTitle, 'Report dismissed');
      toast.info('Report dismissed');
      fetchReports();
    } catch (error) {
      toast.error('Failed to dismiss report');
    } finally {
      setActionLoading(null);
    }
  };

  const getReasonColor = (reason) => {
    const colors = {
      'Fake content': 'bg-red-50 text-red-700',
      'Wrong subject': 'bg-orange-50 text-orange-700',
      'Spam': 'bg-yellow-50 text-yellow-700',
      'Copyright violation': 'bg-purple-50 text-purple-700',
      'Inappropriate content': 'bg-pink-50 text-pink-700',
      'Other': 'bg-gray-50 text-gray-700',
    };
    return colors[reason] || 'bg-gray-50 text-gray-700';
  };

  const getStatusBadge = (status) => {
    if (status === 'pending') return 'bg-yellow-100 text-yellow-800';
    if (status === 'resolved') return 'bg-green-100 text-green-800';
    if (status === 'reviewed') return 'bg-blue-100 text-blue-800';
    return 'bg-gray-100 text-gray-700';
  };

  if (!isAdmin) return null;

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate('/dashboard/admin')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <Flag className="w-7 h-7 text-red-500" />
              Reports List
              {pendingCount > 0 && (
                <span className="ml-2 bg-red-500 text-white text-sm px-2 py-0.5 rounded-full">
                  {pendingCount} pending
                </span>
              )}
            </h1>
            <p className="text-gray-500 text-sm">Review and take action on reported content</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-5">
          {['pending', 'reviewed', 'all'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg font-medium text-sm capitalize transition-all ${
                filter === f
                  ? 'bg-gradient-to-r from-purple-600 to-teal-500 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 shadow-sm'
              }`}
            >
              {f === 'pending' ? '🔴 Pending' : f === 'reviewed' ? '✅ Reviewed' : '📋 All'}
            </button>
          ))}
        </div>

        {/* Reports */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader className="w-8 h-8 animate-spin text-purple-600" />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-xl shadow-md p-12 text-center">
            <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              {filter === 'pending' ? 'No Pending Reports!' : 'No Reports Found'}
            </h3>
            <p className="text-gray-500">
              {filter === 'pending'
                ? 'All files are in good standing. Great community!'
                : 'No reports match this filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <div
                key={report.id}
                className={`bg-white rounded-xl shadow-md p-5 border-l-4 ${
                  report.status === 'pending'
                    ? 'border-l-red-400'
                    : report.action === 'deleted'
                    ? 'border-l-gray-300'
                    : 'border-l-green-400'
                }`}
              >
                {/* Report Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-800 text-lg">
                        {report.noteTitle || 'Unknown Note'}
                      </h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusBadge(report.status)}`}>
                        {report.status}
                      </span>
                      {report.action && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                          {report.action}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">
                      Reported by: <span className="font-medium text-gray-700">{report.reportedByName || 'Unknown'}</span>
                      {report.reportedByUSN && <span className="text-gray-400"> ({report.reportedByUSN})</span>}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {report.createdAt?.toDate?.()?.toLocaleString() || 'Date unknown'}
                    </p>
                  </div>

                  {/* Reason Badge */}
                  <span className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${getReasonColor(report.reason)}`}>
                    {report.reason || 'No reason'}
                  </span>
                </div>

                {/* Details */}
                {report.details && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Details: </span>
                      {report.details}
                    </p>
                  </div>
                )}

                {/* Reviewed info */}
                {report.reviewedBy && (
                  <div className="text-xs text-gray-400 mb-3">
                    Reviewed by {report.reviewedByName} • {report.reviewedAt?.toDate?.()?.toLocaleString()}
                  </div>
                )}

                {/* Action Buttons - only for pending reports */}
                {report.status === 'pending' && (
                  <div className="flex gap-3 flex-wrap">
                    <button
                      onClick={() => navigate(`/notes/${report.noteId}`)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm font-medium transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      View Note
                    </button>
                    <button
                      onClick={() => handleRestoreNote(report)}
                      disabled={actionLoading === report.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      {actionLoading === report.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <RotateCcw className="w-4 h-4" />
                      )}
                      Restore / False Report
                    </button>
                    <button
                      onClick={() => handleDismiss(report)}
                      disabled={actionLoading === report.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleDeleteNote(report)}
                      disabled={actionLoading === report.id}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-60"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete Note
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        {reports.length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-100 rounded-lg flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-yellow-700">
              Files are auto-hidden after 5 reports. Always review a note before deleting — use "View Note" to check the content first.
              Deleting is permanent and cannot be undone.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default ReportsList;