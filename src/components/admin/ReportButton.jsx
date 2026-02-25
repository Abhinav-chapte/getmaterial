import { useState } from 'react';
import { Flag, X, Loader, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
  collection, addDoc, updateDoc, doc, arrayUnion,
  increment, getDoc, serverTimestamp
} from 'firebase/firestore';
import { db } from '../../firebase/config';

const REPORT_THRESHOLD = 5;

const REASONS = [
  'Fake/Incorrect Content',
  'Wrong Subject/Department',
  'Spam/Advertisement',
  'Inappropriate Content',
  'Duplicate File',
  'Other',
];

const ReportButton = ({ noteId, noteTitle, reportedBy = [] }) => {
  const { currentUser, userProfile } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');

  const alreadyReported = reportedBy.includes(currentUser?.uid);

  const handleOpen = () => {
    if (!currentUser) {
      toast.error('Please login to report');
      return;
    }
    if (alreadyReported) {
      toast.info('You have already reported this file');
      return;
    }
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!reason) {
      toast.error('Please select a reason');
      return;
    }

    setLoading(true);

    try {
      // 1. Add report to 'reports' collection
      await addDoc(collection(db, 'reports'), {
        noteId,
        noteTitle: noteTitle || 'Unknown',
        reportedBy: currentUser.uid,
        reportedByName: userProfile?.name || 'Anonymous',
        reportedByUSN: userProfile?.collegeUSN || userProfile?.collegeID || 'N/A',
        reason,
        details: details.trim() || 'No additional details provided',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      // 2. Update note: add uid to reportedBy array + increment count
      const noteRef = doc(db, 'notes', noteId);
      const noteSnap = await getDoc(noteRef);

      if (noteSnap.exists()) {
        const currentCount = (noteSnap.data().reportCount || 0) + 1;

        const updateData = {
          reportedBy: arrayUnion(currentUser.uid),
          reportCount: increment(1),
        };

        // Auto-hide if threshold reached
        if (currentCount >= REPORT_THRESHOLD) {
          updateData.status = 'hidden';
          toast.warning('⚠️ This file has been hidden pending admin review.');
        } else {
          toast.success(`✅ Report submitted! (${currentCount}/${REPORT_THRESHOLD} reports)`);
        }

        await updateDoc(noteRef, updateData);
      } else {
        toast.success('✅ Report submitted!');
      }

      setShowModal(false);
      setReason('');
      setDetails('');

      // Short delay then reload so note status reflects update
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Report error:', error);
      toast.error('Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={handleOpen}
        className={`w-full flex items-center justify-center gap-2 text-sm mt-3 py-2 rounded-lg transition-colors ${
          alreadyReported
            ? 'text-gray-400 cursor-default'
            : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
        }`}
        title={alreadyReported ? 'Already reported' : 'Report inappropriate content'}
      >
        <Flag className="w-4 h-4" />
        {alreadyReported ? 'Already Reported' : 'Report inappropriate content'}
      </button>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div className="flex items-center gap-2">
                <div className="bg-red-100 p-2 rounded-lg">
                  <Flag className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Report File</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[220px]">{noteTitle}</p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-700">
                  Only report content that violates our guidelines.
                  Files are auto-hidden after {REPORT_THRESHOLD} reports and reviewed by admins.
                </p>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Why are you reporting this? <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`w-full px-3 py-2 text-sm rounded-lg border-2 text-left transition-all ${
                        reason === r
                          ? 'border-red-500 bg-red-50 text-red-700 font-medium'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Details */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional details <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide more context about the issue..."
                  rows={3}
                  maxLength={300}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-red-400 focus:outline-none text-sm resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{details.length}/300</p>
              </div>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border-2 border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !reason}
                  className="flex-1 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <Flag className="w-4 h-4" />
                  )}
                  {loading ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportButton;