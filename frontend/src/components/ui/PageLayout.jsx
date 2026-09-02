import React from 'react';

/**
 * PageLayout - Unified wrapper for ALL pages
 * Provides consistent header, content area, and styling
 * 
 * All Entry and Master pages use this wrapper for uniform appearance
 */
export const PageLayout = ({ 
  children, 
  title = '',
  style = {},
  className = '' 
}) => {
  const layoutStyle = {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
    backgroundColor: '#ffffff',
    fontFamily: 'Segoe UI, Arial, sans-serif',
    ...style
  };

  return (
    <div style={layoutStyle} className={className}>
      {title && (
        <div className="page-header" style={styles.pageHeader}>
          {title}
        </div>
      )}
      <div className="page-content" style={styles.pageContent}>
        {children}
      </div>
    </div>
  );
};

const styles = {
  pageHeader: {
    background: 'linear-gradient(135deg, #1f4fb2 0%, #2a5ea0 100%)',
    color: '#ffffff',
    padding: '10px 20px',
    fontSize: '16px',
    fontWeight: 'bold',
    borderRadius: '4px 4px 0 0',
  },
  pageContent: {
    flex: 1,
    padding: '15px',
    backgroundColor: '#f8f9fa',
  },
};

export default PageLayout;
