import FileTypeIcon from './ui/FileTypeIcon';
import UiIcon from './ui/UiIcon';
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

  const getFileIcon = fileType => <FileTypeIcon type={fileType} />;

  return (
    <div className="bg-white rounded-card border-2 border-dashed border-line p-8 mb-8">
      <h3 className="text-xl font-bold text-ink mb-2">Brand Assets</h3>
      <p className="text-sm text-muted mb-6">
        Upload brand assets that promoters will use to create content
      </p>

      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className="border-2 border-dashed border-line rounded-card p-8 text-center bg-primary-soft hover:bg-primary-soft transition cursor-pointer mb-6"
      >
        <div className="text-4xl mb-2"><UiIcon name="folder" /></div>
        <p className="text-ink font-semibold mb-2">Drag files here or click to browse</p>
        <p className="text-xs text-muted mb-4">
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
            className="min-h-[44px] bg-primary text-white px-6 py-2 rounded-control font-semibold hover:bg-primary-hover transition"
          >
            Select Files
          </button>
        </label>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-card mb-6">
          <UiIcon name="alert" /> {error}
        </div>
      )}

      {/* Selected Files Preview */}
      {files.length > 0 && (
        <div className="mb-6">
          <h4 className="font-semibold text-ink mb-3">
            Selected Files ({files.length}/{MAX_FILES})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {files.map((file, idx) => (
              <div key={idx} className="border rounded-card p-4 bg-canvas relative group">
                <div className="text-3xl mb-2 text-center">
                  {getFileIcon(file.type)}
                </div>
                <p className="text-sm font-semibold text-ink truncate mb-1">
                  {file.name}
                </p>
                <p className="text-xs text-muted mb-3">
                  {(file.size / 1024).toFixed(2)} KB
                </p>
                <button
                  type="button"
                  aria-label={'Remove ' + file.name}
                  onClick={() => removeFile(idx)}
                  className="min-h-[44px] absolute top-2 right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center hover:bg-red-600 transition opacity-100"
                >
                  <UiIcon name="close" />
                </button>
                {uploadProgress[idx] && (
                  <div className="w-full bg-gray-300 rounded-full h-2 mb-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
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
            className="min-h-[44px] bg-primary text-white px-6 py-3 rounded-card font-semibold hover:bg-primary-hover transition disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {uploading ? 'Uploading...' : 'Upload Files'}
          </button>
        </div>
      )}

      {/* Uploaded Assets */}
      {uploadedAssets.length > 0 && (
        <div>
          <h4 className="font-semibold text-ink mb-3">
            Uploaded Assets ({uploadedAssets.length}/{MAX_FILES})
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {uploadedAssets.map((asset, idx) => (
              <div
                key={idx}
                className="border border-line bg-primary-soft rounded-card p-4 relative group"
              >
                <div className="text-3xl mb-2 text-center">
                  <FileTypeIcon type={asset.file_type} />
                </div>
                <p className="text-sm font-semibold text-ink truncate mb-1">
                  {asset.file_name}
                </p>
                <p className="text-xs text-muted mb-2">
                  {asset.file_size} KB • {asset.file_type}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => removeUploadedAsset(idx)}
                    className="min-h-[44px] flex-1 bg-red-500 text-white text-sm px-3 py-1 rounded hover:bg-red-600 transition"
                  >
                    Remove
                  </button>
                </div>
                <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                  <UiIcon name="check" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
