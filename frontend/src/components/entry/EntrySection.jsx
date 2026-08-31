import React from 'react';

/**
 * EntrySection - Section container with title for Entry pages
 * Used to group related content sections
 * 
 * @param {String} title - Section title
 * @param {React.ReactNode} children - Content to display
 * @param {Boolean} showDivider - Show divider line below title
 */
export const EntrySection = ({ title = '', children, showDivider = true }) => {
  return (
    <div className="section-container" style={styles.container}>
      {title && (
        <>
          <div style={styles.title}>{title}</div>
          {showDivider && <div style={styles.divider} />}
        </>
      )}
      <div style={styles.content}>
        {children}
      </div>
    </div>
  );
};

const styles = {
  container: {
    padding: '15px 20px',
  },
  title: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: '10px',
  },
  divider: {
    height: '2px',
    backgroundColor: '#1f4fb2',
    marginBottom: '15px',
  },
  content: {
    marginTop: '10px',
  },
};

export default EntrySection;
