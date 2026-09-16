/**
 * JUMMP Meet - Visual Effects Engine
 * 
 * Google Meet-level Visual Effects Studio:
 * - Real-time Human Segmentation & Alpha Masking
 * - Background Blur with adjustable intensity
 * - 5 Virtual Background Images (Office, Library, Penthouse, Garden, Studio)
 * - 5 Procedural Animated Video Backgrounds (Cyber City, Ocean Waves, Aurora, Rainy Window, Golden Bokeh)
 * - 5 Snapchat-Style Augmented Reality Face Filters
 * - "Center Stage" Auto-Framing with Exponential Lerp Smoothing
 * - Hardware-accelerated 45 FPS WebRTC Stream Generation
 */

export type BlurLevel = 'none' | 'subtle' | 'medium' | 'deep';

export type BackgroundImageId = 'none' | 'office' | 'library' | 'penthouse' | 'garden' | 'cyberpunk';

export type BackgroundVideoId = 'none' | 'neon-city' | 'ocean-waves' | 'cosmic-aurora' | 'rainy-bokeh' | 'golden-particles';

export type FaceFilterId = 'none' | 'cyber-visor' | 'golden-aviators' | 'kitty-ears' | 'angel-halo' | 'party-confetti';

export interface VisualEffectsConfig {
  autoFraming: boolean; // Center Stage
  blurLevel: BlurLevel;
  blurRadius: number; // custom blur in px (0-35)
  backgroundImage: BackgroundImageId;
  backgroundVideo: BackgroundVideoId;
  faceFilter: FaceFilterId;
}

export const DEFAULT_EFFECTS_CONFIG: VisualEffectsConfig = {
  autoFraming: false,
  blurLevel: 'none',
  blurRadius: 0,
  backgroundImage: 'none',
  backgroundVideo: 'none',
  faceFilter: 'none',
};

// Curated High-Definition Background Images
export const BACKGROUND_IMAGES: { id: BackgroundImageId; name: string; thumbnail: string; url: string }[] = [
  {
    id: 'none',
    name: 'None',
    thumbnail: '',
    url: '',
  },
  {
    id: 'office',
    name: 'Executive Office',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=320&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&auto=format&fit=crop&q=85',
  },
  {
    id: 'library',
    name: 'Classic Library',
    thumbnail: 'https://images.unsplash.com/photo-1507842229452-772d139c8e3b?w=320&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1507842229452-772d139c8e3b?w=1920&auto=format&fit=crop&q=85',
  },
  {
    id: 'penthouse',
    name: 'City Penthouse',
    thumbnail: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=320&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1920&auto=format&fit=crop&q=85',
  },
  {
    id: 'garden',
    name: 'Sunset Terrace',
    thumbnail: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=320&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1920&auto=format&fit=crop&q=85',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Studio',
    thumbnail: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=320&auto=format&fit=crop&q=80',
    url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1920&auto=format&fit=crop&q=85',
  },
];

// 5 Animated Video / Motion Backgrounds
export const BACKGROUND_VIDEOS: { id: BackgroundVideoId; name: string; badge: string; description: string }[] = [
  { id: 'none', name: 'None', badge: 'OFF', description: 'Standard background' },
  { id: 'neon-city', name: 'Neon Cyber City', badge: 'CYBER', description: 'Futuristic glowing skyline with laser grid' },
  { id: 'ocean-waves', name: 'Calm Ocean Coast', badge: 'NATURE', description: 'Relaxing rolling turquoise waves and sunset' },
  { id: 'cosmic-aurora', name: 'Cosmic Starfield', badge: 'SPACE', description: 'Twinkling galaxy with Aurora Borealis' },
  { id: 'rainy-bokeh', name: 'Rainy Window', badge: 'COZY', description: 'Warm coffee shop bokeh with falling rain' },
  { id: 'golden-particles', name: 'Golden Particle Flow', badge: 'LUXE', description: 'Floating ambient bokeh dust particles' },
];

// 5 Snapchat-Style AR Face Filters
export const FACE_FILTERS: { id: FaceFilterId; name: string; emoji: string; description: string }[] = [
  { id: 'none', name: 'None', emoji: '🚫', description: 'No face filter' },
  { id: 'cyber-visor', name: 'Neon Cyber Visor', emoji: '🥽', description: 'Futuristic glowing visor with scanline HUD' },
  { id: 'golden-aviators', name: 'Golden Aviators', emoji: '🕶️', description: 'Luxury reflective metallic pilot sunglasses' },
  { id: 'kitty-ears', name: 'Cute Kitty Ears', emoji: '🐱', description: 'Fluffy animated cat ears and sweet whiskers' },
  { id: 'angel-halo', name: 'Angelic Halo & Stars', emoji: '😇', description: 'Glowing golden halo with floating star sparkles' },
  { id: 'party-confetti', name: 'Party Confetti', emoji: '🎉', description: 'Festive fluttering confetti & party vibes' },
];

export class VisualEffectsEngine {
  private videoElement: HTMLVideoElement;
  private canvasElement: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private segmenter: any = null;
  private isSegmenterLoaded = false;
  private isSegmenterLoading = false;
  private animFrameId: number | null = null;
  private config: VisualEffectsConfig = { ...DEFAULT_EFFECTS_CONFIG };
  private outputStream: MediaStream | null = null;

  // Cached Background Images
  private imageCache: Map<string, HTMLImageElement> = new Map();

  // Procedural Animation Timers & Particle States
  private animTick = 0;
  private particles: Array<{ x: number; y: number; size: number; speed: number; alpha: number; color?: string }> = [];

  // Auto-Framing (Center Stage) State with Exponential Smoothing (Lerp)
  private currentCrop = { x: 0, y: 0, w: 1, h: 1 };
  private targetCrop = { x: 0, y: 0, w: 1, h: 1 };
  private lerpAlpha = 0.07; // Smooth camera panning rate

  // Latest segmentation mask canvas
  private maskCanvas: HTMLCanvasElement;
  private maskCtx: CanvasRenderingContext2D;

  constructor() {
    this.videoElement = document.createElement('video');
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    this.canvasElement = document.createElement('canvas');
    this.canvasElement.width = 1280;
    this.canvasElement.height = 720;
    this.ctx = this.canvasElement.getContext('2d', { alpha: false, desynchronized: true })!;

    this.maskCanvas = document.createElement('canvas');
    this.maskCanvas.width = 1280;
    this.maskCanvas.height = 720;
    this.maskCtx = this.maskCanvas.getContext('2d')!;

    this.initParticles();
    this.preloadBackgroundImages();
  }

  private initParticles() {
    this.particles = [];
    for (let i = 0; i < 70; i++) {
      this.particles.push({
        x: Math.random(),
        y: Math.random(),
        size: Math.random() * 6 + 2,
        speed: Math.random() * 0.003 + 0.001,
        alpha: Math.random() * 0.7 + 0.3,
      });
    }
  }

  private preloadBackgroundImages() {
    BACKGROUND_IMAGES.forEach((bg) => {
      if (bg.url) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.src = bg.url;
        this.imageCache.set(bg.id, img);
      }
    });
  }

  /**
   * Dynamically loads Google MediaPipe SelfieSegmentation on demand
   */
  public async loadMediaPipe(): Promise<boolean> {
    if (this.isSegmenterLoaded) return true;
    if (this.isSegmenterLoading) return false;
    this.isSegmenterLoading = true;

    return new Promise((resolve) => {
      if (typeof window !== 'undefined' && (window as any).SelfieSegmentation) {
        this.initSegmenterInstance(resolve);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
      script.async = true;
      script.onload = () => {
        this.initSegmenterInstance(resolve);
      };
      script.onerror = () => {
        console.warn('Failed to load MediaPipe Selfie Segmentation CDN. Fallback mode active.');
        this.isSegmenterLoading = false;
        resolve(false);
      };
      document.head.appendChild(script);
    });
  }

  private initSegmenterInstance(resolve: (value: boolean) => void) {
    try {
      const SelfieSegmentationClass = (window as any).SelfieSegmentation;
      if (!SelfieSegmentationClass) {
        this.isSegmenterLoading = false;
        resolve(false);
        return;
      }

      this.segmenter = new SelfieSegmentationClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });

      this.segmenter.setOptions({
        modelSelection: 1, // 1 = landscape/full quality model (Google Meet style)
        selfieMode: true,
      });

      this.segmenter.onResults((results: any) => {
        this.onSegmentationResults(results);
      });

      this.isSegmenterLoaded = true;
      this.isSegmenterLoading = false;
      resolve(true);
    } catch (err) {
      console.warn('Error initializing MediaPipe instance:', err);
      this.isSegmenterLoading = false;
      resolve(false);
    }
  }

  private onSegmentationResults(results: any) {
    if (!results.segmentationMask) return;
    const w = this.canvasElement.width;
    const h = this.canvasElement.height;

    this.maskCanvas.width = w;
    this.maskCanvas.height = h;
    this.maskCtx.save();
    this.maskCtx.clearRect(0, 0, w, h);
    this.maskCtx.drawImage(results.segmentationMask, 0, 0, w, h);
    this.maskCtx.restore();
  }

  /**
   * Starts processing a given camera MediaStream
   */
  public start(sourceStream: MediaStream): MediaStream {
    this.stop();
    this.videoElement.srcObject = sourceStream;
    this.videoElement.play().catch(() => {});

    // Ensure segmenter is ready in background
    this.loadMediaPipe().catch(() => {});

    // Generate output stream captured at 45 FPS
    this.outputStream = this.canvasElement.captureStream(45);

    // Add audio track from camera stream to output stream
    const audioTrack = sourceStream.getAudioTracks()[0];
    if (audioTrack && this.outputStream) {
      this.outputStream.addTrack(audioTrack);
    }

    this.renderLoop();
    return this.outputStream;
  }

  public setConfig(newConfig: Partial<VisualEffectsConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): VisualEffectsConfig {
    return { ...this.config };
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvasElement;
  }

  public stop() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
    }
  }

  private renderLoop = async () => {
    if (this.videoElement.readyState >= 2) {
      const vidWidth = this.videoElement.videoWidth || 1280;
      const vidHeight = this.videoElement.videoHeight || 720;

      if (this.canvasElement.width !== vidWidth || this.canvasElement.height !== vidHeight) {
        this.canvasElement.width = vidWidth;
        this.canvasElement.height = vidHeight;
      }

      // Send to segmenter if loaded
      if (this.isSegmenterLoaded && this.segmenter) {
        try {
          await this.segmenter.send({ image: this.videoElement });
        } catch {}
      }

      this.renderFrame();
    }

    this.animTick++;
    this.animFrameId = requestAnimationFrame(this.renderLoop);
  };

  private renderFrame() {
    const ctx = this.ctx;
    const w = this.canvasElement.width;
    const h = this.canvasElement.height;

    // 1. Calculate Auto-Framing (Center Stage) Viewport Crop
    let sx = 0;
    let sy = 0;
    let sw = w;
    let sh = h;

    if (this.config.autoFraming) {
      this.updateCenterStageTarget(w, h);
      // Lerp interpolation
      this.currentCrop.x += (this.targetCrop.x - this.currentCrop.x) * this.lerpAlpha;
      this.currentCrop.y += (this.targetCrop.y - this.currentCrop.y) * this.lerpAlpha;
      this.currentCrop.w += (this.targetCrop.w - this.currentCrop.w) * this.lerpAlpha;
      this.currentCrop.h += (this.targetCrop.h - this.currentCrop.h) * this.lerpAlpha;

      sx = this.currentCrop.x * w;
      sy = this.currentCrop.y * h;
      sw = this.currentCrop.w * w;
      sh = this.currentCrop.h * h;
    } else {
      // Smooth reset back to 100% full view
      this.currentCrop.x += (0 - this.currentCrop.x) * 0.1;
      this.currentCrop.y += (0 - this.currentCrop.y) * 0.1;
      this.currentCrop.w += (1 - this.currentCrop.w) * 0.1;
      this.currentCrop.h += (1 - this.currentCrop.h) * 0.1;
      sx = this.currentCrop.x * w;
      sy = this.currentCrop.y * h;
      sw = this.currentCrop.w * w;
      sh = this.currentCrop.h * h;
    }

    // Check if background replacement or blur is active
    const hasEffect =
      this.config.blurLevel !== 'none' ||
      this.config.backgroundImage !== 'none' ||
      this.config.backgroundVideo !== 'none';

    if (hasEffect && this.isSegmenterLoaded) {
      // -------------------------------------------------------------
      // COMPOSITING PASS: Background Layer + Segmented Person
      // -------------------------------------------------------------
      ctx.save();
      ctx.clearRect(0, 0, w, h);

      // A. DRAW BACKGROUND
      if (this.config.backgroundVideo !== 'none') {
        this.renderAnimatedVideoBackground(ctx, w, h);
      } else if (this.config.backgroundImage !== 'none') {
        this.renderImageBackground(ctx, w, h);
      } else if (this.config.blurLevel !== 'none') {
        this.renderBlurredBackground(ctx, w, h, sx, sy, sw, sh);
      }

      // B. DRAW PERSON (FOREGROUND MASKING)
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = w;
      tempCanvas.height = h;
      const tempCtx = tempCanvas.getContext('2d')!;

      // Draw original camera feed
      tempCtx.drawImage(this.videoElement, sx, sy, sw, sh, 0, 0, w, h);

      // Cut out background using segmentation mask
      tempCtx.globalCompositeOperation = 'destination-in';
      tempCtx.drawImage(this.maskCanvas, 0, 0, w, h);

      // Blend person over chosen background
      ctx.drawImage(tempCanvas, 0, 0);
      ctx.restore();
    } else {
      // Standard raw video render (with auto-framing if enabled)
      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(this.videoElement, sx, sy, sw, sh, 0, 0, w, h);
      ctx.restore();
    }

    // 2. Snapchat-Style AR Face Filter Overlay
    if (this.config.faceFilter !== 'none') {
      this.renderFaceFilter(ctx, w, h);
    }
  }

  // =========================================================================
  // CENTER STAGE (AUTO-FRAMING) TARGET ESTIMATION
  // =========================================================================
  private updateCenterStageTarget(w: number, h: number) {
    const targetW = 0.78;
    const targetH = 0.78;

    let centerX = 0.5;
    let centerY = 0.45;

    try {
      if (this.isSegmenterLoaded && this.animTick % 6 === 0) {
        const sampleW = 64;
        const sampleH = 36;
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = sampleW;
        sampleCanvas.height = sampleH;
        const sCtx = sampleCanvas.getContext('2d')!;
        sCtx.drawImage(this.maskCanvas, 0, 0, sampleW, sampleH);
        const data = sCtx.getImageData(0, 0, sampleW, sampleH).data;

        let sumX = 0;
        let sumY = 0;
        let count = 0;

        for (let y = 0; y < sampleH; y++) {
          for (let x = 0; x < sampleW; x++) {
            const alpha = data[(y * sampleW + x) * 4 + 3];
            if (alpha > 128) {
              sumX += x;
              sumY += y;
              count++;
            }
          }
        }

        if (count > 50) {
          centerX = sumX / count / sampleW;
          centerY = sumY / count / sampleH;
        }
      }
    } catch {}

    const cropX = Math.max(0, Math.min(1 - targetW, centerX - targetW / 2));
    const cropY = Math.max(0, Math.min(1 - targetH, centerY - targetH / 2));

    this.targetCrop = { x: cropX, y: cropY, w: targetW, h: targetH };
  }

  // =========================================================================
  // BACKGROUND RENDERING HELPERS
  // =========================================================================
  private renderBlurredBackground(
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    sx: number,
    sy: number,
    sw: number,
    sh: number
  ) {
    let blurPx = 16;
    if (this.config.blurLevel === 'subtle') blurPx = 8;
    else if (this.config.blurLevel === 'deep') blurPx = 30;
    if (this.config.blurRadius > 0) blurPx = this.config.blurRadius;

    ctx.save();
    ctx.filter = `blur(${blurPx}px)`;
    ctx.drawImage(this.videoElement, sx, sy, sw, sh, -20, -20, w + 40, h + 40);
    ctx.filter = 'none';
    ctx.restore();
  }

  private renderImageBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const img = this.imageCache.get(this.config.backgroundImage);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, 0, 0, w, h);
    } else {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#1e293b');
      grad.addColorStop(1, '#0f172a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }
  }

  // =========================================================================
  // 5 PROCEDURAL ANIMATED VIDEO BACKGROUNDS
  // =========================================================================
  private renderAnimatedVideoBackground(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const t = this.animTick * 0.02;

    switch (this.config.backgroundVideo) {
      case 'neon-city': {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#090514');
        sky.addColorStop(0.7, '#1b0d3a');
        sky.addColorStop(1, '#3b1263');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = 'rgba(236, 72, 153, 0.35)';
        ctx.lineWidth = 1.5;
        const horizonY = h * 0.65;

        for (let i = -w; i < w * 2; i += 70) {
          ctx.beginPath();
          ctx.moveTo(w / 2, horizonY);
          ctx.lineTo(i + Math.sin(t * 0.5) * 20, h);
          ctx.stroke();
        }

        for (let y = horizonY; y < h; y += (y - horizonY) * 0.35 + 8) {
          const moveY = ((y + (this.animTick % 25)) % (h - horizonY)) + horizonY;
          ctx.beginPath();
          ctx.moveTo(0, moveY);
          ctx.lineTo(w, moveY);
          ctx.stroke();
        }

        ctx.fillStyle = '#080511';
        ctx.fillRect(w * 0.1, horizonY - 120, 80, 120);
        ctx.fillRect(w * 0.22, horizonY - 190, 110, 190);
        ctx.fillRect(w * 0.45, horizonY - 150, 95, 150);
        ctx.fillRect(w * 0.68, horizonY - 210, 130, 210);
        ctx.fillRect(w * 0.85, horizonY - 140, 75, 140);
        break;
      }

      case 'ocean-waves': {
        const sky = ctx.createLinearGradient(0, 0, 0, h);
        sky.addColorStop(0, '#fb923c');
        sky.addColorStop(0.4, '#f43f5e');
        sky.addColorStop(0.7, '#818cf8');
        sky.addColorStop(1, '#0284c7');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#ffedd5';
        ctx.beginPath();
        ctx.arc(w / 2, h * 0.45, 55, 0, Math.PI * 2);
        ctx.fill();

        for (let layer = 0; layer < 3; layer++) {
          ctx.fillStyle = layer === 0 ? 'rgba(14, 116, 144, 0.7)' : layer === 1 ? 'rgba(3, 105, 161, 0.85)' : '#075985';
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let x = 0; x <= w; x += 30) {
            const waveY = h * 0.6 + layer * 35 + Math.sin(x * 0.008 + t * (1.2 + layer * 0.3)) * (14 + layer * 4);
            ctx.lineTo(x, waveY);
          }
          ctx.lineTo(w, h);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }

      case 'cosmic-aurora': {
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, w, h);

        this.particles.forEach((p, idx) => {
          const twinkle = Math.sin(t * 3 + idx) * 0.3 + 0.7;
          ctx.fillStyle = `rgba(255, 255, 255, ${p.alpha * twinkle})`;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.size * 0.4, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < 2; i++) {
          const aurora = ctx.createLinearGradient(0, h * 0.1, w, h * 0.7);
          aurora.addColorStop(0, i === 0 ? 'rgba(34, 197, 94, 0.35)' : 'rgba(168, 85, 247, 0.35)');
          aurora.addColorStop(0.5, i === 0 ? 'rgba(6, 182, 212, 0.4)' : 'rgba(236, 72, 153, 0.3)');
          aurora.addColorStop(1, 'rgba(0,0,0,0)');
          ctx.fillStyle = aurora;

          ctx.beginPath();
          ctx.moveTo(0, h * 0.5);
          for (let x = 0; x <= w; x += 40) {
            const curY = h * 0.3 + Math.sin(x * 0.005 + t * 0.8 + i) * 80 + Math.cos(x * 0.003 - t * 0.5) * 40;
            ctx.lineTo(x, curY);
          }
          ctx.lineTo(w, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
        break;
      }

      case 'rainy-bokeh': {
        const dark = ctx.createLinearGradient(0, 0, w, h);
        dark.addColorStop(0, '#0f172a');
        dark.addColorStop(1, '#020617');
        ctx.fillStyle = dark;
        ctx.fillRect(0, 0, w, h);

        const bokehColors = ['rgba(251, 191, 36, 0.25)', 'rgba(244, 63, 94, 0.2)', 'rgba(56, 189, 248, 0.25)', 'rgba(167, 139, 250, 0.2)'];
        this.particles.forEach((p, idx) => {
          ctx.fillStyle = bokehColors[idx % bokehColors.length];
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.size * 6, 0, Math.PI * 2);
          ctx.fill();
        });

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.lineWidth = 1.2;
        for (let i = 0; i < 45; i++) {
          const rx = (Math.sin(i * 99) * 0.5 + 0.5) * w;
          const ry = ((Math.cos(i * 37) * 0.5 + 0.5 + t * (0.8 + (i % 5) * 0.2)) % 1) * h;
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          ctx.lineTo(rx + 2, ry + 24);
          ctx.stroke();
        }
        break;
      }

      case 'golden-particles': {
        ctx.fillStyle = '#0a0a0f';
        ctx.fillRect(0, 0, w, h);

        this.particles.forEach((p) => {
          p.y -= p.speed * 0.5;
          if (p.y < 0) p.y = 1;

          const grad = ctx.createRadialGradient(p.x * w, p.y * h, 0, p.x * w, p.y * h, p.size * 4);
          grad.addColorStop(0, 'rgba(251, 191, 36, 0.8)');
          grad.addColorStop(0.4, 'rgba(217, 119, 6, 0.4)');
          grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x * w, p.y * h, p.size * 4, 0, Math.PI * 2);
          ctx.fill();
        });
        break;
      }
    }
  }

  // =========================================================================
  // 5 SNAPCHAT-STYLE AR FACE FILTERS
  // =========================================================================
  private renderFaceFilter(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const headX = w * 0.5;
    const headY = h * 0.38;
    const headWidth = w * 0.22;
    const headHeight = h * 0.3;

    ctx.save();

    switch (this.config.faceFilter) {
      case 'cyber-visor': {
        const visorY = headY - 15;
        const visorWidth = headWidth * 1.35;
        const visorHeight = 44;

        ctx.shadowColor = '#06b6d4';
        ctx.shadowBlur = 20;

        const visorGrad = ctx.createLinearGradient(headX - visorWidth / 2, visorY, headX + visorWidth / 2, visorY);
        visorGrad.addColorStop(0, 'rgba(6, 182, 212, 0.85)');
        visorGrad.addColorStop(0.5, 'rgba(236, 72, 153, 0.85)');
        visorGrad.addColorStop(1, 'rgba(6, 182, 212, 0.85)');

        ctx.fillStyle = visorGrad;
        ctx.beginPath();
        ctx.roundRect(headX - visorWidth / 2, visorY - visorHeight / 2, visorWidth, visorHeight, 14);
        ctx.fill();

        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.stroke();

        const scanlineY = visorY - visorHeight / 2 + ((this.animTick * 2) % visorHeight);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(headX - visorWidth / 2 + 8, scanlineY);
        ctx.lineTo(headX + visorWidth / 2 - 8, scanlineY);
        ctx.stroke();
        break;
      }

      case 'golden-aviators': {
        const glassY = headY - 10;
        const lensRadiusX = 40;
        const lensRadiusY = 32;

        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 15;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.moveTo(headX - 60, glassY - 18);
        ctx.lineTo(headX + 60, glassY - 18);
        ctx.stroke();

        [-48, 48].forEach((offset) => {
          const lensGrad = ctx.createLinearGradient(headX + offset - lensRadiusX, glassY, headX + offset + lensRadiusX, glassY);
          lensGrad.addColorStop(0, 'rgba(30, 27, 75, 0.9)');
          lensGrad.addColorStop(0.5, 'rgba(180, 83, 9, 0.85)');
          lensGrad.addColorStop(1, 'rgba(251, 191, 36, 0.9)');

          ctx.fillStyle = lensGrad;
          ctx.beginPath();
          ctx.ellipse(headX + offset, glassY, lensRadiusX, lensRadiusY, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.strokeStyle = '#fbbf24';
          ctx.lineWidth = 3.5;
          ctx.stroke();

          ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.ellipse(headX + offset - 8, glassY - 10, lensRadiusX * 0.45, lensRadiusY * 0.35, -0.3, 0, Math.PI * 0.8);
          ctx.stroke();
        });
        break;
      }

      case 'kitty-ears': {
        const earBaseY = headY - headHeight * 0.65;
        const earSpread = 65;

        [-earSpread, earSpread].forEach((offset, idx) => {
          const sign = idx === 0 ? -1 : 1;
          ctx.fillStyle = '#fda4af';
          ctx.beginPath();
          ctx.moveTo(headX + offset, earBaseY);
          ctx.lineTo(headX + offset + sign * 25, earBaseY - 60);
          ctx.lineTo(headX + offset + sign * 60, earBaseY);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = '#fb7185';
          ctx.beginPath();
          ctx.moveTo(headX + offset + sign * 8, earBaseY - 6);
          ctx.lineTo(headX + offset + sign * 25, earBaseY - 45);
          ctx.lineTo(headX + offset + sign * 45, earBaseY - 6);
          ctx.closePath();
          ctx.fill();
        });

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 2.5;
        const noseY = headY + 38;

        [-8, 0, 8].forEach((angle) => {
          ctx.beginPath();
          ctx.moveTo(headX - 25, noseY + angle);
          ctx.lineTo(headX - 95, noseY + angle * 1.5 - 5);
          ctx.stroke();
        });

        [-8, 0, 8].forEach((angle) => {
          ctx.beginPath();
          ctx.moveTo(headX + 25, noseY + angle);
          ctx.lineTo(headX + 95, noseY + angle * 1.5 - 5);
          ctx.stroke();
        });

        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.ellipse(headX, noseY, 10, 7, 0, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'angel-halo': {
        const haloY = headY - headHeight * 0.72 + Math.sin(this.animTick * 0.08) * 6;

        ctx.shadowColor = '#facc15';
        ctx.shadowBlur = 25;

        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.ellipse(headX, haloY, 80, 26, 0, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        for (let i = 0; i < 4; i++) {
          const angle = (this.animTick * 0.04 + (i * Math.PI) / 2) % (Math.PI * 2);
          const sx = headX + Math.cos(angle) * 110;
          const sy = haloY + Math.sin(angle) * 35;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }

      case 'party-confetti': {
        const colors = ['#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];
        this.particles.slice(0, 45).forEach((p, idx) => {
          const cx = (p.x * w + Math.sin(this.animTick * 0.05 + idx) * 30) % w;
          const cy = ((p.y * h + this.animTick * 2.5 + idx * 10) % h);
          const rot = this.animTick * 0.08 + idx;

          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.fillStyle = colors[idx % colors.length];
          ctx.fillRect(-6, -3, 12, 6);
          ctx.restore();
        });
        break;
      }
    }

    ctx.restore();
  }
}

let engineInstance: VisualEffectsEngine | null = null;

export function getVisualEffectsEngine(): VisualEffectsEngine {
  if (!engineInstance && typeof window !== 'undefined') {
    engineInstance = new VisualEffectsEngine();
  }
  return engineInstance!;
}
