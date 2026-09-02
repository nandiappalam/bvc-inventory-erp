import React, { useState } from "react";

/**
 * EntryFilterSection - Uniform filter section for Entry display pages
 * Includes search field, date filter, partner filter, and reset button
 */
const EntryFilterSection = ({ 
  onSearch, 
  onReset, 
  showDateFilter = true,
  showPartnerFilter = false,
  onDateChange,
  onPartnerChange,
  partners = []
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [selectedPartner, setSelectedPartner] = useState("");

  const handleSearch = () => {
    if (onSearch) {
      onSearch({ searchTerm, fromDate, toDate, selectedPartner });
    }
  };

  const handleReset = () => {
    setSearchTerm("");
    setFromDate("");
    setToDate("");
    setSelectedPartner("");
    if (onReset) {
      onReset();
    }
  };

  return (
    <div style={styles.filterSection}>
      {/* Search Field */}
      <div style={styles.filterLeft}>
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          style={styles.searchInput}
        />
        <button style={styles.searchBtn} onClick={handleSearch}>
          Search
        </button>
        <button style={styles.resetBtn} onClick={handleReset}>
          Reset
        </button>
      </div>

      {/* Date Filter */}
      {showDateFilter && (
        <div style={styles.filterCenter}>
          <label style={styles.label}>Date:</label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => {
              setFromDate(e.target.value);
              if (onDateChange) onDateChange({ fromDate: e.target.value, toDate });
            }}
            style={styles.dateInput}
          />
          <span style={styles.toLabel}>to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => {
              setToDate(e.target.value);
              if (onDateChange) onDateChange({ fromDate, toDate: e.target.value });
            }}
            style={styles.dateInput}
          />
        </div>
      )}

      {/* Partner Filter */}
      {showPartnerFilter && (
        <div style={styles.filterRight}>
          <label style={styles.label}>Partner:</label>
          <select
            value={selectedPartner}
            onChange={(e) => {
              setSelectedPartner(e.target.value);
              if (onPartnerChange) onPartnerChange(e.target.value);
            }}
            style={styles.selectInput}
          >
            <option value="">All</option>
            {partners.map((partner, idx) => (
              <option key={`${partner.id || 'partner'}-${idx}`} value={partner.id}>
                {partner.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

const styles = {
  filterSection: {
    background: '#66B4E3',
    padding: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: '10px',
    border: '2px solid #A5B89B',
    marginBottom: '10px'
  },
  filterLeft: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  filterCenter: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  filterRight: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  searchInput: {
    padding: '8px 12px',
    border: '1px dotted #777',
    borderRadius: '25px',
    fontSize: '14px',
    width: '200px'
  },
  searchBtn: {
    padding: '8px 16px',
    background: '#3A6F32',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  resetBtn: {
    padding: '8px 16px',
    background: '#666',
    color: '#fff',
    border: 'none',
    borderRadius: '5px',
    cursor: 'pointer',
    fontSize: '14px'
  },
  dateInput: {
    padding: '6px 10px',
    border: '1px dotted #777',
    borderRadius: '5px',
    fontSize: '14px'
  },
  selectInput: {
    padding: '6px 10px',
    border: '1px dotted #777',
    borderRadius: '5px',
    fontSize: '14px',
    minWidth: '150px'
  },
  label: {
    fontWeight: 'bold',
    color: '#333',
    fontSize: '14px'
  },
  toLabel: {
    color: '#333',
    fontSize: '14px'
  }
};

export default EntryFilterSection;
