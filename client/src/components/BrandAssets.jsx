import FileTypeIcon from './ui/FileTypeIcon';
import UiIcon from './ui/UiIcon';
import React, { useState, useEffect } from 'react';
import { apiCallAuth } from '../utils/api';

export default function BrandAssets({ campaignId, token, campaignStatus, isSubscribed }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState({});
  const [error, setError] = useState('');
  const [previewModal, setPreviewModal] = useState(null);

  useEffect(() => {
  if (isSubscribed && campaignStatus === 'active') {  
    fetchAssets();
  } else {
    setLoading(false);
  }
}, [campaignId, token, isSubscribed, campaignStatus]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const response = await apiCallAuth(`/api/campaigns/${campaignId}/assets`, token, 'GET');
      
      if (response.success) {
        setAssets(response.assets || []);
      } else if (response.message?.includes('Subscribe')) {
        setError('');
      } else {
        setError(response.message || 'Failed to load assets');
      }
    } catch (err) {
      console.error('Fetch assets error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (asset) => {
    try {
      setDownloading(prev => ({ ...prev, [asset.id]: true }));

      const response = await apiCallAuth(
        `/api/campaigns/${campaignId}/assets/${asset.id}/download`,
        token,
        'GET'
      );

      if (response.success) {
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = response.download_url;
        link.download = asset.file_name;
        link.setAttribute('target', '_blank');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        alert(response.message || 'Download failed');
      }
    } catch (err) {
      alert('Download failed: ' + err.message);
    } finally {
      setDownloading(prev => ({ ...prev, [asset.id]: false }));
    }
  };

  const getFileIcon = fileType => <FileTypeIcon type={fileType} />;

  if (!isSubscribed || campaignStatus !== 'active') {
    return (
      <div className="my-8">
        <h3 className="text-xl font-bold text-ink mb-4">Brand Assets</h3>
        <div className="bg-canvas border-2 border-line rounded-card p-8 text-center">
          <div className="text-4xl mb-4"><UiIcon name="lock" /></div>
          <p className="text-ink font-semibold mb-2">Subscribe to access brand assets</p>
          <p className="text-muted text-sm">
            Join this campaign to see and download assets that help you create better content
          </p>
        </div>
      </div>
    );
  }

  if (campaignStatus !== 'active') {
    return (
      <div className="my-8">
        <h3 className="text-xl font-bold text-ink mb-4">Brand Assets</h3>
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-card p-8 text-center">
          <div className="text-4xl mb-4"><UiIcon name="clock" /></div>
          <p className="text-ink font-semibold mb-2">Campaign has ended</p>
          <p className="text-muted text-sm">
            Assets are no longer available for this campaign
          </p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-8">
        <h3 className="text-xl font-bold text-ink mb-4">Brand Assets</h3>
        <div className="flex justify-center py-8">
          <p className="text-muted">Loading assets...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-8">
        <h3 className="text-xl font-bold text-ink mb-4">Brand Assets</h3>
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-card">
          {error}
        </div>
      </div>
    );
  }

  if (!assets || assets.length === 0) {
    return (
      <div className="my-8">
        <h3 className="text-xl font-bold text-ink mb-4">Brand Assets</h3>
        <div className="bg-primary-soft border-2 border-line rounded-card p-8 text-center">
          <div className="text-4xl mb-4"><UiIcon name="star" /></div>
          <p className="text-ink font-semibold mb-2">No assets provided for this campaign</p>
          <p className="text-muted text-sm">
            Create your own branded content following the brand guidelines
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="my-8">
      {/* Header with tip */}
      <div className="mb-6">
        <h3 className="text-xl font-bold text-ink mb-4">Brand Assets — Use these in your content</h3>
        <div className="bg-primary-soft border-l-4 border-line p-4 rounded">
          <p className="text-sm text-ink">
            <UiIcon name="info" /> <strong>Tip:</strong> Use these assets in your posts to meet brand guidelines and increase your approval chances
          </p>
        </div>
      </div>

      {/* Assets Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="border rounded-card overflow-hidden bg-white shadow-sm hover:shadow-card transition"
          >
            {/* Preview Area */}
            <div className="relative bg-surface-muted aspect-square flex items-center justify-center group cursor-pointer">
              <div
                className="text-4xl transition group-hover:scale-125"
                onClick={() => setPreviewModal(asset)}
              >
                {getFileIcon(asset.file_type)}
              </div>
              {asset.file_type === 'video' && (
                <div className="absolute top-2 right-2 bg-black text-white text-xs px-2 py-1 rounded">
                  Video
                </div>
              )}
              <button
                onClick={() => setPreviewModal(asset)}
                className="min-h-[44px] absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition flex items-center justify-center opacity-100"
              >
                <span className="text-white text-3xl"><UiIcon name="eye" /></span>
              </button>
            </div>

            {/* Asset Info */}
            <div className="p-3">
              <p className="text-xs font-semibold text-ink truncate mb-1">
                {asset.file_name}
              </p>
              <p className="text-xs text-muted mb-3">
                {asset.file_size} KB
              </p>

              {/* Download Button */}
              <button
                onClick={() => handleDownload(asset)}
                disabled={downloading[asset.id]}
                className="min-h-[44px] w-full bg-primary text-white text-xs font-semibold py-2 rounded hover:bg-primary-hover transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-1"
              >
                {downloading[asset.id] ? (
                  <><UiIcon name="clock" /> Downloading...</>
                ) : (
                  <><UiIcon name="download" /> Download</>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Preview Modal */}
      {previewModal && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setPreviewModal(null)}
        >
          <div
            className="bg-white rounded-card max-w-2xl w-full max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-white border-b p-4 flex justify-between items-center">
              <h4 className="font-bold text-ink truncate">{previewModal.file_name}</h4>
              <button
                onClick={() => setPreviewModal(null)}
                className="min-h-[44px] text-muted hover:text-ink text-2xl"
              >
                <UiIcon name="close" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 flex justify-center items-center min-h-[300px] bg-canvas">
              {previewModal.file_type === 'image' ? (
                <img
                  src={previewModal.url}
                  alt={previewModal.file_name}
                  className="max-w-full max-h-full rounded"
                />
              ) : previewModal.file_type === 'video' ? (
                <video
                  controls
                  className="max-w-full max-h-full rounded"
                  style={{ maxHeight: '500px' }}
                >
                  <source src={previewModal.url} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              ) : previewModal.file_type === 'audio' ? (
                <audio controls className="w-full">
                  <source src={previewModal.url} type="audio/mpeg" />
                  Your browser does not support the audio tag.
                </audio>
              ) : (
                <div className="text-center">
                  <div className="text-6xl mb-4"><UiIcon name="file" /></div>
                  <p className="text-muted mb-4">{previewModal.file_name}</p>
                  <p className="text-sm text-muted">Click download to open PDF</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="bg-canvas border-t p-4 flex gap-3">
              <button
                onClick={() => handleDownload(previewModal)}
                disabled={downloading[previewModal.id]}
                className="min-h-[44px] flex-1 bg-primary text-white font-semibold py-2 rounded hover:bg-primary-hover transition disabled:bg-gray-400"
              >
                {downloading[previewModal.id] ? 'Downloading...' : <><UiIcon name="download" /> Download</>}
              </button>
              <button
                onClick={() => setPreviewModal(null)}
                className="min-h-[44px] flex-1 bg-gray-300 text-ink font-semibold py-2 rounded hover:bg-gray-400 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
