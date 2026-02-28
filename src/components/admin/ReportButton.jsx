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
    if (!currentUser) { toast.error('Please login to report'); return; }
    if (alreadyReported) { toast.info('You have already reported this file'); return; }
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setReason('');
    setDetails('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reason) { toast.error('Please select a reason'); return; }
    setLoading(true);

    try {
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

      const noteRef = doc(db, 'notes', noteId);
      const noteSnap = await getDoc(noteRef);

      if (noteSnap.exists()) {
        const currentCount = (noteSnap.data().reportCount || 0) + 1;
        const updateData = {
          reportedBy: arrayUnion(currentUser.uid),
          reportCount: increment(1),
        };
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

      handleClose();
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
      >
        <Flag className="w-4 h-4" />
        {alreadyReported ? 'Already Reported' : 'Report inappropriate content'}
      </button>

      {/* ── Modal ── */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
        >
          {/*
            On mobile: slides up from bottom (items-end), full width, rounded top corners
            On desktop: centered, max-w-md, fully rounded
          */}
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[90vh]">

            {/* ── Header (fixed, never scrolls) ── */}
            <div className="flex items-center justify-between px-5 py-4 border-b flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="bg-red-100 p-2 rounded-lg">
                  <Flag className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800">Report File</h3>
                  <p className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-[260px]">
                    {noteTitle}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* ── Scrollable Body ── */}
            <div className="overflow-y-auto flex-1 px-5 py-3 space-y-3">

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-yellow-700">
                  Only report content that violates our guidelines.
                  Files are auto-hidden after {REPORT_THRESHOLD} reports and reviewed by admins.
                </p>
              </div>

              {/* Reason Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Why are you reporting this? <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReason(r)}
                      className={`px-3 py-2.5 text-sm rounded-xl border-2 text-left transition-all leading-tight ${
                        reason === r
                          ? 'border-red-500 bg-red-50 text-red-700 font-semibold'
                          : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {reason === r ? '✓ ' : ''}{r}
                    </button>
                  ))}
                </div>
              </div>

              {/* Additional Details */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Additional details{' '}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Provide more context about the issue..."
                  rows={2}
                  maxLength={300}
                  className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-red-400 focus:outline-none text-sm resize-none"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">{details.length}/300</p>
              </div>
            </div>

            {/* ── Footer Buttons (fixed, never scrolls) ── */}
            <div className="px-5 py-4 border-t flex gap-3 flex-shrink-0 bg-white rounded-b-2xl">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 py-3 border-2 border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 font-semibold text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading || !reason}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <Flag className="w-4 h-4" />
                )}
                {loading ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ReportButton;