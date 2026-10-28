import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const ViewControlContext = createContext(null);

export const ZOOM_STEPS = [50, 60, 70, 80, 85, 90, 95, 100, 105, 110, 120, 125, 140, 150, 175, 200];

export const ViewControlProvider = ({ children }) => {
  const [zoomLevel, setZoomLevel] = useState(() => {
    try {
      const saved = localStorage.getItem('bvc_erp_app_zoom');
      if (saved) {
        const parsed = parseInt(saved, 10);
        if (!isNaN(parsed) && parsed >= 50 && parsed <= 200) {
          return parsed;
        }
      }
    } catch (_) {}
    return 100;
  });

  const [isFullscreen, setIsFullscreen] = useState(() => {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  });

  // Apply zoom globally to documentElement and body
  const applyZoom = useCallback((level) => {
    try {
      const scale = level / 100;
      if (document.documentElement) {
        document.documentElement.style.zoom = scale.toString();
        document.documentElement.style.setProperty('--app-zoom-scale', scale.toString());
      }
      if (document.body) {
        document.body.style.zoom = scale.toString();
      }
      localStorage.setItem('bvc_erp_app_zoom', String(level));
    } catch (e) {
      console.warn('Error applying zoom level:', e);
    }
  }, []);

  useEffect(() => {
    applyZoom(zoomLevel);
  }, [zoomLevel, applyZoom]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = Boolean(
        document.fullscreenElement ||
        document.webkitFullscreenElement ||
        document.mozFullScreenElement ||
        document.msFullscreenElement
      );
      setIsFullscreen(isFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  const zoomIn = useCallback(() => {
    setZoomLevel((prev) => {
      const currentIndex = ZOOM_STEPS.findIndex((s) => s >= prev);
      if (currentIndex !== -1 && currentIndex < ZOOM_STEPS.length - 1) {
        return ZOOM_STEPS[currentIndex + 1];
      }
      return Math.min(prev + 10, 200);
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel((prev) => {
      const currentIndex = ZOOM_STEPS.slice().reverse().findIndex((s) => s <= prev);
      const originalIndex = currentIndex !== -1 ? ZOOM_STEPS.length - 1 - currentIndex : -1;
      if (originalIndex > 0) {
        return ZOOM_STEPS[originalIndex - 1];
      }
      return Math.max(prev - 10, 50);
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(100);
  }, []);

  const setExactZoom = useCallback((level) => {
    const clamped = Math.min(Math.max(level, 50), 200);
    setZoomLevel(clamped);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement && !document.webkitFullscreenElement) {
        const docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        } else if (docEl.msRequestFullscreen) {
          await docEl.msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen toggle notice:', err?.message || err);
    }
  }, []);

  // Keyboard shortcuts handler: Ctrl + / Ctrl - / Ctrl 0 / Ctrl Shift F
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if user is inside an input or textarea unless Ctrl key is pressed
      const target = e.target;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-' || e.key === '_') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          resetZoom();
        }
      }

      if (!isInput && e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, resetZoom, toggleFullscreen]);

  return (
    <ViewControlContext.Provider
      value={{
        zoomLevel,
        zoomIn,
        zoomOut,
        resetZoom,
        setZoom: setExactZoom,
        isFullscreen,
        toggleFullscreen,
        ZOOM_STEPS,
      }}
    >
      {children}
    </ViewControlContext.Provider>
  );
};

export const useViewControl = () => {
  const context = useContext(ViewControlContext);
  if (!context) {
    throw new Error('useViewControl must be used within a ViewControlProvider');
  }
  return context;
};

export default ViewControlContext;
