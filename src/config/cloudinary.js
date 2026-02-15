// Cloudinary configuration
export const cloudinaryConfig = {
  cloudName: 'dh0ssuhe3',
  uploadPreset: 'getmaterial_notes',
};

// Function to upload file to Cloudinary
export const uploadToCloudinary = async (file) => {
  console.log('Uploading file:', file.name, 'Type:', file.type);

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);

  // Determine the correct endpoint based on file type
  const isPDF = file.type === 'application/pdf';
  const resourceType = isPDF ? 'raw' : 'auto';

  try {
    const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/upload`;
    
    console.log('Upload URL:', uploadUrl);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Cloudinary error:', errorData);
      throw new Error(`Upload failed: ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    console.log('Upload successful! URL:', data.secure_url);
    
    // Return the secure URL
    return data.secure_url;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
};