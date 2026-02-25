import { doc, updateDoc, addDoc, collection, serverTimestamp, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Check if user is admin
export const isAdmin = (userProfile) => {
  return userProfile?.role === 'admin' || userProfile?.role === 'super_admin';
};

// Check if user is super admin
export const isSuperAdmin = (userProfile) => {
  return userProfile?.role === 'super_admin';
};

// Promote user to admin
export const promoteToAdmin = async (userId, currentUserName) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: 'admin'
    });

    // Log the action
    await logAdminAction({
      actionType: 'promote_admin',
      performedBy: currentUserName,
      targetId: userId,
      reason: 'Promoted to admin'
    });

    return { success: true };
  } catch (error) {
    console.error('Error promoting user:', error);
    throw error;
  }
};

// Demote admin to student
export const demoteToStudent = async (userId, currentUserName) => {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Get user data first to check their role
    const userDoc = await getDoc(userRef);
    const userData = userDoc.data();
    
    // Determine appropriate role based on original role
    const newRole = userData.role === 'professor' ? 'professor' : 'student';
    
    await updateDoc(userRef, {
      role: newRole
    });

    // Log the action
    await logAdminAction({
      actionType: 'demote_admin',
      performedBy: currentUserName,
      targetId: userId,
      reason: 'Demoted from admin'
    });

    return { success: true };
  } catch (error) {
    console.error('Error demoting user:', error);
    throw error;
  }
};

// Delete note (admin)
export const deleteNoteAdmin = async (noteId, adminName, reason) => {
  try {
    const noteRef = doc(db, 'notes', noteId);
    
    // Update note status instead of deleting (soft delete)
    await updateDoc(noteRef, {
      status: 'deleted',
      deletedBy: adminName,
      deletedAt: serverTimestamp(),
      deleteReason: reason
    });

    // Log the action
    await logAdminAction({
      actionType: 'delete_file',
      performedBy: adminName,
      targetId: noteId,
      reason: reason
    });

    return { success: true };
  } catch (error) {
    console.error('Error deleting note:', error);
    throw error;
  }
};

// Restore deleted note
export const restoreNote = async (noteId, adminName) => {
  try {
    const noteRef = doc(db, 'notes', noteId);
    
    await updateDoc(noteRef, {
      status: 'active',
      deletedBy: null,
      deletedAt: null,
      deleteReason: null,
      reportCount: 0,
      reportedBy: []
    });

    // Log the action
    await logAdminAction({
      actionType: 'restore_file',
      performedBy: adminName,
      targetId: noteId,
      reason: 'File restored'
    });

    return { success: true };
  } catch (error) {
    console.error('Error restoring note:', error);
    throw error;
  }
};

// Submit report
export const submitReport = async (reportData) => {
  try {
    // Add report to reports collection
    await addDoc(collection(db, 'reports'), {
      ...reportData,
      status: 'pending',
      createdAt: serverTimestamp()
    });

    // Update note's report count and add reporter ID
    const noteRef = doc(db, 'notes', reportData.noteId);
    const noteDoc = await getDoc(noteRef);
    const noteData = noteDoc.data();
    
    const currentReportedBy = noteData.reportedBy || [];
    const newReportCount = (noteData.reportCount || 0) + 1;
    
    // Check if already reported by this user
    if (currentReportedBy.includes(reportData.reportedBy)) {
      throw new Error('You have already reported this file');
    }

    await updateDoc(noteRef, {
      reportCount: newReportCount,
      reportedBy: [...currentReportedBy, reportData.reportedBy]
    });

    // Auto-hide if 5 or more reports
    if (newReportCount >= 5) {
      await updateDoc(noteRef, {
        status: 'hidden',
        hiddenAt: serverTimestamp()
      });
    }

    return { success: true, reportCount: newReportCount };
  } catch (error) {
    console.error('Error submitting report:', error);
    throw error;
  }
};

// Log admin action
export const logAdminAction = async (actionData) => {
  try {
    await addDoc(collection(db, 'adminLogs'), {
      ...actionData,
      timestamp: serverTimestamp()
    });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
};

// Mark report as reviewed
export const markReportReviewed = async (reportId, reviewedBy) => {
  try {
    const reportRef = doc(db, 'reports', reportId);
    await updateDoc(reportRef, {
      status: 'reviewed',
      reviewedBy: reviewedBy,
      reviewedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking report as reviewed:', error);
    throw error;
  }
};