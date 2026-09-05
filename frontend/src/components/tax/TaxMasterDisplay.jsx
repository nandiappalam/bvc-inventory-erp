import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTaxes, deleteTax, round2 } from '../../services/taxService';
import MasterTableLayout from '../master/MasterTableLayout';
import '../CityDisplay.css';
import '../master/master.css';

const TaxMasterDisplay = () => {
  const navigate = useNavigate();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('ALL');

  useEffect(() => {
    loadTaxes();
  }, []);

  const loadTaxes = async () => {
    try {
      setLoading(true);
      const res = await getTaxes({ status: '' });
      if (res?.success && res.data) {
        setTaxes(res.data);
      }
    } catch (err) {
      console.error('Error loading tax configurations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (row) => {
    if (!row) return;
    const editId = row.id !== undefined && row.id !== null ? row.id : row._id;
    navigate(`/master/tax-create?edit=${editId}`);
  };

  const handleDelete = async (row) => {
    if (!row) return;
    const taxId = row.id !== undefined && row.id !== null ? row.id : row._id;
    await deleteTax(taxId);
    setTaxes((prev) => prev.filter((t) => (t.id !== taxId && t._id !== taxId)));
  };

  const columns = useMemo(() => [
    { key: 'sno', title: 'S.No', width: '50px', render: (_, __, index) => index + 1 },
    { key: 'tax_name', title: 'Commodity / Tax Name' },
    { key: 'hsn_code', title: 'HSN Code', width: '100px' },
    { 
      key: 'tax_type', 
      title: 'Classification', 
      width: '120px',
      render: (val) => {
        const type = val || 'Taxable';
        let badgeColor = '#2563eb';
        let bg = '#eff6ff';
        if (type === 'Exempt') { badgeColor = '#059669'; bg = '#ecfdf5'; }
        else if (type === 'Nil Rated') { badgeColor = '#d97706'; bg = '#fffbeb'; }
        else if (type === 'Non-GST') { badgeColor = '#dc2626'; bg = '#fef2f2'; }
        return (
          <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: bg,
            color: badgeColor,
            border: `1px solid ${badgeColor}40`
          }}>
            {type}
          </span>
        );
      }
    },
    { 
      key: 'gst_rate', 
      title: 'GST Rate', 
      width: '90px',
      render: (val) => `${val !== undefined && val !== null ? val : 0}%` 
    },
    { 
      key: 'cgst_sgst', 
      title: 'CGST / SGST', 
      width: '110px',
      render: (_, row) => {
        const rate = parseFloat(row.gst_rate) || 0;
        const half = round2(rate / 2);
        return `${half}% / ${half}%`;
      }
    },
    { 
      key: 'igst', 
      title: 'IGST', 
      width: '90px',
      render: (_, row) => `${parseFloat(row.gst_rate) || 0}%` 
    },
    { key: 'calc_type', title: 'Calculation Mode', width: '130px' },
    { key: 'status', title: 'Status', width: '80px' },
  ], []);

  const processedData = useMemo(() => {
    return taxes.filter((t) => {
      if (filterType === 'ALL') return true;
      return t.tax_type === filterType;
    });
  }, [taxes, filterType]);

  return (
    <MasterTableLayout
      title="TAX MASTER DISPLAY"
      columns={columns}
      data={processedData}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onCreate={() => navigate('/master/tax-create')}
      onBack={() => window.history.back()}
      onRefresh={loadTaxes}
      moduleName="Tax"
      extraFilters={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label style={{ fontSize: '13px', fontWeight: '600', color: '#1976d2', whiteSpace: 'nowrap' }}>
            Classification:
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="uniform-input"
            style={{ width: '160px', height: '36px', fontSize: '13px', borderRadius: '4px', borderColor: '#ccc' }}
          >
            <option value="ALL">All Classifications</option>
            <option value="Taxable">Taxable</option>
            <option value="Exempt">Exempt</option>
            <option value="Nil Rated">Nil Rated</option>
            <option value="Zero Rated">Zero Rated</option>
            <option value="Non-GST">Non-GST</option>
          </select>
        </div>
      }
    />
  );
};

export default TaxMasterDisplay;
