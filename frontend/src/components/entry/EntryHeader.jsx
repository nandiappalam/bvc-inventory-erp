import React from "react";

/**
 * EntryHeader - Uniform header component for Entry pages
 * Matches Create page header style
 */
const EntryHeader = ({ title }) => {
  return (
    <div style={styles.header}>
      {title}
    </div>
  );
};

const styles = {
  header: {
    background: '#415E3E',
    color: 'white',
    padding: '12px',
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '10px'
  }
};

export default EntryHeader;
