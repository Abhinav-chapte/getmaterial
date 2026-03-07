/**
 * Robust file downloader — tries 3 strategies to ensure file downloads
 * correctly without opening in browser viewers (Office Online, etc.)
 */
export const forceDownload = async (fileURL, fileName, fileType) => {
  // Strategy 1: Fetch as blob with correct MIME type
  try {
    const response = await fetch(fileURL, { mode: 'cors' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const blob = await response.blob();
    const mimeType = fileType || blob.type || 'application/octet-stream';
    const typedBlob = new Blob([blob], { type: mimeType });
    const blobUrl = window.URL.createObjectURL(typedBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 5000);
    return true;
  } catch (err) {
    console.warn('Blob download failed, trying Cloudinary fl_attachment:', err);
  }

  // Strategy 2: Cloudinary fl_attachment flag
  try {
    const attachUrl = fileURL.includes('cloudinary.com')
      ? fileURL.replace('/upload/', '/upload/fl_attachment/')
      : fileURL;
    const response2 = await fetch(attachUrl, { mode: 'cors' });
    if (!response2.ok) throw new Error(`HTTP ${response2.status}`);
    const blob2 = await response2.blob();
    const mimeType2 = fileType || blob2.type || 'application/octet-stream';
    const typedBlob2 = new Blob([blob2], { type: mimeType2 });
    const blobUrl2 = window.URL.createObjectURL(typedBlob2);
    const link2 = document.createElement('a');
    link2.href = blobUrl2;
    link2.download = fileName;
    link2.style.display = 'none';
    document.body.appendChild(link2);
    link2.click();
    document.body.removeChild(link2);
    setTimeout(() => window.URL.revokeObjectURL(blobUrl2), 5000);
    return true;
  } catch (err2) {
    console.warn('Cloudinary flag failed, using direct link:', err2);
  }

  // Strategy 3: Last resort direct anchor
  const link3 = document.createElement('a');
  link3.href = fileURL;
  link3.download = fileName;
  link3.style.display = 'none';
  document.body.appendChild(link3);
  link3.click();
  document.body.removeChild(link3);
  return false;
};

export const getFileExtension = (fileType) => {
  const map = {
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/msword': 'doc',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
    'application/vnd.ms-powerpoint': 'ppt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'application/vnd.ms-excel': 'xls',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'text/plain': 'txt',
  };
  return map[fileType] || 'pdf';
};

export const safeFileName = (title, fileType) =>
  `${(title || 'file').replace(/[^a-z0-9\s\-_]/gi, '_').replace(/\s+/g, '_')}.${getFileExtension(fileType)}`;