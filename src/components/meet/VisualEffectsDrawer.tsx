'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Sparkles,
  Sliders,
  Image as ImageIcon,
  Film,
  Smile,
  Focus,
  Check,
  RotateCcw,
  Eye,
  Camera,
} from 'lucide-react';
import {
  VisualEffectsConfig,
  DEFAULT_EFFECTS_CONFIG,
  BACKGROUND_IMAGES,
  BACKGROUND_VIDEOS,
  FACE_FILTERS,
  BlurLevel,
  BackgroundImageId,
  BackgroundVideoId,
  FaceFilterId,
  getVisualEffectsEngine,
} from '@/lib/visualEffectsEngine';

interface VisualEffectsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  rawStream: MediaStream | null;
  onApplyEffects: (stream: MediaStream, config: VisualEffectsConfig) => void;
  onResetEffects: () => void;
  activeConfig: VisualEffectsConfig;
  isApplied: boolean;
}

export function VisualEffectsDrawer({
  isOpen,
  onClose,
  rawStream,
  onApplyEffects,
  onResetEffects,
  activeConfig,
  isApplied,
}: VisualEffectsDrawerProps) {
  const [currentTab, setCurrentTab] = useState<'blur' | 'images' | 'videos' | 'filters' | 'framing'>('blur');
  const [config, setConfig] = useState<VisualEffectsConfig>(activeConfig);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Sync with active config whenever drawer opens
  useEffect(() => {
    if (isOpen) {
      setConfig({ ...activeConfig });
      const engine = getVisualEffectsEngine();
      engine.setConfig(activeConfig);
      if (rawStream) {
        engine.start(rawStream);
      }
    }
  }, [isOpen, activeConfig, rawStream]);

  // Update engine whenever local config changes
  useEffect(() => {
    if (!isOpen) return;
    const engine = getVisualEffectsEngine();
    engine.setConfig(config);
  }, [config, isOpen]);

  // Live real-time preview canvas loop inside the drawer
  useEffect(() => {
    if (!isOpen) return;
    const engine = getVisualEffectsEngine();

    const loop = () => {
      const sourceCanvas = engine.getCanvas();
      const targetCanvas = previewCanvasRef.current;
      if (sourceCanvas && targetCanvas) {
        if (targetCanvas.width !== sourceCanvas.width || targetCanvas.height !== sourceCanvas.height) {
          targetCanvas.width = sourceCanvas.width;
          targetCanvas.height = sourceCanvas.height;
        }
        const ctx = targetCanvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
          ctx.drawImage(sourceCanvas, 0, 0);
        }
      }
      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleApply = () => {
    const engine = getVisualEffectsEngine();
    if (rawStream) {
      const processedStream = engine.start(rawStream);
      onApplyEffects(processedStream, config);
    }
  };

  const handleReset = () => {
    setConfig({ ...DEFAULT_EFFECTS_CONFIG });
    const engine = getVisualEffectsEngine();
    engine.setConfig(DEFAULT_EFFECTS_CONFIG);
    onResetEffects();
  };

  const handleSetBlur = (level: BlurLevel, radius = 0) => {
    setConfig((prev) => ({
      ...prev,
      blurLevel: level,
      blurRadius: radius,
      backgroundImage: 'none',
      backgroundVideo: 'none',
    }));
  };

  const handleSelectImage = (id: BackgroundImageId) => {
    setConfig((prev) => ({
      ...prev,
      backgroundImage: id,
      backgroundVideo: 'none',
      blurLevel: id === 'none' ? 'none' : 'none',
    }));
  };

  const handleSelectVideo = (id: BackgroundVideoId) => {
    setConfig((prev) => ({
      ...prev,
      backgroundVideo: id,
      backgroundImage: 'none',
      blurLevel: 'none',
    }));
  };

  const handleSelectFilter = (id: FaceFilterId) => {
    setConfig((prev) => ({
      ...prev,
      faceFilter: id,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950/60 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/25">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Visual Effects & Filters</h3>
              <p className="text-xs text-slate-400">Google Meet-style virtual backgrounds, studio blur & AR filters</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body: Split Preview + Controls */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          {/* Left / Top: Live Interactive Preview */}
          <div className="lg:col-span-6 bg-slate-950/90 p-4 sm:p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r border-slate-800 relative">
            <div className="relative w-full max-w-md aspect-video rounded-2xl sm:rounded-3xl bg-black border-2 border-slate-700/80 overflow-hidden shadow-2xl group flex items-center justify-center">
              {rawStream ? (
                <canvas ref={previewCanvasRef} className="w-full h-full object-contain bg-black" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-500 space-y-2">
                  <Camera className="w-10 h-10 stroke-1" />
                  <span className="text-xs">Camera is turned off</span>
                </div>
              )}

              {/* Live Preview Watermark Badge */}
              <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-bold text-blue-400 border border-blue-500/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>Live Studio Preview</span>
              </div>

              {/* Auto-Framing Centering Target Indicator */}
              {config.autoFraming && (
                <div className="absolute top-3 right-3 bg-indigo-950/80 backdrop-blur-md px-2.5 py-1 rounded-xl text-[10px] font-bold text-indigo-300 border border-indigo-500/30 flex items-center gap-1">
                  <Focus className="w-3 h-3 text-indigo-400" />
                  <span>Center Stage Active</span>
                </div>
              )}
            </div>

            {/* Bottom Controls Bar for Preview */}
            <div className="w-full max-w-md mt-4 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400 flex items-center gap-1.5">
                <Eye className="w-4 h-4 text-slate-400" />
                <span>Preview before applying to call</span>
              </div>

              <button
                type="button"
                onClick={handleApply}
                className={`px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 flex items-center gap-2 ${
                  isApplied
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                }`}
              >
                {isApplied ? <Check className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
                <span>{isApplied ? 'Update Call Effects' : 'Apply to Meeting'}</span>
              </button>
            </div>
          </div>

          {/* Right / Bottom: Category Tabs & Selectors */}
          <div className="lg:col-span-6 flex flex-col min-h-0 bg-slate-900">
            {/* Category Tab Bar */}
            <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-800 overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setCurrentTab('blur')}
                className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  currentTab === 'blur'
                    ? 'text-blue-400 border-blue-500 bg-slate-800/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Background Blur</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('images')}
                className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  currentTab === 'images'
                    ? 'text-blue-400 border-blue-500 bg-slate-800/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Images (5)</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('videos')}
                className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  currentTab === 'videos'
                    ? 'text-blue-400 border-blue-500 bg-slate-800/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Film className="w-3.5 h-3.5" />
                <span>Videos (5)</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('filters')}
                className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  currentTab === 'filters'
                    ? 'text-blue-400 border-blue-500 bg-slate-800/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Smile className="w-3.5 h-3.5" />
                <span>Face Filters (5)</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentTab('framing')}
                className={`px-3 py-2 rounded-t-xl text-xs font-bold transition-colors flex items-center gap-1.5 border-b-2 whitespace-nowrap ${
                  currentTab === 'framing'
                    ? 'text-blue-400 border-blue-500 bg-slate-800/40'
                    : 'text-slate-400 border-transparent hover:text-slate-200'
                }`}
              >
                <Focus className="w-3.5 h-3.5" />
                <span>Center Stage</span>
              </button>
            </div>

            {/* Tab Pane Body */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              {/* TAB 1: BACKGROUND BLUR */}
              {currentTab === 'blur' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Studio Background Blur</h4>
                    <p className="text-xs text-slate-400">
                      Keep your room private and focus attention on you with depth-of-field bokeh.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { level: 'none', label: 'Off', desc: 'No blur' },
                      { level: 'subtle', label: 'Subtle', desc: 'Light 8px' },
                      { level: 'medium', label: 'Medium', desc: 'Standard 16px' },
                      { level: 'deep', label: 'Studio Bokeh', desc: 'Heavy 30px' },
                    ].map((item) => (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => handleSetBlur(item.level as BlurLevel)}
                        className={`p-3 rounded-2xl border text-left transition-all active:scale-95 ${
                          config.blurLevel === item.level && config.backgroundImage === 'none' && config.backgroundVideo === 'none'
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/10'
                            : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold leading-tight">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Fine-Tuning Slider */}
                  <div className="bg-slate-800/40 rounded-2xl p-3.5 border border-slate-700/60 space-y-2 mt-4">
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-300">Custom Blur Radius</span>
                      <span className="text-blue-400 font-bold">{config.blurRadius || (config.blurLevel === 'deep' ? 30 : config.blurLevel === 'medium' ? 16 : config.blurLevel === 'subtle' ? 8 : 0)} px</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="35"
                      step="1"
                      value={config.blurRadius || (config.blurLevel === 'deep' ? 30 : config.blurLevel === 'medium' ? 16 : config.blurLevel === 'subtle' ? 8 : 0)}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleSetBlur(val > 0 ? 'medium' : 'none', val);
                      }}
                      className="w-full accent-blue-500 cursor-pointer"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: VIRTUAL BACKGROUND IMAGES (5) */}
              {currentTab === 'images' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">5 High-Definition Backgrounds</h4>
                    <p className="text-xs text-slate-400">
                      Transport yourself to professional offices, libraries, or modern studios.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {BACKGROUND_IMAGES.map((img) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => handleSelectImage(img.id)}
                        className={`group relative aspect-video rounded-2xl overflow-hidden border-2 transition-all active:scale-95 ${
                          config.backgroundImage === img.id
                            ? 'border-blue-500 shadow-xl shadow-blue-500/20 ring-2 ring-blue-500/40'
                            : 'border-slate-700/70 hover:border-slate-500 bg-slate-800/60'
                        }`}
                      >
                        {img.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.thumbnail}
                            alt={img.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs font-bold">
                            None (Off)
                          </div>
                        )}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent p-2 text-left">
                          <span className="text-[11px] font-bold text-white leading-none truncate block">
                            {img.name}
                          </span>
                        </div>
                        {config.backgroundImage === img.id && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center shadow-lg">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 3: ANIMATED VIDEO BACKGROUNDS (5) */}
              {currentTab === 'videos' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">5 Animated Motion Backgrounds</h4>
                    <p className="text-xs text-slate-400">
                      Live animated loops that add ambient energy without distracting your peers.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {BACKGROUND_VIDEOS.map((vid) => (
                      <button
                        key={vid.id}
                        type="button"
                        onClick={() => handleSelectVideo(vid.id)}
                        className={`p-3.5 rounded-2xl border text-left transition-all active:scale-95 flex flex-col justify-between ${
                          config.backgroundVideo === vid.id
                            ? 'bg-blue-600/20 border-blue-500 shadow-xl shadow-blue-500/20'
                            : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-2">
                          <span className="text-xs font-bold text-white">{vid.name}</span>
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-blue-900/60 text-blue-300 border border-blue-500/30">
                            {vid.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-snug">{vid.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: SNAPCHAT-STYLE AR FACE FILTERS (5) */}
              {currentTab === 'filters' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">5 Snapchat-Style AR Filters</h4>
                    <p className="text-xs text-slate-400">
                      Fun augmented reality accessories, glowing visors, and celebration effects.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {FACE_FILTERS.map((filter) => (
                      <button
                        key={filter.id}
                        type="button"
                        onClick={() => handleSelectFilter(filter.id)}
                        className={`p-3.5 rounded-2xl border text-center transition-all active:scale-95 flex flex-col items-center justify-center space-y-1.5 ${
                          config.faceFilter === filter.id
                            ? 'bg-blue-600/20 border-blue-500 shadow-xl shadow-blue-500/20'
                            : 'bg-slate-800/50 border-slate-700/60 hover:bg-slate-800'
                        }`}
                      >
                        <span className="text-2xl">{filter.emoji}</span>
                        <span className="text-xs font-bold text-white leading-tight">{filter.name}</span>
                        <span className="text-[10px] text-slate-400 leading-tight">{filter.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 5: CENTER STAGE (AUTO-FRAMING) */}
              {currentTab === 'framing' && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <h4 className="text-sm font-bold text-white mb-1">Center Stage (Auto-Framing)</h4>
                    <p className="text-xs text-slate-400">
                      Automatically detects your body position and smoothly crops & centers the camera on you as you move.
                    </p>
                  </div>

                  <div className="bg-slate-800/50 rounded-2xl p-4 border border-slate-700/70 flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Focus className="w-4 h-4 text-blue-400" />
                        <span className="text-sm font-bold text-white">Keep Human in Centre</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Dynamic centroid tracking reframes the camera smoothly with Apple/Google Meet-style linear smoothing.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, autoFraming: !prev.autoFraming }))}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        config.autoFraming ? 'bg-blue-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          config.autoFraming ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
