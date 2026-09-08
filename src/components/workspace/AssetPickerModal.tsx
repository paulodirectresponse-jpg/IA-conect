import React, { useState, useRef, useEffect } from 'react';
import { Asset, AssetType, AssetCategory } from '../../types/index.js';
import { assetService } from '../../services/assetService.js';
import { Image as ImageIcon, Video, Music, Upload, X, Search, Check, AlertCircle, Ban, RefreshCw } from 'lucide-react';

interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableAssets: Asset[];
  onSelectAsset: (asset: Asset) => void;
  onAssetUploaded: (newAsset: Asset) => void;
  attachedAssetIds: string[];
  title?: string;
  subtitle?: string;
  defaultTab?: 'LIBRARY' | 'UPLOAD';
}

export const AssetPickerModal: React.FC<AssetPickerModalProps> = ({
  isOpen,
  onClose,
  availableAssets,
  onSelectAsset,
  onAssetUploaded,
  attachedAssetIds,
  title = 'Add reference',
  subtitle = 'Choose from your library or upload new media',
  defaultTab = 'LIBRARY',
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'LIBRARY' | 'UPLOAD'>(defaultTab);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  // Upload Form State
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [assetName, setAssetName] = useState('');
  const [assetAlias, setAssetAlias] = useState('');
  const [assetCategory, setAssetCategory] = useState<AssetCategory>('PRODUCT');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const filteredAssets = availableAssets.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.alias.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = categoryFilter === 'ALL' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setUploadFile(file);
      setUploadError(null);

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      if (file.type.startsWith('image/')) {
        setPreviewUrl(URL.createObjectURL(file));
      } else {
        setPreviewUrl(null);
      }

      // Smart Defaults: auto-populate name & alias if empty
      const cleanName = file.name.replace(/\.[^/.]+$/, '').trim();
      setAssetName((prev) => (prev ? prev : cleanName));

      const cleanAlias = cleanName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
        .slice(0, 16);
      setAssetAlias((prev) => (prev ? prev : cleanAlias || 'asset'));

      if (file.type.startsWith('video/')) {
        setAssetCategory('MOTION');
      } else if (file.type.startsWith('audio/')) {
        setAssetCategory('AUDIO_REFERENCE');
      } else {
        setAssetCategory('PRODUCT');
      }
    }
  };

  const handleCancelUpload = () => {
    if (activeTaskRef.current) {
      activeTaskRef.current.cancel();
      activeTaskRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadError('Upload cancelado.');
  };

  const handleUploadSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    try {
      const created = await assetService.uploadAsset({
        file: uploadFile,
        name: assetName.trim() || uploadFile.name,
        alias: assetAlias.trim() || undefined,
        category: assetCategory,
        onProgress: (p) => setUploadProgress(p),
        onTaskReady: (task) => {
          activeTaskRef.current = task;
        },
      });

      activeTaskRef.current = null;
      onAssetUploaded(created);
      onSelectAsset(created);
      onClose();
    } catch (err: any) {
      console.error('[AssetPickerModal] Upload error caught:', err);
      setUploadError(err.message || 'Falha ao enviar o arquivo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in">
      <div
        id="modal-asset-picker"
        className="w-full max-w-xl bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden text-zinc-900 flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between bg-white">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">{title}</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher: [ Library ] [ Upload ] */}
        <div className="px-6 pt-3 flex gap-2 border-b border-zinc-100 bg-zinc-50/50 text-xs">
          <button
            type="button"
            id="tab-library-btn"
            onClick={() => setActiveTab('LIBRARY')}
            className={`px-3 py-2 font-medium rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'LIBRARY'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Library ({availableAssets.length})
          </button>
          <button
            type="button"
            id="tab-upload-btn"
            onClick={() => setActiveTab('UPLOAD')}
            className={`px-3 py-2 font-medium rounded-t-lg border-b-2 transition-colors cursor-pointer ${
              activeTab === 'UPLOAD'
                ? 'border-emerald-600 text-emerald-700 bg-white'
                : 'border-transparent text-zinc-500 hover:text-zinc-800'
            }`}
          >
            Upload
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 text-xs">
          {activeTab === 'LIBRARY' ? (
            <div className="space-y-4">
              {/* Search & Filter */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search by name or @alias..."
                    className="w-full pl-8 pr-3 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-900 text-xs focus:outline-none focus:border-zinc-400 placeholder:text-zinc-400"
                  />
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-700 text-xs focus:outline-none focus:border-zinc-400"
                >
                  <option value="ALL">All categories</option>
                  <option value="PRODUCT">Products</option>
                  <option value="CHARACTER">Characters</option>
                  <option value="ENVIRONMENT">Environments</option>
                  <option value="STYLE_REFERENCE">Style</option>
                  <option value="MOTION_REFERENCE">Motion</option>
                  <option value="AUDIO_REFERENCE">Audio</option>
                </select>
              </div>

              {/* Grid of assets */}
              {filteredAssets.length === 0 ? (
                <div className="text-center py-12 text-zinc-400">
                  <p>No references found.</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('UPLOAD')}
                    className="mt-2 text-emerald-600 hover:text-emerald-700 font-medium cursor-pointer"
                  >
                    Upload your first file
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {filteredAssets.map((asset) => {
                    const isAlreadyAttached = attachedAssetIds.includes(asset.asset_id);

                    return (
                      <div
                        key={asset.asset_id}
                        id={`picker-asset-${asset.asset_id}`}
                        onClick={() => {
                          onSelectAsset(asset);
                          onClose();
                        }}
                        className={`group relative p-2 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                          isAlreadyAttached
                            ? 'bg-zinc-50 border-zinc-200 opacity-60'
                            : 'bg-white border-zinc-200 hover:border-emerald-500 hover:shadow-2xs'
                        }`}
                      >
                        {/* Media Thumbnail */}
                        <div className="w-full h-24 rounded-lg bg-zinc-100 border border-zinc-100 overflow-hidden flex items-center justify-center relative mb-2">
                          {asset.thumbnail_url || asset.public_url ? (
                            <img
                              src={asset.thumbnail_url || asset.public_url}
                              alt={asset.name}
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : asset.type === 'VIDEO' ? (
                            <Video className="w-6 h-6 text-sky-500" />
                          ) : asset.type === 'AUDIO' ? (
                            <Music className="w-6 h-6 text-emerald-500" />
                          ) : (
                            <ImageIcon className="w-6 h-6 text-amber-500" />
                          )}

                          {isAlreadyAttached && (
                            <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-white text-emerald-700 text-[9px] font-medium border border-emerald-300 shadow-2xs flex items-center gap-1">
                              <Check className="w-2.5 h-2.5" />
                              <span>Attached</span>
                            </span>
                          )}
                        </div>

                        {/* Title & Alias */}
                        <div>
                          <p className="font-mono text-emerald-700 font-semibold text-xs truncate">
                            @{asset.alias}
                          </p>
                          <p className="text-zinc-600 text-[11px] truncate mt-0.5">{asset.name}</p>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-100 text-zinc-500 font-medium">
                              {asset.category}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Upload Tab */
            <form onSubmit={handleUploadSubmit} className="space-y-4">
              {/* Drop area with immediate preview */}
              <div
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`border-2 border-dashed ${
                  uploading
                    ? 'border-zinc-200 opacity-60 cursor-not-allowed bg-zinc-50'
                    : 'border-zinc-200 hover:border-emerald-500 hover:bg-emerald-50/20 cursor-pointer bg-zinc-50/60'
                } rounded-2xl p-5 text-center transition-colors`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept="image/*,video/*,audio/*"
                  disabled={uploading}
                  className="hidden"
                />

                {previewUrl ? (
                  <div className="flex items-center gap-4 text-left">
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className="w-18 h-18 object-cover rounded-xl border border-zinc-200 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-zinc-900 truncate text-xs">{uploadFile?.name}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        {uploadFile ? (uploadFile.size / (1024 * 1024)).toFixed(2) : 0} MB • Image
                      </p>
                      <p className="text-[11px] text-emerald-700 font-mono mt-1">
                        @{assetAlias || 'auto_alias'}
                      </p>
                      {!uploading && (
                        <span className="text-[10px] text-zinc-400 hover:text-zinc-600 mt-1 inline-block">
                          Click to change file
                        </span>
                      )}
                    </div>
                  </div>
                ) : uploadFile ? (
                  <div>
                    <Upload className="w-6 h-6 text-emerald-600 mx-auto mb-1.5" />
                    <p className="font-medium text-zinc-900 text-xs">{uploadFile.name}</p>
                    <p className="text-[11px] text-zinc-500 mt-0.5">
                      {(uploadFile.size / (1024 * 1024)).toFixed(2)} MB • Click to change file
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                    <p className="font-medium text-zinc-700">Drop or click to select file</p>
                    <p className="text-[11px] text-zinc-400 mt-1">
                      Images (up to 25 MB), Videos (up to 500 MB), Audios (up to 100 MB)
                    </p>
                  </div>
                )}
              </div>

              {uploadFile && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-zinc-700 font-medium mb-1">
                      Name <span className="text-zinc-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={assetName}
                      disabled={uploading}
                      onChange={(e) => setAssetName(e.target.value)}
                      placeholder={uploadFile.name}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-900 text-xs focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="block text-zinc-700 font-medium mb-1">
                      Alias (<strong className="text-emerald-700 font-mono">@alias</strong>){' '}
                      <span className="text-zinc-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={assetAlias}
                      disabled={uploading}
                      onChange={(e) => setAssetAlias(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      placeholder="generated automatically"
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 font-mono text-emerald-700 text-xs focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-zinc-700 font-medium mb-1">
                      Category <span className="text-zinc-400 font-normal">(optional)</span>
                    </label>
                    <select
                      value={assetCategory}
                      disabled={uploading}
                      onChange={(e) => setAssetCategory(e.target.value as AssetCategory)}
                      className="w-full bg-white border border-zinc-200 rounded-xl px-3 py-2 text-zinc-800 text-xs focus:outline-none focus:border-emerald-600 disabled:opacity-50"
                    >
                      <option value="PRODUCT">Product (preserve logo and geometry)</option>
                      <option value="CHARACTER">Character (preserve face and features)</option>
                      <option value="ENVIRONMENT">Environment / Setting</option>
                      <option value="STYLE_REFERENCE">Style reference</option>
                      <option value="MOTION_REFERENCE">Motion reference</option>
                      <option value="AUDIO_REFERENCE">Audio reference</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Requirement 41: While uploading, show "Uploading 32%" + progress bar */}
              {uploading && (
                <div className="space-y-2 p-3 bg-zinc-50 border border-zinc-200 rounded-xl">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-zinc-700 font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      Uploading {uploadProgress}%
                    </span>
                    <span className="font-mono text-emerald-700 font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="w-full h-2 bg-zinc-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-600 transition-all duration-150 ease-out"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleCancelUpload}
                      className="text-xs text-red-600 hover:text-red-700 px-2 py-1 rounded bg-red-50 border border-red-200 flex items-center gap-1 cursor-pointer"
                    >
                      <Ban className="w-3 h-3" />
                      <span>Cancel</span>
                    </button>
                  </div>
                </div>
              )}

              {/* If error: stop immediately, show error message and Try again button (no eternal spinner) */}
              {uploadError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-start justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-red-600" />
                    <div>
                      <p className="font-semibold text-red-900">Upload failed</p>
                      <p className="text-[11px] text-red-700 mt-0.5 leading-relaxed">{uploadError}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleUploadSubmit()}
                    className="px-2.5 py-1 rounded-lg bg-white border border-red-300 text-red-700 hover:bg-red-50 font-medium flex items-center gap-1 shrink-0 cursor-pointer text-xs"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Try again</span>
                  </button>
                </div>
              )}

              {/* Requirement 34 footer buttons: [ Cancel ] [ Upload & attach ] */}
              <div className="pt-3 flex justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 text-xs font-medium disabled:opacity-40 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading || !uploadFile}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-medium text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{uploading ? `Uploading ${uploadProgress}%` : 'Upload & attach'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
