import React, { useState, useCallback } from 'react';
import { apiCallAuth } from '../utils/api';

export default function BrandAssetUpload({ campaignId, token, onUploadSuccess }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({});
  const [error, setError] = useState('');
  const [uploadedAssets, setUploadedAssets] = useState([]);

  const MAX_FILES = 10;
  const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
  const ACCEPTED_FORMATS = ['image/jpeg', 'image/png', 'video/mp4', 'application/pdf', 'audio/mpeg'];

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFilesSelect(droppedFiles);
  }, []);

  const handleFilesSelect = (selectedFiles) => {
    setError('');
    const newFiles = [];

    for (const file of selectedFiles) {
      // Validate format
      if (!ACCEPTED_FORMATS.includes(file.type)) {
        setError(`${file.name} has invalid format. Accepted: JPG, PNG, MP4, PDF, MP3`);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} exceeds 20MB limit`);
        continue;
      }

      newFiles.push(file);
    }

    // Check total file count
    if (files.length + newFiles.length > MAX_FILES) {
      setError(`Cannot upload more than ${MAX_FILES} files total. Currently: ${files.length}`);
      return;
    }

    setFiles([...files, ...newFiles]);
  };

  const handleFileInputChange = (e) => {
    handleFilesSelect(Array.from(e.target.files));
  };

  const removeFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setUploading(true);
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    try {
      const response = await apiCallAuth(
        `/api/campaigns/${campaignId}/assets/upload`,
        token,
        'POST',
        formData
      );

      if (response.success) {
        setUploadedAssets([...uploadedAssets, ...response.assets]);
        setFiles([]);
        setError('');
        if (onUploadSuccess) onUploadSuccess(response.assets);
      } else {
        setError(response.message || 'Upload failed');
      }
    } catch (err) {
      setError('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeUploadedAsset = (index) => {
    setUploadedAssets(uploadedAssets.filter((_, i) => i !== index));
  };

  const getFileIcon = (fileType) => {
    switch (fileType) {
      case 'image/jpeg':
      case 'image/png':
        return '🖼️';
      case 'video/mp4':
        return '🎬';
      case 'application/pdf':
        return '📄';
      case 'audio/mpeg':
        return '🎵';
      default:
        return '📎';
    }
  };

  return (
    <div className="bg-white rounded-lg border-2 border-dashed border-blue-300 p-8 mb-8">
      <h3 className="text-xl font-bold text-gray-800 mb-2">Brand Assets</h3>
      <p className="text-sm text-gray-600 mb-6">
        Upload brand assets that promoters will use to create content
      </p>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-blue-300 rounded-lg p-8 text-center bg-blue-50 hover:bg-blue-100 transition cursor-pointer mb-6"
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-gray-700 font-semibold mb-2">Drag files here or click to browse</p>
        <p className="text-xs text-gray-600 mb-4">
          Accepted: JPG, PNG, MP4, PDF, MP3 | Max 20MB per file | Max 10 files per campaign
        </p>
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.mp4,.pdf,.mp3"
          onChange={handleFileInputChange}
          className="hidden"
          id="file-input"
        />
        <label htmlFor="file-input" className="inline-block">
          <button
            type="button"
            onClick={() => document.getElementById('file-input').click()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 transition"
          >
            Select Files
          </button>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          ⚠️ {error}
        </div>
      )}

      {/* Selected Files Preview */}
      {files.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-gray-800 mb-3">
            Selected Files ({files.length}/{MAX_FILES})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {files.map((file, idx) => (
              <div key={idx} className="border rounded-lg p-4 bg-gray-50 relative group">
                <div className="text-3xl mb-2 text-center">
                  {getFileIcon(file.type)}
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate mb-1">
                  {file.name}
                </p>
                <p className="text-xs text-gray-600 mb-3">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition opacity-0 group-hover:opacity-100"
                >
                  ✕
                </button>
                {uploadProgress[idx] && (
                  <div className="w-full bg-gray-300 rounded-full h-2 mb-2">
                    <div
                      className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${uploadProgress[idx]}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={uploadFiles}
            disabled={uploading}
            className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      )}

      {/* Uploaded Assets */}
      {uploadedAssets.length > 0 && (
        <div>
          <h4 className="font-semibold text-gray-800 mb-3">
            Uploaded Assets ({uploadedAssets.length}/{MAX_FILES})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedAssets.map((asset, idx) => (
              <div
                key={idx}
                className="border border-green-200 bg-green-50 rounded-lg p-4 relative group"
              >
                <div className="text-3xl mb-2 text-center">
                  {asset.file_type === 'image'
                    ? '🖼️'
                    : asset.file_type === 'video'
                    ? '🎬'
                    : asset.file_type === 'pdf'
                    ? '📄'
                    : '🎵'}
                </div>
                <p className="text-sm font-semibold text-gray-800 truncate mb-1">
                  {asset.file_name}
                </p>
                <p className="text-xs text-gray-600 mb-2">
                  {asset.file_size} KB • {asset.file_type}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => removeUploadedAsset(idx)}
                    className="flex-1 bg-red-500 text-white text-sm px-3 py-1 rounded hover:bg-red-600 transition"
                  >
                    Remove
                  </button>
                </div>
                <div className="absolute top-2 right-2 bg-green-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  ✓
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
