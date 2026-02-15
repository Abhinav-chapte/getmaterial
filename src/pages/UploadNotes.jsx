import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { Upload, File, X, CheckCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-toastify';
import { uploadToCloudinary } from '../config/cloudinary';

const UploadNotes = () => {
  const { currentUser, userProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    subject: '',
    department: userProfile?.department || '',
    semester: '',
    professor: '',
    tags: [],
    description: ''
  });

  const departments = ['CSE', 'ECE', 'MECH', 'CIVIL', 'EEE', 'AI/ML', 'ISE', 'DS', 'RA'];
  const tagOptions = ['Exam Prep', 'Assignment', 'Class Notes', 'Lab Manual', 'Previous Year Papers'];

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png'];
      
      if (!allowedTypes.includes(file.type)) {
        toast.error('Invalid file type. Please upload PDF, PPT, DOC, or image files.');
        return;
      }

      // Validate file size (50MB max)
      if (file.size > 50 * 1024 * 1024) {
        toast.error('File size must be less than 50MB');
        return;
      }

      setSelectedFile(file);
      toast.success('File selected successfully!');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTagToggle = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag]
    }));
  };

  const handleSubmit = async () => {
  if (!selectedFile) {
    toast.error('Please select a file to upload');
    return;
  }

  if (!formData.title || !formData.subject || !formData.department || !formData.semester) {
    toast.error('Please fill in all required fields');
    return;
  }

  setUploading(true);

  try {
    // Upload file to Cloudinary
    const fileURL = await uploadToCloudinary(selectedFile);

    // Save note metadata to Firestore
    await addDoc(collection(db, 'notes'), {
      title: formData.title,
      subject: formData.subject,
      department: formData.department,
      semester: parseInt(formData.semester),
      professor: formData.professor || '',
      description: formData.description || '',
      tags: formData.tags,
      fileURL: fileURL,
      fileType: selectedFile.type,
      fileSize: selectedFile.size,
      uploadedBy: currentUser.uid,
      uploaderName: userProfile?.name || 'Anonymous',
      upvotes: 0,
      downvotes: 0,
      downloads: 0,
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    toast.success('🎉 Notes uploaded successfully!');
    
    setTimeout(() => {
      navigate('/dashboard/uploads');
    }, 2000);

  } catch (error) {
    console.error('Upload error:', error);
    toast.error('Failed to upload notes. Please try again.');
  } finally {
    setUploading(false);
  }
};

  const steps = [
    { number: 1, title: 'File Upload', icon: Upload },
    { number: 2, title: 'Details', icon: File },
    { number: 3, title: 'Review & Submit', icon: CheckCircle }
  ];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Upload Notes</h1>
          <p className="text-gray-600">Share your study materials with fellow students</p>
        </div>

        {/* Progress Steps */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.number} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center font-bold ${
                        currentStep >= step.number
                          ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                          : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      <Icon className="w-6 h-6" />
                    </div>
                    <p className={`mt-2 text-sm font-medium ${
                      currentStep >= step.number ? 'text-purple-600' : 'text-gray-500'
                    }`}>
                      {step.title}
                    </p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className={`flex-1 h-1 mx-4 ${
                      currentStep > step.number ? 'bg-gradient-to-r from-purple-600 to-blue-600' : 'bg-gray-200'
                    }`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Step Content */}
        <div className="bg-white rounded-xl shadow-md p-8">
          {/* Step 1: File Upload */}
          {currentStep === 1 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📄 Upload Your File</h2>
              
              <div
                className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-purple-500 transition-colors cursor-pointer"
                onClick={() => document.getElementById('fileInput').click()}
              >
                {selectedFile ? (
                  <div className="space-y-4">
                    <div className="bg-green-50 p-4 rounded-lg inline-block">
                      <File className="w-16 h-16 text-green-600 mx-auto" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-800">{selectedFile.name}</p>
                      <p className="text-sm text-gray-600 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFile(null);
                      }}
                      className="text-red-600 hover:text-red-700 font-medium"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="w-16 h-16 text-gray-400 mx-auto" />
                    <div>
                      <p className="text-lg font-semibold text-gray-800">
                        Drop your awesome notes here!
                      </p>
                      <p className="text-sm text-gray-600 mt-2">
                        or click to browse files
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Supported: PDF, PPT, PPTX, DOC, DOCX, JPG, PNG (Max 50 MB)
                    </p>
                  </div>
                )}
              </div>

              <input
                id="fileInput"
                type="file"
                className="hidden"
                accept=".pdf,.ppt,.pptx,.doc,.docx,.jpg,.jpeg,.png"
                onChange={handleFileSelect}
              />

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setCurrentStep(2)}
                  disabled={!selectedFile}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Details */}
          {currentStep === 2 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">📝 Add Details</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Note Title <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="title"
                    value={formData.title}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Data Structures Complete Notes"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Subject Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="subject"
                    value={formData.subject}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Data Structures & Algorithms"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Department <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="department"
                      value={formData.department}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Department</option>
                      {departments.map(dept => (
                        <option key={dept} value={dept}>{dept}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Semester <span className="text-red-500">*</span>
                    </label>
                    <select
                      name="semester"
                      value={formData.semester}
                      onChange={handleChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Semester</option>
                      {[1, 2, 3, 4, 5, 6, 7, 8].map(sem => (
                        <option key={sem} value={sem}>Semester {sem}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Professor Name (Optional)
                  </label>
                  <input
                    type="text"
                    name="professor"
                    value={formData.professor}
                    onChange={handleChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="e.g., Dr. Sharma"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Tags
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {tagOptions.map(tag => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleTagToggle(tag)}
                        className={`px-4 py-2 rounded-lg font-medium transition-all ${
                          formData.tags.includes(tag)
                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Add any additional information about these notes..."
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setCurrentStep(1)}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <button
                  onClick={() => setCurrentStep(3)}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg"
                >
                  Next <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review & Submit */}
          {currentStep === 3 && (
            <div>
              <h2 className="text-2xl font-bold text-gray-800 mb-6">✅ Review & Submit</h2>

              <div className="space-y-6">
                {/* File Preview */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">File Information</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">File Name:</span> {selectedFile?.name}</p>
                    <p><span className="font-medium">File Size:</span> {(selectedFile?.size / 1024 / 1024).toFixed(2)} MB</p>
                    <p><span className="font-medium">File Type:</span> {selectedFile?.type}</p>
                  </div>
                </div>

                {/* Note Details */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-800 mb-4">Note Details</h3>
                  <div className="space-y-2">
                    <p><span className="font-medium">Title:</span> {formData.title}</p>
                    <p><span className="font-medium">Subject:</span> {formData.subject}</p>
                    <p><span className="font-medium">Department:</span> {formData.department}</p>
                    <p><span className="font-medium">Semester:</span> {formData.semester}</p>
                    {formData.professor && (
                      <p><span className="font-medium">Professor:</span> {formData.professor}</p>
                    )}
                    {formData.tags.length > 0 && (
                      <div>
                        <span className="font-medium">Tags:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.tags.map(tag => (
                            <span key={tag} className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm">
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {formData.description && (
                      <p><span className="font-medium">Description:</span> {formData.description}</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex justify-between">
                <button
                  onClick={() => setCurrentStep(2)}
                  className="flex items-center gap-2 px-6 py-3 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <ArrowLeft className="w-4 h-4" /> Edit
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={uploading}
                  className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-3 rounded-lg font-semibold hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4" /> Submit
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default UploadNotes;