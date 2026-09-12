import { getTranslation, Locale } from '../i18n';

function getLocale(): Locale {
  const lang = typeof document !== 'undefined' ? document.documentElement.getAttribute('lang') : 'en';
  return (lang === 'ru' ? 'ru' : 'en') as Locale;
}

const ICONS = {
  close: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>',
  zoomIn: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
  zoomOut: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>',
  reset: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"></path><path d="M9 21H3v-6"></path><path d="M21 3l-7 7"></path><path d="M3 21l7-7"></path></svg>',
  fit: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 3 3 3 3 8"></polyline><polyline points="16 3 21 3 21 8"></polyline><polyline points="8 21 3 21 3 16"></polyline><polyline points="16 21 21 21 21 16"></polyline></svg>',
};

const SLIDER_STYLES = `
.type-club-lightbox-slider {
  -webkit-appearance: none !important;
  -moz-appearance: none !important;
  appearance: none !important;
  width: 120px !important;
  height: 20px !important;
  background: transparent !important;
  cursor: pointer !important;
  margin: 0 !important;
  padding: 0 !important;
  border: none !important;
  outline: none !important;
  vertical-align: middle !important;
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
`;

function ensureLightboxStyles() {
  if (typeof document === 'undefined') return;
  if (!document.getElementById('type-club-lightbox-slider-styles')) {
    const style = document.createElement('style');
    style.id = 'type-club-lightbox-slider-styles';
    style.textContent = SLIDER_STYLES;
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
  private isDragging = false;
  private startX = 0;
  private startY = 0;
  
  private downX = 0;
  private downY = 0;
  private downTarget: EventTarget | null = null;

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
    });

    const header = document.createElement('div');
    Object.assign(header.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '16px 24px',
      gap: '16px',
      background: 'linear-gradient(to bottom, rgba(0,0,0,0.5), transparent)',
      color: 'white',
      zIndex: '1',
    });

    const createBtn = (icon: string, title: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = icon;
      btn.title = title;
      Object.assign(btn.style, {
        background: 'transparent',
        border: 'none',
        color: 'white',
        cursor: 'pointer',
        padding: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '6px',
        transition: 'background 0.2s',
      });
      btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.1)';
      btn.onmouseout = () => btn.style.background = 'transparent';
      btn.onclick = onClick;
      return btn;
    };

    const loc = getLocale();
    const t = (key: any) => getTranslation(loc, key);

    const zoomOutBtn = createBtn(ICONS.zoomOut, t('lightbox.zoomOut'), () => this.setZoom(this.zoom / 1.2));
    const zoomInBtn = createBtn(ICONS.zoomIn, t('lightbox.zoomIn'), () => this.setZoom(this.zoom * 1.2));
    const resetBtn = createBtn(ICONS.reset, t('lightbox.resetZoom'), () => { this.zoom = 1; this.translateX = 0; this.translateY = 0; this.applyTransform(); });
    const fitBtn = createBtn(ICONS.fit, t('lightbox.fitToScreen'), () => this.fitToScreen());
    const closeBtn = createBtn(ICONS.close, t('lightbox.close'), () => this.close());

    const sliderContainer = document.createElement('div');
    Object.assign(sliderContainer.style, { display: 'flex', alignItems: 'center', gap: '12px' });
    
    this.zoomText = document.createElement('span');
    Object.assign(this.zoomText.style, { fontSize: '13px', minWidth: '40px', textAlign: 'right' });
    
    this.zoomSlider = document.createElement('input');
    this.zoomSlider.type = 'range';
    this.zoomSlider.className = 'type-club-lightbox-slider';
    this.zoomSlider.min = '10';
    this.zoomSlider.max = '500';
    this.zoomSlider.step = '1';
    this.zoomSlider.oninput = (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.setZoom(val / 100);
    };

    sliderContainer.appendChild(zoomOutBtn);
    sliderContainer.appendChild(this.zoomSlider);
    sliderContainer.appendChild(this.zoomText);
    sliderContainer.appendChild(zoomInBtn);

    header.appendChild(sliderContainer);
    
    const divider = document.createElement('div');
    Object.assign(divider.style, { width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' });
    header.appendChild(divider);
    
    header.appendChild(resetBtn);
    header.appendChild(fitBtn);
    header.appendChild(closeBtn);

    this.contentContainer = document.createElement('div');
    Object.assign(this.contentContainer.style, {
      flex: '1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      cursor: 'grab',
    });

    this.overlay.appendChild(header);
    this.overlay.appendChild(this.contentContainer);

    // Event listeners
    this.contentContainer.addEventListener('mousedown', (e: MouseEvent) => {
      this.downX = e.clientX;
      this.downY = e.clientY;
      this.downTarget = e.target;
      this.onMouseDown(e);
    });

    this.contentContainer.addEventListener('mouseup', (e: MouseEvent) => {
      const dist = Math.hypot(e.clientX - this.downX, e.clientY - this.downY);
      if (
        e.button === 0 &&
        dist < 5 &&
        (this.downTarget === this.contentContainer || this.downTarget === this.overlay) &&
        (e.target === this.contentContainer || e.target === this.overlay)
      ) {
        this.close();
        return;
      }
      this.onMouseUp();
    });

    this.overlay.addEventListener('click', (e: MouseEvent) => {
      if (e.target === this.overlay) {
        this.close();
      }
    });

    window.addEventListener('mousemove', this.onMouseMove.bind(this));
    window.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.contentContainer.addEventListener('wheel', this.onWheel.bind(this), { passive: false });
    
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

  private show(options: { src?: string; svgContent?: string; alt?: string }) {
    this.zoom = 1;
    this.translateX = 0;
    this.translateY = 0;
    this.contentContainer.innerHTML = '';

    if (options.src) {
      let src = options.src;
      if (src.startsWith('/uploads/') && typeof window !== 'undefined' && (window as any).__TYPE_CLUB_SITE_URL__) {
        src = `${(window as any).__TYPE_CLUB_SITE_URL__}${src}`;
      }
      const img = document.createElement('img');
      img.src = src;
      if (options.alt) img.alt = options.alt;
      img.draggable = false;
      Object.assign(img.style, {
        maxHeight: '100%',
        maxWidth: '100%',
        objectFit: 'contain',
        transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
        willChange: 'transform',
      });
      this.mediaElement = img;
    } else if (options.svgContent) {
      const wrapper = document.createElement('div');
      wrapper.className = 'type-club-lightbox-svg-wrapper mermaid-render-wrapper';
      wrapper.innerHTML = options.svgContent;
      
      const isDark = document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark';
      Object.assign(wrapper.style, {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: isDark ? '#1e1e1e' : '#ffffff',
        borderRadius: '8px',
        padding: '24px',
        boxShadow: '0 8px 30px rgba(0,0,0,0.4)',
        maxWidth: '90vw',
        maxHeight: '85vh',
        overflow: 'visible',
        transition: 'transform 0.1s cubic-bezier(0.2, 0, 0, 1)',
        willChange: 'transform',
      });

      const svg = wrapper.querySelector('svg');
      if (svg) {
        svg.style.maxWidth = '100%';
        svg.style.maxHeight = '100%';
        svg.style.height = 'auto';
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
    }, 200);
  }

  private setZoom(newZoom: number) {
    this.zoom = Math.max(0.1, Math.min(newZoom, 5));
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
      this.mediaElement!.style.transform = `translate3d(${this.translateX}px, ${this.translateY}px, 0) scale(${this.zoom})`;
      const pct = Math.round(this.zoom * 100);
      this.zoomText.textContent = `${pct}%`;
      this.zoomSlider.value = pct.toString();
      
      this.contentContainer.style.cursor = (this.zoom > 1 || this.isDragging) ? (this.isDragging ? 'grabbing' : 'grab') : 'default';
    });
  }

  private onMouseDown(e: MouseEvent) {
    if (e.button !== 0 && e.button !== 1) return;
    if (e.button === 0 && this.zoom <= 1) return;
    
    this.isDragging = true;
    this.startX = e.clientX - this.translateX;
    this.startY = e.clientY - this.translateY;
    this.contentContainer.style.cursor = 'grabbing';
    e.preventDefault();
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging) return;
    this.translateX = e.clientX - this.startX;
    this.translateY = e.clientY - this.startY;
    this.applyTransform();
  }

  private onMouseUp() {
    if (!this.isDragging) return;
    this.isDragging = false;
    this.applyTransform();
  }

  private onWheel(e: WheelEvent) {
    e.preventDefault();
    const zoomDirection = e.deltaY < 0 ? 1.1 : 0.9;
    const oldZoom = this.zoom;
    this.zoom = Math.max(0.1, Math.min(this.zoom * zoomDirection, 5));
    
    if (this.zoom !== oldZoom && this.mediaElement) {
      const rect = this.contentContainer.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      
      const mouseX = e.clientX - rect.left - centerX;
      const mouseY = e.clientY - rect.top - centerY;
      
      const zoomRatio = this.zoom / oldZoom;
      
      this.translateX = mouseX - (mouseX - this.translateX) * zoomRatio;
      this.translateY = mouseY - (mouseY - this.translateY) * zoomRatio;
    }
    
    this.applyTransform();
  }
}
