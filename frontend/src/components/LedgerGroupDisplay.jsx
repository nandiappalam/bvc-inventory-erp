import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../utils/api';
import { printHtml } from '../utils/printHelper';
import { exportToExcel } from '../utils/exportHelper';
import {
  ArrowLeft,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  Edit,
  Folder,
  FolderOpen,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  X
} from 'lucide-react';
import './LedgerGroupDisplay.css';

const NATURE_ORDER = ['Asset', 'Liability', 'Expense', 'Income'];

const NATURE_COLOR_CLASS = {
  Asset: 'lgd-nature-asset',
  Liability: 'lgd-nature-liability',
  Expense: 'lgd-nature-expense',
  Income: 'lgd-nature-income'
};

const DEFAULT_GROUP_FORM = {
  id: null,
  group_name: '',
  parent_group_id: '',
  account_nature: 'Expense',
  financial_statement: 'Profit & Loss',
  normal_balance: 'Dr',
  description: ''
};

function formatCurrency(val) {
  const num = Number(val || 0);
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function getNatureDefaults(nature) {
  switch (nature) {
    case 'Asset':
      return { normal_balance: 'Dr', financial_statement: 'Balance Sheet' };
    case 'Liability':
      return { normal_balance: 'Cr', financial_statement: 'Balance Sheet' };
    case 'Income':
      return { normal_balance: 'Cr', financial_statement: 'Profit & Loss' };
    case 'Expense':
    default:
      return { normal_balance: 'Dr', financial_statement: 'Profit & Loss' };
  }
}

const LedgerGroupDisplay = () => {
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorBanner, setErrorBanner] = useState('');
  const [statusNotice, setStatusNotice] = useState('');

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedNature, setSelectedNature] = useState('ALL');
  const [selectedStatement, setSelectedStatement] = useState('ALL');
  const [viewMode, setViewMode] = useState('directory'); // 'directory' | 'matrix'
  const [selectedGroupKey, setSelectedGroupKey] = useState(null);
  const [expandedMatrixRows, setExpandedMatrixRows] = useState({});

  // Create / Edit Group Modal
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [groupForm, setGroupForm] = useState(DEFAULT_GROUP_FORM);

  // Delete Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const getGroupKey = (g) => String(g?.id ?? g?.group_name ?? g?.name ?? '');

  const loadGroups = useCallback(async () => {
    try {
      setLoading(true);
      setErrorBanner('');
      const res = await api('/accounting/groups');
      let list = [];
      if (res && res.success && Array.isArray(res.data)) {
        list = res.data;
      } else {
        const masterRes = await api('/masters/ledger_groups');
        const fallback = masterRes?.data || masterRes || [];
        list = Array.isArray(fallback) ? fallback : [];
      }
      setGroups(list);
      setSelectedGroupKey((prev) => {
        if (prev && list.some((g) => getGroupKey(g) === prev)) return prev;
        return list.length > 0 ? getGroupKey(list[0]) : null;
      });
    } catch (err) {
      console.error('Error loading ledger groups:', err);
      setErrorBanner('Unable to load ledger groups. Please refresh and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGroups();
  }, [loadGroups]);

  useEffect(() => {
    const handleCompanyChange = () => {
      setSelectedGroupKey(null);
      setExpandedMatrixRows({});
      setSearchTerm('');
      setSelectedNature('ALL');
      setSelectedStatement('ALL');
      loadGroups();
    };
    window.addEventListener('erp_company_changed', handleCompanyChange);
    return () => window.removeEventListener('erp_company_changed', handleCompanyChange);
  }, [loadGroups]);

  const stats = useMemo(() => {
    let totalLedgers = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    const natureCounts = { Asset: 0, Liability: 0, Expense: 0, Income: 0 };

    groups.forEach((g) => {
      const count = g.ledger_count ?? (g.ledgers ? g.ledgers.length : 0);
      totalLedgers += count;
      totalDebit += Number(g.group_debit || 0);
      totalCredit += Number(g.group_credit || 0);

      const nature = NATURE_ORDER.includes(g.account_nature) ? g.account_nature : 'Expense';
      natureCounts[nature] += 1;
    });

    return {
      totalGroups: groups.length,
      totalLedgers,
      totalDebit,
      totalCredit,
      natureCounts
    };
  }, [groups]);

  const filteredGroups = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return groups.filter((g) => {
      const matchNature =
        selectedNature === 'ALL' ||
        (g.account_nature || '').toUpperCase() === selectedNature.toUpperCase();
      const matchStatement =
        selectedStatement === 'ALL' ||
        (g.financial_statement || '').toUpperCase().includes(selectedStatement.toUpperCase());

      if (!matchNature || !matchStatement) return false;
      if (!term) return true;

      const gNameMatch = (g.group_name || g.name || '').toLowerCase().includes(term);
      const parentMatch = (g.parent_group_name || '').toLowerCase().includes(term);
      const natureMatch = (g.account_nature || '').toLowerCase().includes(term);
      const ledgerMatch = (g.ledgers || []).some(
        (l) =>
          (l.ledger_name || l.name || '').toLowerCase().includes(term) ||
          (l.code || l.alias_name || '').toLowerCase().includes(term)
      );

      return gNameMatch || parentMatch || natureMatch || ledgerMatch;
    });
  }, [groups, searchTerm, selectedNature, selectedStatement]);

  const groupedSections = useMemo(() => {
    const sections = {};
    NATURE_ORDER.forEach((n) => {
      sections[n] = [];
    });
    filteredGroups.forEach((g) => {
      const nat = NATURE_ORDER.includes(g.account_nature) ? g.account_nature : 'Expense';
      sections[nat].push(g);
    });
    return NATURE_ORDER.map((nature) => ({
      nature,
      items: sections[nature]
    })).filter((sec) => sec.items.length > 0);
  }, [filteredGroups]);

  const selectedGroup = useMemo(() => {
    if (filteredGroups.length === 0) return null;
    const found = filteredGroups.find((g) => getGroupKey(g) === selectedGroupKey);
    return found || filteredGroups[0];
  }, [filteredGroups, selectedGroupKey]);

  const visibleLedgers = useMemo(() => {
    if (!selectedGroup) return [];
    const ledgers = selectedGroup.ledgers || [];
    const term = searchTerm.toLowerCase().trim();
    if (!term) return ledgers;

    const groupMatchesDirectly =
      (selectedGroup.group_name || selectedGroup.name || '').toLowerCase().includes(term) ||
      (selectedGroup.parent_group_name || '').toLowerCase().includes(term);

    if (groupMatchesDirectly) return ledgers;

    return ledgers.filter(
      (l) =>
        (l.ledger_name || l.name || '').toLowerCase().includes(term) ||
        (l.code || l.alias_name || '').toLowerCase().includes(term)
    );
  }, [selectedGroup, searchTerm]);

  const openCreateModal = () => {
    const presetNature = selectedNature !== 'ALL' ? selectedNature : 'Expense';
    const defaults = getNatureDefaults(presetNature);
    setModalError('');
    setGroupForm({
      id: null,
      group_name: '',
      parent_group_id: '',
      account_nature: presetNature,
      financial_statement: defaults.financial_statement,
      normal_balance: defaults.normal_balance,
      description: ''
    });
    setShowGroupModal(true);
  };

  const openEditModal = (group) => {
    setModalError('');
    const matchedParent =
      group.parent_group_id ||
      groups.find(
        (cand) =>
          cand.group_name &&
          group.parent_group_name &&
          cand.group_name.toLowerCase() === group.parent_group_name.toLowerCase()
      )?.id ||
      '';

    const rawNature = String(group.account_nature || 'Expense').trim().toLowerCase();
    const normalizedNature =
      NATURE_ORDER.find((n) => n.toLowerCase() === rawNature) || 'Expense';

    const rawBal = String(group.normal_balance || 'Dr').trim().toLowerCase();
    const normalizedBal = rawBal === 'cr' ? 'Cr' : 'Dr';

    const rawStmt = String(group.financial_statement || 'Profit & Loss').trim().toLowerCase();
    let normalizedStmt = 'Profit & Loss';
    if (rawStmt.includes('balance')) normalizedStmt = 'Balance Sheet';
    else if (rawStmt.includes('trading')) normalizedStmt = 'Trading Account';

    setGroupForm({
      id: group.id,
      group_name: group.group_name || group.name || '',
      parent_group_id: matchedParent ? String(matchedParent) : '',
      account_nature: normalizedNature,
      financial_statement: normalizedStmt,
      normal_balance: normalizedBal,
      description: group.description || ''
    });
    setShowGroupModal(true);
  };

  const handleGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupForm.group_name.trim()) {
      setModalError('Group name is required.');
      return;
    }

    try {
      setModalSubmitting(true);
      setModalError('');
      const isEdit = Boolean(groupForm.id);
      const endpoint = isEdit ? `/accounting/groups/${groupForm.id}` : '/accounting/groups';
      const method = isEdit ? 'PUT' : 'POST';

      const payload = {
        group_name: groupForm.group_name.trim(),
        parent_group_id: groupForm.parent_group_id ? Number(groupForm.parent_group_id) : null,
        account_nature: groupForm.account_nature,
        financial_statement: groupForm.financial_statement,
        normal_balance: groupForm.normal_balance,
        description: groupForm.description.trim()
      };

      const res = await api(endpoint, { method, body: payload });
      if (res && res.success) {
        setShowGroupModal(false);
        setStatusNotice(
          isEdit
            ? `Updated ledger group "${payload.group_name}".`
            : `Created ledger group "${payload.group_name}".`
        );
        await loadGroups();
        if (res.id) {
          setSelectedGroupKey(String(res.id));
        }
      } else {
        setModalError(res?.message || res?.error || 'Could not save ledger group.');
      }
    } catch (err) {
      console.error('Error saving group:', err);
      setModalError(err.message || 'Unexpected error saving ledger group.');
    } finally {
      setModalSubmitting(false);
    }
  };

  const confirmDeleteGroup = async () => {
    if (!deleteTarget) return;
    try {
      setDeleting(true);
      setErrorBanner('');
      const res = await api(`/accounting/groups/${deleteTarget.id}`, { method: 'DELETE' });
      if (res && res.success) {
        setStatusNotice(`Deleted ledger group "${deleteTarget.group_name || deleteTarget.name}".`);
        setDeleteTarget(null);
        await loadGroups();
      } else {
        setErrorBanner(res?.message || res?.error || 'Cannot delete group.');
        setDeleteTarget(null);
      }
    } catch (err) {
      console.error('Error deleting group:', err);
      setErrorBanner(err.message || 'Failed to delete ledger group.');
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  const toggleMatrixExpand = (key) => {
    setExpandedMatrixRows((prev) => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const handlePrint = () => {
    let rowsHtml = '';
    filteredGroups.forEach((g, gIdx) => {
      const ledgers = g.ledgers || [];
      rowsHtml += `
        <tr style="background-color: #f8fafc; font-weight: 600;">
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${gIdx + 1}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; font-size: 13px;" colspan="2">${g.group_name || g.name}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${g.parent_group_name || 'Primary'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${g.account_nature || 'Expense'} (${g.normal_balance || 'Dr'})</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1;">${g.financial_statement || 'Profit & Loss'}</td>
          <td style="padding: 8px; border: 1px solid #cbd5e1; text-align: right;">${ledgers.length}</td>
        </tr>
      `;

      if (ledgers.length > 0) {
        ledgers.forEach((l, lIdx) => {
          rowsHtml += `
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 12px; color: #64748b;">${gIdx + 1}.${lIdx + 1}</td>
              <td style="padding: 6px 8px 6px 24px; border: 1px solid #e2e8f0; font-size: 12px;" colspan="2">${l.ledger_name || l.name}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 12px;">${l.code || l.alias_name || '—'}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 12px;">Dr: ₹${formatCurrency(l.total_debit || 0)} | Cr: ₹${formatCurrency(l.total_credit || 0)}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 12px;">Closing: ₹${formatCurrency(l.closing_balance || 0)} ${l.closing_balance_type || 'Dr'}</td>
              <td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: 12px; text-align: right;">1</td>
            </tr>
          `;
        });
      } else {
        rowsHtml += `
          <tr>
            <td style="padding: 6px 8px; border: 1px solid #e2e8f0;"></td>
            <td colspan="6" style="padding: 6px 24px; border: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">No ledger accounts assigned under this group.</td>
          </tr>
        `;
      }
    });

    const html = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #0f172a;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 16px;">
          <h2 style="color: #1f4fb2; margin: 0; font-size: 18px;">Ledger Group Master & Chart of Accounts</h2>
          <div style="font-size: 12px; color: #475569; margin-top: 4px;">
            Groups: ${stats.totalGroups} · Ledgers: ${stats.totalLedgers} · Total Dr: ₹${formatCurrency(stats.totalDebit)} · Total Cr: ₹${formatCurrency(stats.totalCredit)} · Printed: ${new Date().toLocaleString()}
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background-color: #1f4fb2; color: #ffffff;">
              <th style="padding: 8px; border: 1px solid #1f4fb2; text-align: left; width: 48px;">S.No</th>
              <th style="padding: 8px; border: 1px solid #1f4fb2; text-align: left;" colspan="2">Group / Ledger Name</th>
              <th style="padding: 8px; border: 1px solid #1f4fb2; text-align: left;">Parent / Code</th>
              <th style="padding: 8px; border: 1px solid #1f4fb2; text-align: left;">Nature / Dr & Cr</th>
              <th style="padding: 8px; border: 1px solid #1f4fb2; text-align: left;">Statement / Closing</th>
              <th style="padding: 8px; border: 1px solid #1f4fb2; text-align: right;">Ledgers</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;

    printHtml(html, 'Ledger_Groups_Master_Report');
  };

  const handleExportExcel = () => {
    const exportData = [];
    filteredGroups.forEach((g, gIdx) => {
      const ledgers = g.ledgers || [];
      exportData.push({
        'S.No': gIdx + 1,
        'Record Type': 'LEDGER GROUP',
        'Group / Ledger Name': g.group_name || g.name,
        'Parent Group / Code': g.parent_group_name || 'Primary',
        'Account Nature': g.account_nature || 'Expense',
        'Normal Balance': g.normal_balance || 'Dr',
        'Financial Statement': g.financial_statement || 'Profit & Loss',
        'Ledgers Count': ledgers.length,
        'Total Debit': Number(g.group_debit || 0),
        'Total Credit': Number(g.group_credit || 0),
        'Closing Balance': `${formatCurrency(g.closing_balance || 0)} ${g.closing_balance_type || 'Dr'}`,
        'Status': g.status || 'Active'
      });

      ledgers.forEach((l, lIdx) => {
        exportData.push({
          'S.No': `${gIdx + 1}.${lIdx + 1}`,
          'Record Type': 'LEDGER ACCOUNT',
          'Group / Ledger Name': `  ↳ ${l.ledger_name || l.name}`,
          'Parent Group / Code': l.code || l.alias_name || '—',
          'Account Nature': `Under: ${g.group_name}`,
          'Normal Balance': l.opening_balance_type || 'Dr',
          'Financial Statement': `Opening: ₹${formatCurrency(l.opening_balance || 0)} ${l.opening_balance_type || 'Dr'}`,
          'Ledgers Count': 1,
          'Total Debit': Number(l.total_debit || 0),
          'Total Credit': Number(l.total_credit || 0),
          'Closing Balance': `${formatCurrency(l.closing_balance || 0)} ${l.closing_balance_type || 'Dr'}`,
          'Status': l.status || 'Active'
        });
      });
    });

    exportToExcel(exportData, 'Ledger_Groups_Master_List');
  };

  return (
    <div className="lgd-page">
      {/* Header Bar */}
      <header className="lgd-header">
        <div className="lgd-header-left">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="lgd-btn lgd-btn-back"
            title="Go Back"
          >
            <ArrowLeft className="lgd-icon" />
            <span>Back</span>
          </button>
          <div className="lgd-title-wrap">
            <h1 className="lgd-title">Ledger Groups &amp; Chart of Accounts</h1>
            <div className="lgd-summary-line">
              <span>{stats.totalGroups} Ledger Groups</span>
              <span aria-hidden="true">·</span>
              <span>{stats.totalLedgers} Assigned Ledgers</span>
              <span aria-hidden="true">·</span>
              <span>Total Dr ₹{formatCurrency(stats.totalDebit)}</span>
              <span aria-hidden="true">·</span>
              <span>Total Cr ₹{formatCurrency(stats.totalCredit)}</span>
            </div>
          </div>
        </div>

        <div className="lgd-header-actions">
          <button
            type="button"
            onClick={loadGroups}
            disabled={loading}
            className="lgd-btn lgd-btn-toolbar"
          >
            <RefreshCw className={`lgd-icon ${loading ? 'lgd-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="lgd-btn lgd-btn-toolbar"
          >
            <Printer className="lgd-icon" />
            <span>Print</span>
          </button>
          <button
            type="button"
            onClick={handleExportExcel}
            className="lgd-btn lgd-btn-excel"
          >
            <Download className="lgd-icon" />
            <span>Export Excel</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/master/ledger-create')}
            className="lgd-btn lgd-btn-toolbar"
          >
            <Plus className="lgd-icon" />
            <span>New Ledger</span>
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="lgd-btn lgd-btn-accent"
          >
            <Plus className="lgd-icon" />
            <span>New Group</span>
          </button>
        </div>
      </header>

      {/* Filter & View Switch Toolbar */}
      <section className="lgd-toolbar">
        <div className="lgd-tabs" role="tablist" aria-label="Account Nature Filter">
          <button
            type="button"
            onClick={() => setSelectedNature('ALL')}
            className={`lgd-tab ${selectedNature === 'ALL' ? 'is-active' : ''}`}
          >
            All ({stats.totalGroups})
          </button>
          {NATURE_ORDER.map((nature) => (
            <button
              key={nature}
              type="button"
              onClick={() => setSelectedNature(nature)}
              className={`lgd-tab ${selectedNature === nature ? 'is-active' : ''}`}
            >
              {nature} ({stats.natureCounts[nature] || 0})
            </button>
          ))}
        </div>

        <div className="lgd-controls">
          <div className="lgd-search-box">
            <Search className="lgd-search-icon" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search group, parent, or ledger..."
              className="lgd-search-input"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="lgd-search-clear"
                title="Clear search"
              >
                <X className="lgd-icon" />
              </button>
            )}
          </div>

          <select
            value={selectedStatement}
            onChange={(e) => setSelectedStatement(e.target.value)}
            aria-label="Filter by financial statement"
            className="lgd-select"
          >
            <option value="ALL">All Statements</option>
            <option value="Balance Sheet">Balance Sheet</option>
            <option value="Trading">Trading Account</option>
            <option value="Profit">Profit &amp; Loss</option>
          </select>

          <div className="lgd-tabs" role="group" aria-label="View Mode">
            <button
              type="button"
              onClick={() => setViewMode('directory')}
              className={`lgd-tab ${viewMode === 'directory' ? 'is-active' : ''}`}
            >
              Split View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('matrix')}
              className={`lgd-tab ${viewMode === 'matrix' ? 'is-active' : ''}`}
            >
              All Groups Table
            </button>
          </div>
        </div>
      </section>

      {/* Inline Feedback Banners */}
      {errorBanner && (
        <div className="lgd-banner lgd-banner-error" style={{ marginBottom: '10px' }}>
          <span>{errorBanner}</span>
          <button type="button" onClick={() => setErrorBanner('')} className="lgd-banner-close">
            <X className="lgd-icon" />
          </button>
        </div>
      )}
      {statusNotice && (
        <div className="lgd-banner lgd-banner-success" style={{ marginBottom: '10px' }}>
          <span>{statusNotice}</span>
          <button type="button" onClick={() => setStatusNotice('')} className="lgd-banner-close">
            <X className="lgd-icon" />
          </button>
        </div>
      )}

      {/* Main Content */}
      {loading ? (
        <div className="lgd-loading-box">Loading chart of accounts and ledger groups...</div>
      ) : filteredGroups.length === 0 ? (
        <div className="lgd-empty-box">
          <Folder className="lgd-icon-empty" />
          <h2 className="lgd-empty-title">No Ledger Groups Match</h2>
          <p className="lgd-empty-desc">
            Adjust your search term or nature/statement filters, or create a new ledger group for this company.
          </p>
          <div className="lgd-empty-actions">
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setSelectedNature('ALL');
                setSelectedStatement('ALL');
              }}
              className="lgd-btn lgd-btn-outline"
            >
              Reset Filters
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="lgd-btn lgd-btn-primary"
            >
              <Plus className="lgd-icon" />
              <span>Create Ledger Group</span>
            </button>
          </div>
        </div>
      ) : viewMode === 'matrix' ? (
        /* Classic Full-Width ERP Table View */
        <div className="lgd-matrix-card">
          <div className="lgd-table-scroll">
            <table className="lgd-table">
              <thead>
                <tr>
                  <th className="lgd-th-center" style={{ width: '44px' }}></th>
                  <th className="lgd-th-center" style={{ width: '52px' }}>S.No</th>
                  <th>Ledger Group Name</th>
                  <th>Parent Group</th>
                  <th>Nature</th>
                  <th>Normal</th>
                  <th>Financial Statement</th>
                  <th className="lgd-th-right">Ledgers</th>
                  <th className="lgd-th-right">Debit (₹)</th>
                  <th className="lgd-th-right">Credit (₹)</th>
                  <th className="lgd-th-right">Closing (₹)</th>
                  <th className="lgd-th-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map((g, idx) => {
                  const key = getGroupKey(g) || String(idx);
                  const ledgers = g.ledgers || [];
                  const nature = g.account_nature || 'Expense';
                  const isExpanded = Boolean(expandedMatrixRows[key]);
                  const isGroupCloseCr = (g.closing_balance_type || 'Dr') === 'Cr';

                  return (
                    <React.Fragment key={key}>
                      <tr>
                        <td className="lgd-td-center">
                          <button
                            type="button"
                            onClick={() => toggleMatrixExpand(key)}
                            className="lgd-link-btn"
                            title={isExpanded ? 'Collapse ledgers' : 'Expand ledgers'}
                            style={{ justifyContent: 'center', width: '100%' }}
                          >
                            {isExpanded ? (
                              <ChevronDown className="lgd-icon" />
                            ) : (
                              <ChevronRight className="lgd-icon" />
                            )}
                          </button>
                        </td>
                        <td className="lgd-td-center lgd-td-muted">{idx + 1}</td>
                        <td className="lgd-td-strong">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedGroupKey(key);
                              setViewMode('directory');
                            }}
                            className="lgd-link-btn"
                          >
                            <Folder className="lgd-icon" />
                            <span>{g.group_name || g.name}</span>
                          </button>
                        </td>
                        <td>{g.parent_group_name || 'Primary'}</td>
                        <td className={NATURE_COLOR_CLASS[nature] || ''} style={{ fontWeight: 600 }}>
                          {nature}
                        </td>
                        <td style={{ fontWeight: 600 }}>{g.normal_balance || 'Dr'}</td>
                        <td>{g.financial_statement || 'Profit & Loss'}</td>
                        <td className="lgd-td-right lgd-td-strong">{ledgers.length}</td>
                        <td className="lgd-td-right lgd-td-mono">{formatCurrency(g.group_debit || 0)}</td>
                        <td className="lgd-td-right lgd-td-mono">{formatCurrency(g.group_credit || 0)}</td>
                        <td className="lgd-td-right lgd-td-mono lgd-td-strong">
                          {formatCurrency(g.closing_balance || 0)}{' '}
                          <span className={isGroupCloseCr ? 'lgd-bal-cr' : 'lgd-bal-dr'}>
                            {g.closing_balance_type || 'Dr'}
                          </span>
                        </td>
                        <td className="lgd-td-right">
                          <div className="lgd-row-actions">
                            <button
                              type="button"
                              onClick={() => toggleMatrixExpand(key)}
                              className="lgd-btn lgd-btn-outline lgd-btn-sm"
                            >
                              {isExpanded ? 'Hide' : `Ledgers (${ledgers.length})`}
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(g)}
                              className="lgd-btn lgd-btn-primary lgd-btn-sm"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(g)}
                              className="lgd-btn lgd-btn-danger-outline lgd-btn-sm"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr>
                          <td colSpan={12} className="lgd-subrow-cell">
                            {ledgers.length === 0 ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', color: '#64748b' }}>
                                <span>No ledger accounts assigned under {g.group_name || g.name}.</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    navigate(`/master/ledger-create?group=${encodeURIComponent(g.group_name || g.name)}`)
                                  }
                                  className="lgd-btn lgd-btn-primary lgd-btn-sm"
                                >
                                  <Plus className="lgd-icon" />
                                  <span>Add Ledger Here</span>
                                </button>
                              </div>
                            ) : (
                              <table className="lgd-subtable">
                                <thead>
                                  <tr>
                                    <th style={{ width: '50px', textAlign: 'center' }}>S.No</th>
                                    <th>Ledger Account Name</th>
                                    <th>Code / Alias</th>
                                    <th style={{ textAlign: 'right' }}>Opening</th>
                                    <th style={{ textAlign: 'right' }}>Debit (₹)</th>
                                    <th style={{ textAlign: 'right' }}>Credit (₹)</th>
                                    <th style={{ textAlign: 'right' }}>Closing Balance</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {ledgers.map((l, lIdx) => {
                                    const ledgerName = l.ledger_name || l.name;
                                    const isOpenCr = (l.opening_balance_type || 'Dr') === 'Cr';
                                    const isCloseCr = (l.closing_balance_type || 'Dr') === 'Cr';
                                    const statusText = l.status || 'Active';
                                    const isActive = statusText.toLowerCase() === 'active';

                                    return (
                                      <tr key={l.id || `${ledgerName}_${lIdx}`}>
                                        <td className="lgd-td-center lgd-td-muted">{lIdx + 1}</td>
                                        <td className="lgd-td-strong">{ledgerName}</td>
                                        <td className="lgd-td-mono lgd-td-muted">{l.code || l.alias_name || '—'}</td>
                                        <td className="lgd-td-right lgd-td-mono">
                                          ₹{formatCurrency(l.opening_balance || 0)}{' '}
                                          <span className={isOpenCr ? 'lgd-bal-cr' : 'lgd-bal-dr'}>
                                            {l.opening_balance_type || 'Dr'}
                                          </span>
                                        </td>
                                        <td className="lgd-td-right lgd-td-mono">
                                          {formatCurrency(l.total_debit || 0)}
                                        </td>
                                        <td className="lgd-td-right lgd-td-mono">
                                          {formatCurrency(l.total_credit || 0)}
                                        </td>
                                        <td className="lgd-td-right lgd-td-mono lgd-td-strong">
                                          ₹{formatCurrency(l.closing_balance || 0)}{' '}
                                          <span className={isCloseCr ? 'lgd-bal-cr' : 'lgd-bal-dr'}>
                                            {l.closing_balance_type || 'Dr'}
                                          </span>
                                        </td>
                                        <td className={isActive ? 'lgd-status-active' : 'lgd-status-inactive'}>
                                          {statusText}
                                        </td>
                                        <td className="lgd-td-right">
                                          <div className="lgd-row-actions">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                navigate(`/reports/ledger-statement?ledger_name=${encodeURIComponent(ledgerName)}`)
                                              }
                                              className="lgd-btn lgd-btn-outline lgd-btn-sm"
                                            >
                                              Statement
                                            </button>
                                            {l.id && (
                                              <button
                                                type="button"
                                                onClick={() => navigate(`/master/ledger-create?edit=${l.id}`)}
                                                className="lgd-btn lgd-btn-primary lgd-btn-sm"
                                              >
                                                Edit
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Side-by-Side Split Master-Detail Workspace (No Waste Gap) */
        <div className="lgd-workspace">
          {/* Left Groups Directory */}
          <aside className="lgd-sidebar">
            <div className="lgd-sidebar-head">
              <span>Groups Directory</span>
              <span style={{ fontWeight: 600, color: '#475569' }}>{filteredGroups.length} shown</span>
            </div>

            <div className="lgd-sidebar-scroll">
              {groupedSections.map((section) => (
                <div key={section.nature}>
                  <div className="lgd-section-head">
                    <span className={NATURE_COLOR_CLASS[section.nature] || ''}>
                      {section.nature} Accounts
                    </span>
                    <span className="lgd-section-count">{section.items.length} groups</span>
                  </div>

                  {section.items.map((g) => {
                    const key = getGroupKey(g);
                    const isSelected = selectedGroup && getGroupKey(selectedGroup) === key;
                    const ledgerCount = (g.ledgers || []).length;

                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedGroupKey(key)}
                        className={`lgd-group-item ${isSelected ? 'is-selected' : ''}`}
                      >
                        <div className="lgd-group-item-left">
                          {isSelected ? (
                            <FolderOpen className="lgd-icon" />
                          ) : (
                            <Folder className="lgd-icon" style={{ color: '#64748b' }} />
                          )}
                          <div className="lgd-group-item-text">
                            <div className="lgd-group-item-name">{g.group_name || g.name}</div>
                            <div className="lgd-group-item-meta">
                              {g.parent_group_name || 'Primary'} · {g.normal_balance || 'Dr'}
                            </div>
                          </div>
                        </div>

                        <div className="lgd-group-item-right">
                          <span className="lgd-count-tag">{ledgerCount}</span>
                          <ChevronRight className="lgd-icon" style={{ color: isSelected ? '#1f4fb2' : '#94a3b8' }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </aside>

          {/* Right Selected Group Detail & Assigned Ledgers Table */}
          <main className="lgd-detail">
            {selectedGroup && (
              <>
                <div className="lgd-detail-header">
                  <div className="lgd-detail-info">
                    <div className="lgd-detail-kicker">
                      <span className={NATURE_COLOR_CLASS[selectedGroup.account_nature] || ''}>
                        {selectedGroup.account_nature || 'Expense'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Normal {selectedGroup.normal_balance || 'Dr'}</span>
                      <span aria-hidden="true">·</span>
                      <span>{selectedGroup.financial_statement || 'Profit & Loss'}</span>
                    </div>
                    <h2 className="lgd-detail-title">{selectedGroup.group_name || selectedGroup.name}</h2>
                    <p className="lgd-detail-parent">
                      Parent Group: <strong>{selectedGroup.parent_group_name || 'Primary'}</strong>
                      {selectedGroup.description ? ` — ${selectedGroup.description}` : ''}
                    </p>
                  </div>

                  <div className="lgd-detail-actions">
                    <button
                      type="button"
                      onClick={() => openEditModal(selectedGroup)}
                      className="lgd-btn lgd-btn-outline"
                    >
                      <Edit className="lgd-icon" />
                      <span>Edit Group</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(selectedGroup)}
                      className="lgd-btn lgd-btn-danger-outline"
                    >
                      <Trash2 className="lgd-icon" />
                      <span>Delete</span>
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/master/ledger-create?group=${encodeURIComponent(selectedGroup.group_name || selectedGroup.name)}`)
                      }
                      className="lgd-btn lgd-btn-primary"
                    >
                      <Plus className="lgd-icon" />
                      <span>Add Ledger Here</span>
                    </button>
                  </div>
                </div>

                {/* Group Activity Totals */}
                <div className="lgd-metrics-bar">
                  <div className="lgd-metric-cell">
                    <div className="lgd-metric-label">Assigned Ledgers</div>
                    <div className="lgd-metric-value">{(selectedGroup.ledgers || []).length}</div>
                  </div>
                  <div className="lgd-metric-cell">
                    <div className="lgd-metric-label">Group Debit (₹)</div>
                    <div className="lgd-metric-value">₹{formatCurrency(selectedGroup.group_debit || 0)}</div>
                  </div>
                  <div className="lgd-metric-cell">
                    <div className="lgd-metric-label">Group Credit (₹)</div>
                    <div className="lgd-metric-value">₹{formatCurrency(selectedGroup.group_credit || 0)}</div>
                  </div>
                  <div className="lgd-metric-cell">
                    <div className="lgd-metric-label">Net Closing Balance</div>
                    <div className="lgd-metric-value">
                      ₹{formatCurrency(selectedGroup.closing_balance || 0)}{' '}
                      <span className={(selectedGroup.closing_balance_type || 'Dr') === 'Cr' ? 'lgd-bal-cr' : 'lgd-bal-dr'}>
                        {selectedGroup.closing_balance_type || 'Dr'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Assigned Ledgers Table (Flush directly below totals bar) */}
                <div className="lgd-table-scroll">
                  {visibleLedgers.length === 0 ? (
                    <div className="lgd-empty-inner">
                      <BookOpen className="lgd-icon-empty" />
                      <h3 className="lgd-empty-title">
                        {(selectedGroup.ledgers || []).length === 0
                          ? `No ledgers under ${selectedGroup.group_name || selectedGroup.name}`
                          : 'No matching ledgers in this group'}
                      </h3>
                      <p className="lgd-empty-desc">
                        {(selectedGroup.ledgers || []).length === 0
                          ? 'Create a ledger account under this group to track balances and statements.'
                          : 'Clear the search box to inspect all ledgers assigned to this group.'}
                      </p>
                      {(selectedGroup.ledgers || []).length === 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/master/ledger-create?group=${encodeURIComponent(selectedGroup.group_name || selectedGroup.name)}`)
                          }
                          className="lgd-btn lgd-btn-primary"
                        >
                          <Plus className="lgd-icon" />
                          <span>Create First Ledger</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <table className="lgd-table">
                      <thead>
                        <tr>
                          <th className="lgd-th-center" style={{ width: '50px' }}>S.No</th>
                          <th>Ledger Account Name</th>
                          <th>Code / Alias</th>
                          <th className="lgd-th-right">Opening</th>
                          <th className="lgd-th-right">Debit (₹)</th>
                          <th className="lgd-th-right">Credit (₹)</th>
                          <th className="lgd-th-right">Closing Balance</th>
                          <th>Status</th>
                          <th className="lgd-th-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleLedgers.map((l, lIdx) => {
                          const ledgerName = l.ledger_name || l.name;
                          const isOpenCr = (l.opening_balance_type || 'Dr') === 'Cr';
                          const isCloseCr = (l.closing_balance_type || 'Dr') === 'Cr';
                          const statusText = l.status || 'Active';
                          const isActive = statusText.toLowerCase() === 'active';

                          return (
                            <tr key={l.id || `${ledgerName}_${lIdx}`}>
                              <td className="lgd-td-center lgd-td-muted">{lIdx + 1}</td>
                              <td className="lgd-td-strong">{ledgerName}</td>
                              <td className="lgd-td-mono lgd-td-muted">{l.code || l.alias_name || '—'}</td>
                              <td className="lgd-td-right lgd-td-mono">
                                ₹{formatCurrency(l.opening_balance || 0)}{' '}
                                <span className={isOpenCr ? 'lgd-bal-cr' : 'lgd-bal-dr'}>
                                  {l.opening_balance_type || 'Dr'}
                                </span>
                              </td>
                              <td className="lgd-td-right lgd-td-mono">
                                {formatCurrency(l.total_debit || 0)}
                              </td>
                              <td className="lgd-td-right lgd-td-mono">
                                {formatCurrency(l.total_credit || 0)}
                              </td>
                              <td className="lgd-td-right lgd-td-mono lgd-td-strong">
                                ₹{formatCurrency(l.closing_balance || 0)}{' '}
                                <span className={isCloseCr ? 'lgd-bal-cr' : 'lgd-bal-dr'}>
                                  {l.closing_balance_type || 'Dr'}
                                </span>
                              </td>
                              <td className={isActive ? 'lgd-status-active' : 'lgd-status-inactive'}>
                                {statusText}
                              </td>
                              <td className="lgd-td-right">
                                <div className="lgd-row-actions">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      navigate(`/reports/ledger-statement?ledger_name=${encodeURIComponent(ledgerName)}`)
                                    }
                                    className="lgd-btn lgd-btn-outline lgd-btn-sm"
                                  >
                                    <BookOpen className="lgd-icon" />
                                    <span>Statement</span>
                                  </button>
                                  {l.id && (
                                    <button
                                      type="button"
                                      onClick={() => navigate(`/master/ledger-create?edit=${l.id}`)}
                                      className="lgd-btn lgd-btn-primary lgd-btn-sm"
                                    >
                                      <Edit className="lgd-icon" />
                                      <span>Edit</span>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </>
            )}
          </main>
        </div>
      )}

      {/* Create / Edit Ledger Group Modal */}
      {showGroupModal && (
        <div className="lgd-modal-backdrop" role="dialog" aria-modal="true">
          <div className="lgd-modal">
            <div className="lgd-modal-header">
              <div className="lgd-modal-title-wrap">
                <Folder className="lgd-icon-lg" />
                <h3 className="lgd-modal-title">
                  {groupForm.id ? 'Edit Ledger Group' : 'Create New Ledger Group'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGroupModal(false)}
                className="lgd-modal-close"
                aria-label="Close modal"
              >
                <X className="lgd-icon-lg" />
              </button>
            </div>

            <form onSubmit={handleGroupSubmit}>
              <div className="lgd-modal-body">
                {modalError && <div className="lgd-banner lgd-banner-error">{modalError}</div>}

                <div className="lgd-field">
                  <label className="lgd-label">
                    Group Name <span className="lgd-required">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Operational Expenses, Trade Payables"
                    value={groupForm.group_name}
                    onChange={(e) => setGroupForm({ ...groupForm, group_name: e.target.value })}
                    className="lgd-input"
                  />
                </div>

                <div className="lgd-field">
                  <label className="lgd-label">Parent Group</label>
                  <select
                    value={groupForm.parent_group_id}
                    onChange={(e) => setGroupForm({ ...groupForm, parent_group_id: e.target.value })}
                    className="lgd-input"
                  >
                    <option value="">Primary (No Parent)</option>
                    {groups
                      .filter((g) => Number(g.id) !== Number(groupForm.id))
                      .map((g) => (
                        <option key={getGroupKey(g)} value={g.id}>
                          {g.group_name || g.name} ({g.account_nature || 'Expense'})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="lgd-field-row">
                  <div className="lgd-field">
                    <label className="lgd-label">Account Nature</label>
                    <select
                      value={groupForm.account_nature}
                      onChange={(e) => {
                        const nextNature = e.target.value;
                        const defaults = getNatureDefaults(nextNature);
                        setGroupForm({
                          ...groupForm,
                          account_nature: nextNature,
                          normal_balance: defaults.normal_balance,
                          financial_statement: defaults.financial_statement
                        });
                      }}
                      className="lgd-input"
                    >
                      <option value="Expense">Expense</option>
                      <option value="Asset">Asset</option>
                      <option value="Liability">Liability</option>
                      <option value="Income">Income</option>
                    </select>
                  </div>

                  <div className="lgd-field">
                    <label className="lgd-label">Normal Balance</label>
                    <select
                      value={groupForm.normal_balance}
                      onChange={(e) => setGroupForm({ ...groupForm, normal_balance: e.target.value })}
                      className="lgd-input"
                    >
                      <option value="Dr">Debit (Dr)</option>
                      <option value="Cr">Credit (Cr)</option>
                    </select>
                  </div>
                </div>

                <div className="lgd-field">
                  <label className="lgd-label">Financial Statement</label>
                  <select
                    value={groupForm.financial_statement}
                    onChange={(e) => setGroupForm({ ...groupForm, financial_statement: e.target.value })}
                    className="lgd-input"
                  >
                    <option value="Profit & Loss">Profit &amp; Loss</option>
                    <option value="Balance Sheet">Balance Sheet</option>
                    <option value="Trading Account">Trading Account</option>
                  </select>
                </div>

                <div className="lgd-field">
                  <label className="lgd-label">Description / Notes</label>
                  <textarea
                    rows="2"
                    placeholder="Optional classification notes..."
                    value={groupForm.description}
                    onChange={(e) => setGroupForm({ ...groupForm, description: e.target.value })}
                    className="lgd-input"
                  />
                </div>
              </div>

              <div className="lgd-modal-footer">
                <button
                  type="button"
                  onClick={() => setShowGroupModal(false)}
                  className="lgd-btn lgd-btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  className="lgd-btn lgd-btn-primary"
                >
                  {modalSubmitting && <RefreshCw className="lgd-icon lgd-spin" />}
                  <span>{groupForm.id ? 'Save Changes' : 'Create Group'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="lgd-modal-backdrop" role="dialog" aria-modal="true">
          <div className="lgd-modal lgd-modal-sm">
            <div className="lgd-modal-header">
              <h3 className="lgd-modal-title">Delete Ledger Group</h3>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="lgd-modal-close"
                aria-label="Close modal"
              >
                <X className="lgd-icon-lg" />
              </button>
            </div>
            <div className="lgd-modal-body">
              <p className="lgd-confirm-text">
                Delete <strong>{deleteTarget.group_name || deleteTarget.name}</strong>? Groups with active
                ledgers cannot be deleted until their ledgers are reassigned.
              </p>
            </div>
            <div className="lgd-modal-footer">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="lgd-btn lgd-btn-outline"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDeleteGroup}
                className="lgd-btn lgd-btn-danger"
              >
                {deleting && <RefreshCw className="lgd-icon lgd-spin" />}
                <span>Delete Group</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LedgerGroupDisplay;
