import React, { useState } from 'react';

const FileUploader = ({ onFileSelect, accept = '.pdf,.jpg,.jpeg,.png', maxSizeMB = 5, currentFile = null }) => {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF and image files (JPEG, PNG) are allowed');
      return;
    }

    setError('');
    
    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

    onFileSelect(file);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-[#6b4423] mb-1">Invoice File</label>
      <div className="flex items-center gap-4">
        <label className="cursor-pointer px-4 py-2 bg-[#d86d2a] text-white rounded-lg hover:bg-[#b85a1f] transition-colors">
          <span>Choose File</span>
          <input
            type="file"
            accept={accept}
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
        {currentFile && (
          <span className="text-sm text-gray-600">
            Current: {currentFile.split('/').pop()}
          </span>
        )}
      </div>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
      {preview && (
        <div className="mt-2">
          <img src={preview} alt="Preview" className="max-w-xs max-h-48 rounded-lg border border-gray-300" />
        </div>
      )}
    </div>
  );
};

export default FileUploader;
















