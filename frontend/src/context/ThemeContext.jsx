import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { createTheme, ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const ThemeContext = createContext();

export const COLOR_PALETTES = {
  Blue: {
    name: 'Blue',
    primary: '#1f4fb2',
    primaryDark: '#163e91',
    primaryLight: '#3b82f6',
    secondary: '#2a5ea0',
    accent: '#60a5fa',
    sidebarBg: '#1e293b',
    headerBg: '#1f4fb2',
  },
  Teal: {
    name: 'Teal',
    primary: '#0d9488',
    primaryDark: '#0f766e',
    primaryLight: '#14b8a6',
    secondary: '#115e59',
    accent: '#2dd4bf',
    sidebarBg: '#134e4a',
    headerBg: '#0d9488',
  },
  Green: {
    name: 'Green',
    primary: '#16a34a',
    primaryDark: '#15803d',
    primaryLight: '#22c55e',
    secondary: '#166534',
    accent: '#4ade80',
    sidebarBg: '#14532d',
    headerBg: '#16a34a',
  },
  Purple: {
    name: 'Purple',
    primary: '#7c3aed',
    primaryDark: '#6d28d9',
    primaryLight: '#a855f7',
    secondary: '#5b21b6',
    accent: '#c084fc',
    sidebarBg: '#3b0764',
    headerBg: '#7c3aed',
  },
  Slate: {
    name: 'Slate',
    primary: '#334155',
    primaryDark: '#1e293b',
    primaryLight: '#64748b',
    secondary: '#475569',
    accent: '#94a3b8',
    sidebarBg: '#0f172a',
    headerBg: '#334155',
  },
};

const DEFAULT_SETTINGS = {
  color: 'Blue',
  mode: 'light', // 'light', 'dark', 'system'
  density: 'comfortable', // 'comfortable', 'compact'
  fontSize: 'medium', // 'small', 'medium', 'large'
  language: 'en', // 'en', 'hi', 'ta'
};

export const CustomThemeProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('bvc_erp_theme_config');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  });

  // System mode listener
  const [systemIsDark, setSystemIsDark] = useState(
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
  );

  useEffect(() => {
    if (!window.matchMedia) return;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e) => setSystemIsDark(e.matches);
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const effectiveMode = useMemo(() => {
    if (settings.mode === 'system') {
      return systemIsDark ? 'dark' : 'light';
    }
    return settings.mode || 'light';
  }, [settings.mode, systemIsDark]);

  const activePalette = COLOR_PALETTES[settings.color] || COLOR_PALETTES.Blue;

  // Calculate typography sizes based on fontSize setting
  const fontSizes = useMemo(() => {
    switch (settings.fontSize) {
      case 'small':
        return { base: 13, body1: '0.8125rem', body2: '0.75rem', h6: '1rem', h5: '1.125rem', button: '0.8125rem' };
      case 'large':
        return { base: 16, body1: '1rem', body2: '0.875rem', h6: '1.25rem', h5: '1.4rem', button: '0.95rem' };
      case 'medium':
      default:
        return { base: 14, body1: '0.875rem', body2: '0.8125rem', h6: '1.125rem', h5: '1.25rem', button: '0.875rem' };
    }
  }, [settings.fontSize]);

  // Apply CSS Variables to Root Element for HTML/CSS integration
  useEffect(() => {
    const root = document.documentElement;
    const isDark = effectiveMode === 'dark';

    root.style.setProperty('--primary-color', activePalette.primary);
    root.style.setProperty('--primary-dark', activePalette.primaryDark);
    root.style.setProperty('--primary-light', activePalette.primaryLight);
    root.style.setProperty('--font-size-base', `${fontSizes.base}px`);
    root.setAttribute('data-theme-mode', effectiveMode);
    root.setAttribute('data-theme-color', settings.color);
    root.setAttribute('data-theme-density', settings.density);

    if (isDark) {
      document.body.classList.add('dark-mode');
      document.body.style.backgroundColor = '#0f172a';
      document.body.style.color = '#f8fafc';
    } else {
      document.body.classList.remove('dark-mode');
      document.body.style.backgroundColor = '#f4f6f9';
      document.body.style.color = '#1e293b';
    }
  }, [activePalette, effectiveMode, settings.color, settings.density, fontSizes]);

  // Save settings to LocalStorage and provide update function
  const updateTheme = (newSettings) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      try {
        localStorage.setItem('bvc_erp_theme_config', JSON.stringify(updated));
      } catch (e) {
        console.error('Failed to save theme to localStorage', e);
      }
      return updated;
    });
  };

  const resetTheme = () => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem('bvc_erp_theme_config');
  };

  // Build Material-UI dynamic theme object
  const muiTheme = useMemo(() => {
    const isDark = effectiveMode === 'dark';
    const isCompact = settings.density === 'compact';

    return createTheme({
      palette: {
        mode: effectiveMode,
        primary: {
          main: activePalette.primary,
          dark: activePalette.primaryDark,
          light: activePalette.primaryLight,
          contrastText: '#ffffff',
        },
        secondary: {
          main: activePalette.secondary,
        },
        background: {
          default: isDark ? '#0f172a' : '#f4f6f9',
          paper: isDark ? '#1e293b' : '#ffffff',
        },
        text: {
          primary: isDark ? '#f8fafc' : '#1e293b',
          secondary: isDark ? '#94a3b8' : '#64748b',
        },
        divider: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      },
      typography: {
        fontSize: fontSizes.base,
        fontFamily: '"Public Sans", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        body1: { fontSize: fontSizes.body1 },
        body2: { fontSize: fontSizes.body2 },
        h6: { fontSize: fontSizes.h6, fontWeight: 600 },
        h5: { fontSize: fontSizes.h5, fontWeight: 600 },
        button: { fontSize: fontSizes.button, textTransform: 'none', fontWeight: 600 },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              transition: 'background-color 0.25s ease, color 0.25s ease',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: '6px',
              padding: isCompact ? '4px 10px' : '6px 16px',
              fontSize: fontSizes.button,
            },
            containedPrimary: {
              backgroundColor: activePalette.primary,
              '&:hover': {
                backgroundColor: activePalette.primaryDark,
              },
            },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            root: {
              padding: isCompact ? '6px 10px' : '10px 16px',
              fontSize: fontSizes.body2,
              borderColor: isDark ? '#334155' : '#e2e8f0',
            },
            head: {
              fontWeight: 700,
              backgroundColor: isDark ? '#1e293b' : '#f8fafc',
              color: isDark ? '#f8fafc' : '#334155',
            },
          },
        },
        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: '10px',
              border: isDark ? '1px solid #334155' : '1px solid #e2e8f0',
              boxShadow: isDark
                ? '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.3)'
                : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            colorPrimary: {
              backgroundColor: isDark ? '#1e293b' : activePalette.primary,
              color: '#ffffff',
            },
          },
        },
        MuiTextField: {
          defaultProps: {
            size: isCompact ? 'small' : 'medium',
          },
        },
        MuiSelect: {
          defaultProps: {
            size: isCompact ? 'small' : 'medium',
          },
        },
      },
    });
  }, [activePalette, effectiveMode, fontSizes, settings.density]);

  return (
    <ThemeContext.Provider
      value={{
        themeSettings: settings,
        updateTheme,
        resetTheme,
        effectiveMode,
        activePalette,
        COLOR_PALETTES,
      }}
    >
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeConfig = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useThemeConfig must be used within a CustomThemeProvider');
  }
  return context;
};

export default ThemeContext;
