import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Tabs,
  Tab,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DescriptionIcon from '@mui/icons-material/Description';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import SanitizerIcon from '@mui/icons-material/Sanitizer';
import PrecisionManufacturingIcon from '@mui/icons-material/PrecisionManufacturing';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import EmergencyShareIcon from '@mui/icons-material/EmergencyShare';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';

import ControlledDocumentsList from './ControlledDocumentsList';
import ProductionRecordsList from './ProductionRecordsList';
import CleaningControlList from './CleaningControlList';
import TraceabilityEngine from './TraceabilityEngine';
import RecallManagement from './RecallManagement';
import ComplianceScheduler from './ComplianceScheduler';
import DocumentDashboardView from './DocumentDashboardView';
import DocumentRegister from './DocumentRegister';
import DocumentScheduleView from './DocumentScheduleView';
import PendingDocumentsView from './PendingDocumentsView';
import ExpiringDocumentsView from './ExpiringDocumentsView';
import DocumentTemplatesView from './DocumentTemplatesView';
import DocumentFormModal from './DocumentFormModal';
import DocumentViewerModal from './DocumentViewerModal';

const TAB_ROUTES = [
  '/documents/dashboard', // 0
  '/documents/production', // 1
  '/documents/cleaning', // 2
  '/documents/controlled', // 3
  '/documents/templates', // 4
  '/documents/schedule', // 5
  '/documents/pending', // 6
  '/documents/expiring', // 7
  '/documents/register', // 8
  '/documents/traceability', // 9
  '/documents/recall', // 10
];

export default function ComplianceHub() {
  const location = useLocation();
  const navigate = useNavigate();

  // Determine active tab based on pathname
  const getInitialTab = () => {
    const path = location.pathname.toLowerCase();
    if (path.includes('/production')) return 1;
    if (path.includes('/cleaning')) return 2;
    if (path.includes('/controlled') || path === '/compliance/documents') return 3;
    if (path.includes('/templates')) return 4;
    if (path.includes('/schedule') || path.includes('/scheduler')) return 5;
    if (path.includes('/pending')) return 6;
    if (path.includes('/expiring')) return 7;
    if (path.includes('/register')) return 8;
    if (path.includes('/traceability')) return 9;
    if (path.includes('/recall')) return 10;
    return 0; // Default to Document Dashboard
  };

  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [activeTraceLot, setActiveTraceLot] = useState('LOT0014');
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals
  const [createDocModalOpen, setCreateDocModalOpen] = useState(false);
  const [selectedDocCode, setSelectedDocCode] = useState('D1');
  const [viewDocModalOpen, setViewDocModalOpen] = useState(false);
  const [currentViewingDoc, setCurrentViewingDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);

  // Sync tab when location changes
  useEffect(() => {
    setActiveTab(getInitialTab());
  }, [location.pathname]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    if (TAB_ROUTES[newValue]) {
      navigate(TAB_ROUTES[newValue]);
    }
  };

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/compliance/dashboard');
      const data = await res.json();
      if (data.success) {
        setDashboardData(data);
        setError(null);
      } else {
        setError(data.message || 'Failed to load compliance data');
      }
    } catch (err) {
      console.error('Error loading compliance dashboard:', err);
      setError('Server connection error. Please verify backend is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleOpenCreateDoc = (code = 'D1') => {
    setSelectedDocCode(code);
    setEditingDoc(null);
    setCreateDocModalOpen(true);
  };

  const handleOpenEditDoc = (doc) => {
    setSelectedDocCode(doc.doc_code);
    setEditingDoc(doc);
    setCreateDocModalOpen(true);
  };

  const handleViewDoc = (doc) => {
    setCurrentViewingDoc(doc);
    setViewDocModalOpen(true);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Tabs Navigation */}
      <Card sx={{ mb: 3, borderRadius: 2, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{
            backgroundColor: 'white',
            borderBottom: 1,
            borderColor: 'divider',
            '& .MuiTab-root': {
              fontWeight: 'bold',
              fontSize: '13px',
              py: 2,
              minHeight: 52,
            },
          }}
        >
          <Tab icon={<DashboardIcon />} iconPosition="start" label="Document Dashboard" />
          <Tab icon={<PrecisionManufacturingIcon />} iconPosition="start" label="Production Records (P1–P8)" />
          <Tab icon={<SanitizerIcon />} iconPosition="start" label="Cleaning Records (C1–C14)" />
          <Tab icon={<DescriptionIcon />} iconPosition="start" label="Controlled Documents (D1–D11)" />
          <Tab icon={<FormatListBulletedIcon />} iconPosition="start" label="Document Templates" />
          <Tab icon={<CalendarMonthIcon />} iconPosition="start" label="Document Schedule" />
          <Tab icon={<PendingActionsIcon />} iconPosition="start" label="Pending Documents" />
          <Tab icon={<EventBusyIcon />} iconPosition="start" label="Expiring Documents" />
          <Tab icon={<MenuBookIcon />} iconPosition="start" label="Document Register" />
          <Tab icon={<AltRouteIcon />} iconPosition="start" label="Traceability (P8)" />
          <Tab icon={<EmergencyShareIcon />} iconPosition="start" label="Recall & Withdraw (D9)" />
        </Tabs>

        {/* Tab Panels */}
        <Box sx={{ p: { xs: 1.5, md: 2.5 } }}>
          {/* Tab 0: Document Dashboard */}
          {activeTab === 0 && (
            <DocumentDashboardView
              onNavigateTab={(tabIdx) => handleTabChange(null, tabIdx)}
              onCreateDoc={handleOpenCreateDoc}
              onOpenTraceability={() => handleTabChange(null, 9)}
              onOpenRecall={() => handleTabChange(null, 10)}
            />
          )}

          {/* Tab 1: Production Records (P1–P8) */}
          {activeTab === 1 && (
            <ProductionRecordsList
              onRefresh={fetchDashboard}
              onNavigateToTrace={(lotNo) => {
                if (lotNo) setActiveTraceLot(lotNo);
                handleTabChange(null, 9);
              }}
              onOpenTraceability={() => handleTabChange(null, 9)}
            />
          )}

          {/* Tab 2: Cleaning Records (C1–C10) */}
          {activeTab === 2 && (
            <CleaningControlList onRefresh={fetchDashboard} />
          )}

          {/* Tab 3: Controlled Documents (D1–D11) */}
          {activeTab === 3 && (
            <ControlledDocumentsList
              onViewDoc={handleViewDoc}
              onEditDoc={handleOpenEditDoc}
              onCreateDoc={handleOpenCreateDoc}
              onRefresh={fetchDashboard}
            />
          )}

          {/* Tab 4: Document Templates */}
          {activeTab === 4 && (
            <DocumentTemplatesView
              onCreateDoc={handleOpenCreateDoc}
              onNavigateTab={(tabIdx) => handleTabChange(null, tabIdx)}
            />
          )}

          {/* Tab 5: Document Schedule */}
          {activeTab === 5 && (
            <DocumentScheduleView
              onNavigateTab={(tabIdx) => handleTabChange(null, tabIdx)}
            />
          )}

          {/* Tab 6: Pending Documents */}
          {activeTab === 6 && (
            <PendingDocumentsView
              onNavigateTab={(tabIdx) => handleTabChange(null, tabIdx)}
              onEditDoc={handleOpenEditDoc}
              onRefresh={fetchDashboard}
            />
          )}

          {/* Tab 7: Expiring Documents */}
          {activeTab === 7 && (
            <ExpiringDocumentsView
              onViewDoc={handleViewDoc}
              onEditDoc={handleOpenEditDoc}
            />
          )}

          {/* Tab 8: Document Register */}
          {activeTab === 8 && (
            <DocumentRegister
              onCreateDoc={handleOpenCreateDoc}
              onViewDoc={handleViewDoc}
              onOpenTraceability={() => handleTabChange(null, 9)}
              onOpenRecall={() => handleTabChange(null, 10)}
              onNavigateTab={(tabIdx) => handleTabChange(null, tabIdx)}
            />
          )}

          {/* Tab 9: Traceability Engine (P8) */}
          {activeTab === 9 && (
            <TraceabilityEngine
              targetLot={activeTraceLot}
              onLotChange={(lot) => setActiveTraceLot(lot)}
            />
          )}

          {/* Tab 10: Recall Management (D9) */}
          {activeTab === 10 && (
            <RecallManagement />
          )}
        </Box>
      </Card>

      {/* Document Create / Edit Modal */}
      {createDocModalOpen && (
        <DocumentFormModal
          open={createDocModalOpen}
          docCode={selectedDocCode}
          initialData={editingDoc}
          onClose={() => {
            setCreateDocModalOpen(false);
            setEditingDoc(null);
          }}
          onSaved={() => {
            setCreateDocModalOpen(false);
            setEditingDoc(null);
            fetchDashboard();
          }}
        />
      )}

      {/* Document Official View & Print Modal */}
      {viewDocModalOpen && (
        <DocumentViewerModal
          open={viewDocModalOpen}
          document={currentViewingDoc}
          onClose={() => {
            setViewDocModalOpen(false);
            setCurrentViewingDoc(null);
          }}
          onEdit={() => {
            setViewDocModalOpen(false);
            handleOpenEditDoc(currentViewingDoc);
          }}
        />
      )}
    </Box>
  );
}
