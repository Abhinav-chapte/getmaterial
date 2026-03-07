const KEY = 'getnotes_recently_viewed';
const MAX = 5;

// Save a note to recently viewed (deduplicates, keeps latest at front)
export const saveRecentlyViewed = (note) => {
  try {
    const existing = getRecentlyViewed();
    const filtered = existing.filter(n => n.id !== note.id);
    const updated = [note, ...filtered].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('Could not save recently viewed:', e);
  }
};

// Get recently viewed notes array
export const getRecentlyViewed = () => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
};

// Clear all recently viewed
export const clearRecentlyViewed = () => {
  localStorage.removeItem(KEY);
};