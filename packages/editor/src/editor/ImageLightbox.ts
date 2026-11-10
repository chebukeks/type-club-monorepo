import { getTranslation, Locale } from '../i18n';

function getLocale(): Locale {
  const lang = typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : 'en';
  return (lang === 'ru' ? 'ru' : 'en') as Locale;
}

const ICONS = {
  close: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  fit: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 3 3 3 3 8"></polyline><polyline points="16 3 21 3 21 8"></polyline><polyline points="8 21 3 21 3 16"></polyline><polyline points="16 21 21 21 21 16"></polyline></svg>',
  zoomIn: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
  zoomOut: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
};

const LIGHTBOX_STYLES = `
.type-club-lightbox-slider-container {
  display: inline-flex !important;
  align-items: center !important;
  gap: 8px !important;
  background: rgba(0, 0, 0, 0.45) !important;
  padding: 4px 10px !important;
  border-radius: 10px !important;
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
  box-sizing: border-box !important;
  flex-shrink: 0 !important;
  height: 40px !important;
}

.type-club-lightbox-zoom-step-btn {
  background: transparent !important;
  border: none !important;
  color: #ffffff !important;
  cursor: pointer !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 6px !important;
  transition: background 0.15s ease, opacity 0.15s ease !important;
  flex-shrink: 0 !important;
  user-select: none !important;
  opacity: 0.85 !important;
}

.type-club-lightbox-zoom-step-btn:hover {
  background: rgba(255, 255, 255, 0.2) !important;
  opacity: 1 !important;
}

.type-club-lightbox-zoom-step-btn:active {
  background: rgba(255, 255, 255, 0.3) !important;
  transform: scale(0.92);
}

.type-club-lightbox-zoom-step-btn svg {
  width: 18px !important;
  height: 18px !important;
  stroke: #ffffff !important;
}

.type-club-lightbox-slider {
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  width: 100px !important;
  min-width: 40px !important;
  max-width: 120px !important;
  flex: 1 1 auto !important;
  height: 20px !important;
  background: transparent !important;
  cursor: pointer !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  outline: none !important;
  box-sizing: border-box !important;
}

.type-club-lightbox-slider:focus {
  outline: none !important;
}

.type-club-lightbox-slider::-webkit-slider-runnable-track {
  width: 100% !important;
  height: 6px !important;
  background: rgba(255, 255, 255, 0.35) !important;
  border-radius: 3px !important;
  border: none !important;
  cursor: pointer !important;
  transition: background 0.15s ease !important;
}

.type-club-lightbox-slider:hover::-webkit-slider-runnable-track {
  background: rgba(255, 255, 255, 0.55) !important;
}

.type-club-lightbox-slider::-webkit-slider-thumb {
  -webkit-appearance: none !important;
  appearance: none !important;
  width: 16px !important;
  height: 16px !important;
  border-radius: 50% !important;
  background: #ffffff !important;
  cursor: pointer !important;
  margin-top: -5px !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5) !important;
  border: none !important;
  transition: transform 0.1s ease, background 0.15s ease !important;
}

.type-club-lightbox-slider:hover::-webkit-slider-thumb {
  transform: scale(1.15) !important;
}

.type-club-lightbox-slider:active::-webkit-slider-thumb {
  transform: scale(1.25) !important;
  background: #38bdf8 !important;
}

.type-club-lightbox-slider::-moz-range-track {
  width: 100% !important;
  height: 6px !important;
  background: rgba(255, 255, 255, 0.35) !important;
  border-radius: 3px !important;
  border: none !important;
  cursor: pointer !important;
  transition: background 0.15s ease !important;
}

.type-club-lightbox-slider:hover::-moz-range-track {
  background: rgba(255, 255, 255, 0.55) !important;
}

.type-club-lightbox-slider::-moz-range-thumb {
  width: 16px !important;
  height: 16px !important;
  border-radius: 50% !important;
  background: #ffffff !important;
  cursor: pointer !important;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5) !important;
  border: none !important;
  transition: transform 0.1s ease, background 0.15s ease !important;
}

.type-club-lightbox-slider:hover::-moz-range-thumb {
  transform: scale(1.15) !important;
}

.type-club-lightbox-slider:active::-moz-range-thumb {
  transform: scale(1.25) !important;
  background: #38bdf8 !important;
}

.type-club-lightbox-zoom-text {
  font-size: 12px !important;
  font-weight: 600 !important;
  min-width: 38px !important;
  text-align: right !important;
  color: #ffffff !important;
  font-variant-numeric: tabular-nums !important;
  flex-shrink: 0 !important;
  user-select: none !important;
}

.type-club-lightbox-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 16px 24px;
  gap: 12px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.2) 70%, transparent 100%);
  color: white;
  z-index: 10;
  box-sizing: border-box;
}

.type-club-lightbox-btn {
  background: rgba(255, 255, 255, 0.15) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.22) !important;
  color: #ffffff !important;
  cursor: pointer !important;
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  min-height: 40px !important;
  padding: 0 !important;
  display: inline-flex !important;
  align-items: center !important;
  justify-content: center !important;
  border-radius: 8px !important;
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.1s ease !important;
  flex-shrink: 0 !important;
  box-shadow: 0 2px 6px rgba(0,0,0,0.3) !important;
  user-select: none !important;
  -webkit-tap-highlight-color: transparent !important;
}

.type-club-lightbox-btn:hover {
  background: rgba(255, 255, 255, 0.25) !important;
  border-color: rgba(255, 255, 255, 0.4) !important;
}

.type-club-lightbox-btn:active {
  background: rgba(255, 255, 255, 0.35) !important;
  transform: scale(0.95);
}

.type-club-lightbox-btn.close-btn {
  background: rgba(239, 68, 68, 0.25) !important;
  border-color: rgba(239, 68, 68, 0.45) !important;
}

.type-club-lightbox-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.45) !important;
  border-color: rgba(239, 68, 68, 0.65) !important;
}

.type-club-lightbox-btn svg {
  width: 22px !important;
  height: 22px !important;
  stroke: #ffffff !important;
  pointer-events: none !important;
}

@media (max-width: 640px) {
  .type-club-lightbox-header {
    padding: 8px 10px !important;
    gap: 8px !important;
    justify-content: flex-end !important;
  }
  
  .type-club-lightbox-slider-container {
    height: 38px !important;
    padding: 2px 8px !important;
    gap: 4px !important;
    flex: 1 1 auto !important;
    max-width: 220px !important;
    min-width: 130px !important;
  }

  .type-club-lightbox-zoom-step-btn {
    width: 24px !important;
    height: 24px !important;
    min-width: 24px !important;
    min-height: 24px !important;
  }

  .type-club-lightbox-zoom-step-btn svg {
    width: 16px !important;
    height: 16px !important;
  }

  .type-club-lightbox-slider {
    width: 100% !important;
    min-width: 36px !important;
    max-width: 80px !important;
  }

  .type-club-lightbox-zoom-text {
    font-size: 11px !important;
    min-width: 32px !important;
  }

  .type-club-lightbox-btn {
    width: 38px !important;
    height: 38px !important;
    min-width: 38px !important;
    min-height: 38px !important;
  }

  .type-club-lightbox-btn svg {
    width: 20px !important;
    height: 20px !important;
  }
}
`;

function ensureLightboxStyles() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('type-club-lightbox-slider-styles')) {
    const style = document.createElement('style');
    style.id = 'type-club-lightbox-slider-styles';
    style.textContent = LIGHTBOX_STYLES;
    document.head.appendChild(style);
  }
}

export class ImageLightbox {
  private static instance: ImageLightbox | null = null;
  
  private overlay: HTMLElement;
  private contentContainer: HTMLElement;
  private mediaElement: HTMLElement | null = null;
  private zoomSlider: HTMLInputElement;
  private zoomText: HTMLElement;
  
  private zoom = 1;
  private translateX = 0;
  private translateY = 0;
  private isSvg = false;
  private baseWidth = 0;
  private baseHeight = 0;

  // Mouse dragging
  private isDragging = false;
  private hasDragged = false;
  private startX = 0;
  private startY = 0;
  private downX = 0;
  private downY = 0;
  private downTarget: EventTarget | null = null;

  // Touch dragging & pinch
  private isTouchDragging = false;
  private hasTouchMoved = false;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchDownX = 0;
  private touchDownY = 0;
  private touchTarget: EventTarget | null = null;

  private isPinching = false;
  private initialPinchDist = 0;
  private initialPinchZoom = 1;
  private pinchFocalX = 0;
  private pinchFocalY = 0;
  private pinchInitialTranslateX = 0;
  private pinchInitialTranslateY = 0;

  private lastRaf: number | null = null;

  private constructor() {
    ensureLightboxStyles();

    this.overlay = document.createElement('div');
    this.overlay.className = 'type-club-lightbox-overlay';
    Object.assign(this.overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '9999',
      backdropFilter: 'blur(16px)',
      background: 'rgba(0,0,0,0.85)',
      display: 'none',
      flexDirection: 'column',
      userSelect: 'none',
      opacity: '0',
      transition: 'opacity 0.2s ease',
      touchAction: 'none',
    });

    const header = document.createElement('div');
    header.className = 'type-club-lightbox-header';

    const createBtn = (icon: string, title: string, className: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `type-club-lightbox-btn ${className}`;
      btn.innerHTML = icon;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.onclick = onClick;
      return btn;
    };

    const createStepBtn = (icon: string, title: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'type-club-lightbox-zoom-step-btn';
      btn.innerHTML = icon;
      btn.title = title;
      btn.setAttribute('aria-label', title);
      btn.onclick = onClick;
      return btn;
    };

    const loc = getLocale();
    const t = (key: any) => getTranslation(loc, key);

    const zoomOutBtn = createStepBtn(ICONS.zoomOut, t('lightbox.zoomOut'), () => this.setZoom(this.zoom / 1.2));
    const zoomInBtn = createStepBtn(ICONS.zoomIn, t('lightbox.zoomIn'), () => this.setZoom(this.zoom * 1.2));
    const fitBtn = createBtn(ICONS.fit, t('lightbox.fitToScreen'), 'fit-btn', () => this.fitToScreen());
    const closeBtn = createBtn(ICONS.close, t('lightbox.close'), 'close-btn', () => this.close());

    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'type-club-lightbox-slider-container';

    this.zoomText = document.createElement('span');
    this.zoomText.className = 'type-club-lightbox-zoom-text';
    this.zoomText.textContent = '100%';

    this.zoomSlider = document.createElement('input');
    this.zoomSlider.type = 'range';
    this.zoomSlider.className = 'type-club-lightbox-slider';
    this.zoomSlider.min = '10';
    this.zoomSlider.max = '500';
    this.zoomSlider.step = '1';
    this.zoomSlider.value = '100';
    this.zoomSlider.oninput = (e) => {
      const val = parseInt((e.target as HTMLInputElement).value, 10);
      this.setZoom(val / 100);
    };

    sliderContainer.appendChild(zoomOutBtn);
    sliderContainer.appendChild(this.zoomSlider);
    sliderContainer.appendChild(zoomInBtn);
    sliderContainer.appendChild(this.zoomText);

    header.appendChild(sliderContainer);
    header.appendChild(fitBtn);
    header.appendChild(closeBtn);

    this.contentContainer = document.createElement('div');
    this.contentContainer.className = 'type-club-lightbox-content';
    Object.assign(this.contentContainer.style, {
      flex: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      cursor: 'grab',
      touchAction: 'none',
      width: '100%',
      height: '100%',
      position: 'relative',
    });

    this.overlay.appendChild(header);
    this.overlay.appendChild(this.contentContainer);

    // Mouse events
    this.contentContainer.addEventListener('mousedown', (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.closest('.type-club-lightbox-header, button, input')) return;
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downTarget = e.target;
      this.onMouseDown(e);
    });

    this.contentContainer.addEventListener('mouseup', (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      if (
        e.button === 0 &&
        !this.hasDragged &&
        dist < 5 &&
        (this.downTarget === this.contentContainer || this.downTarget === this.overlay) &&
        (e.target === this.contentContainer || e.target === this.overlay)
      ) {
        this.close();
        return;
      }
      this.onMouseUp();
    });

    window.addEventListener('mousemove', (e: MouseEvent) => this.onMouseMove(e));
    window.addEventListener('mouseup', () => this.onMouseUp());
    this.contentContainer.addEventListener('wheel', (e: WheelEvent) => this.onWheel(e), { passive: false });

    // Touch events for mobile
    this.contentContainer.addEventListener('touchstart', (e: TouchEvent) => this.onTouchStart(e), { passive: false });
    this.contentContainer.addEventListener('touchmove', (e: TouchEvent) => this.onTouchMove(e), { passive: false });
    this.contentContainer.addEventListener('touchend', (e: TouchEvent) => this.onTouchEnd(e), { passive: false });
    this.contentContainer.addEventListener('touchcancel', (e: TouchEvent) => this.onTouchEnd(e), { passive: false });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.overlay.style.display !== 'none') {
        this.close();
      }
    });

    document.body.appendChild(this.overlay);
  }

  public static open(options: { src?: string; svgContent?: string; alt?: string }) {
    if (!this.instance) {
      this.instance = new ImageLightbox();
    }
    this.instance.show(options);
  }

  private getSvgDimensions(svg: SVGSVGElement): { width: number; height: number } {
    const viewBoxAttr = svg.getAttribute('viewBox');
    if (viewBoxAttr) {
      const parts = viewBoxAttr.trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        return { width: parts[2], height: parts[3] };
      }
    }
    const widthAttr = parseFloat(svg.getAttribute('width') || '');
    const heightAttr = parseFloat(svg.getAttribute('height') || '');
    if (!isNaN(widthAttr) && !isNaN(heightAttr) && widthAttr > 0 && heightAttr > 0) {
      return { width: widthAttr, height: heightAttr };
    }
    try {
      const bbox = svg.getBBox();
      if (bbox && bbox.width > 0 && bbox.height > 0) {
        return { width: bbox.width, height: bbox.height };
      }
    } catch {}
    const rect = svg.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { width: rect.width, height: rect.height };
    }
    return { width: 800, height: 600 };
  }

  private show(options: { src?: string; svgContent?: string; alt?: string }) {
    this.zoom = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.hasDragged = false;
    this.hasTouchMoved = false;
    this.contentContainer.innerHTML = '';
    this.isSvg = false;

    if (options.src) {
      this.isSvg = false;
      let src = options.src;
      if (src.startsWith('/uploads/')) {
        const siteUrl = (typeof window !== 'undefined' && (window as any).__TYPE_CLUB_SITE_URL__) || 'https://type-club.ru';
        src = `${siteUrl.replace(/\/$/, '')}${src}`;
      }
      const img = document.createElement('img');
      img.src = src;
      if (options.alt) img.alt = options.alt;
      img.draggable = false;
      Object.assign(img.style, {
        maxHeight: '85vh',
        maxWidth: '90vw',
        objectFit: 'contain',
        userSelect: 'none',
      });
      this.mediaElement = img;
    } else if (options.svgContent) {
      this.isSvg = true;
      const wrapper = document.createElement('div');
      wrapper.className = 'type-club-lightbox-svg-wrapper mermaid-render-wrapper';
      wrapper.innerHTML = options.svgContent;

      const svg = wrapper.querySelector('svg');
      if (svg) {
        // Clear Mermaid's inline constraints
        svg.style.removeProperty('max-width');
        svg.style.removeProperty('min-width');
        svg.style.removeProperty('max-height');
        svg.style.removeProperty('min-height');
        svg.removeAttribute('width');
        svg.removeAttribute('height');

        const dim = this.getSvgDimensions(svg as SVGSVGElement);
        const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640;
        const pad = isMobile ? 16 : 24;
        const screenW = typeof window !== 'undefined' ? window.innerWidth : 1024;
        const screenH = typeof window !== 'undefined' ? window.innerHeight : 768;
        const availW = Math.max(200, screenW * (isMobile ? 0.95 : 0.88) - pad * 2);
        const availH = Math.max(200, screenH * (isMobile ? 0.8 : 0.82) - pad * 2);

        const scaleX = availW / dim.width;
        const scaleY = availH / dim.height;
        let fitScale = Math.min(scaleX, scaleY);

        // Small diagrams should open readable and not tiny
        if (fitScale > 1) {
          fitScale = Math.min(fitScale, 2.5);
        }

        this.baseWidth = Math.max(100, Math.round(dim.width * fitScale));
        this.baseHeight = Math.max(60, Math.round(dim.height * fitScale));

        const isDark =
          typeof document !== 'undefined' &&
          (document.documentElement.classList.contains('dark') ||
            document.documentElement.getAttribute('data-theme') === 'dark');

        Object.assign(wrapper.style, {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
          borderRadius: '8px',
          padding: `${pad}px`,
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          boxSizing: 'content-box',
          width: `${this.baseWidth}px`,
          height: `${this.baseHeight}px`,
          minWidth: `${this.baseWidth}px`,
          minHeight: `${this.baseHeight}px`,
          overflow: 'visible',
          userSelect: 'none',
          position: 'relative',
        });

        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.display = 'block';
        svg.style.overflow = 'visible';
      }

      this.mediaElement = wrapper;
    }

    if (this.mediaElement) {
      this.contentContainer.appendChild(this.mediaElement);
      this.applyTransform();
    }

    this.overlay.style.display = 'flex';
    void this.overlay.offsetWidth;
    this.overlay.style.opacity = '1';
  }

  private close() {
    this.overlay.style.opacity = '0';
    setTimeout(() => {
      this.overlay.style.display = 'none';
      this.contentContainer.innerHTML = '';
      this.mediaElement = null;
      this.isSvg = false;
      this.baseWidth = 0;
      this.baseHeight = 0;
    }, 200);
  }

  private setZoom(newZoom: number, preserveCenter = true) {
    const clamped = Math.max(0.1, Math.min(newZoom, 5));
    if (clamped === this.zoom) return;

    if (preserveCenter && this.mediaElement) {
      const zoomRatio = clamped / this.zoom;
      this.translateX = this.translateX * zoomRatio;
      this.translateY = this.translateY * zoomRatio;
    }

    this.zoom = clamped;
    this.applyTransform();
  }

  private fitToScreen() {
    this.zoom = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.applyTransform();
  }

  private applyTransform() {
    if (!this.mediaElement) return;

    if (this.lastRaf) cancelAnimationFrame(this.lastRaf);

    this.lastRaf = requestAnimationFrame(() => {
      if (!this.mediaElement) return;

      if (this.isSvg && this.baseWidth > 0 && this.baseHeight > 0) {
        // Dynamic re-sizing of SVG and container ensures crisp vector rendering and exact pod fit
        const currentW = Math.round(this.baseWidth * this.zoom);
        const currentH = Math.round(this.baseHeight * this.zoom);
        this.mediaElement.style.width = `${currentW}px`;
        this.mediaElement.style.height = `${currentH}px`;
        this.mediaElement.style.minWidth = `${currentW}px`;
        this.mediaElement.style.minHeight = `${currentH}px`;
        this.mediaElement.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0)`;
      } else {
        this.mediaElement.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.zoom})`;
      }

      const pct = Math.round(this.zoom * 100);
      this.zoomText.textContent = `${pct}%`;
      this.zoomSlider.value = pct.toString();

      this.contentContainer.style.cursor = this.isDragging ? 'grabbing' : 'grab';
    });
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    if ((e.target as HTMLElement)?.closest('.type-club-lightbox-header, button, input')) return;

    this.isDragging = true;
    this.hasDragged = false;
    this.startX = e.clientX - this.translateX;
    this.startY = e.clientY - this.translateY;
    this.contentContainer.style.cursor = 'grabbing';
    e.preventDefault();
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    const newX = e.clientX - this.startX;
    const newY = e.clientY - this.startY;
    if (Math.hypot(e.clientX - this.downX, e.clientY - this.downY) > 3) {
      this.hasDragged = true;
    }
    this.translateX = newX;
    this.translateY = newY;
    this.applyTransform();
  }

  private onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.contentContainer.style.cursor = 'grab';
  }

  private onTouchStart(e: TouchEvent) {
    if ((e.target as HTMLElement)?.closest('.type-club-lightbox-header, button, input')) return;

    if (e.touches.length === 1) {
      this.isTouchDragging = true;
      this.hasTouchMoved = false;
      this.touchStartX = e.touches[0].clientX - this.translateX;
      this.touchStartY = e.touches[0].clientY - this.translateY;
      this.touchDownX = e.touches[0].clientX;
      this.touchDownY = e.touches[0].clientY;
      this.touchTarget = e.target;
    } else if (e.touches.length === 2) {
      this.isPinching = true;
      this.isTouchDragging = false;
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      this.initialPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      this.initialPinchZoom = this.zoom;

      const rect = this.contentContainer.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      this.pinchFocalX = (t1.clientX + t2.clientX) / 2 - rect.left - centerX;
      this.pinchFocalY = (t1.clientY + t2.clientY) / 2 - rect.top - centerY;
      this.pinchInitialTranslateX = this.translateX;
      this.pinchInitialTranslateY = this.translateY;
    }
  }

  private onTouchMove(e: TouchEvent) {
    if (e.cancelable) e.preventDefault();

    if (this.isPinching && e.touches.length === 2) {
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      if (this.initialPinchDist > 0) {
        const factor = dist / this.initialPinchDist;
        const newZoom = Math.max(0.1, Math.min(5, this.initialPinchZoom * factor));

        const zoomRatio = newZoom / this.initialPinchZoom;
        this.translateX = this.pinchFocalX - (this.pinchFocalX - this.pinchInitialTranslateX) * zoomRatio;
        this.translateY = this.pinchFocalY - (this.pinchFocalY - this.pinchInitialTranslateY) * zoomRatio;
        this.setZoom(newZoom, false);
      }
    } else if (this.isTouchDragging && e.touches.length === 1) {
      const touch = e.touches[0];
      const dist = Math.hypot(touch.clientX - this.touchDownX, touch.clientY - this.touchDownY);
      if (dist > 4) {
        this.hasTouchMoved = true;
      }
      this.translateX = touch.clientX - this.touchStartX;
      this.translateY = touch.clientY - this.touchStartY;
      this.applyTransform();
    }
  }

  private onTouchEnd(e: TouchEvent) {
    if (this.isPinching && e.touches.length < 2) {
      this.isPinching = false;
      if (e.touches.length === 1) {
        this.isTouchDragging = true;
        this.touchStartX = e.touches[0].clientX - this.translateX;
        this.touchStartY = e.touches[0].clientY - this.translateY;
      }
    } else if (this.isTouchDragging && e.touches.length === 0) {
      this.isTouchDragging = false;
      if (
        !this.hasTouchMoved &&
        (this.touchTarget === this.contentContainer || this.touchTarget === this.overlay)
      ) {
        this.close();
      }
    }
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomDirection = e.deltaY < 0 ? 1.15 : 0.85;
    const oldZoom = this.zoom;
    const newZoom = Math.max(0.1, Math.min(5, this.zoom * zoomDirection));
    if (newZoom === oldZoom) return;

    if (this.mediaElement) {
      const rect = this.contentContainer.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      const mouseX = e.clientX - rect.left - centerX;
      const mouseY = e.clientY - rect.top - centerY;

      const zoomRatio = newZoom / oldZoom;

      this.translateX = mouseX - (mouseX - this.translateX) * zoomRatio;
      this.translateY = mouseY - (mouseY - this.translateY) * zoomRatio;
    }

    this.zoom = newZoom;
    this.applyTransform();
  }
}
