import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { ThemeProvider, createTheme } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
import { Box } from '@mui/material'
import { AuthProvider, useAuth } from './context/AuthContext'
import ErrorBoundary from './components/ErrorBoundary'
import CompanySelection from './components/CompanySelection'
import LoginPage from './components/LoginPage'
import AuthChoice from './components/AuthChoice'
import CompanyCreate from './components/CompanyCreate'
import CompanyDisplay from './components/CompanyDisplay'
import UserCreate from './components/UserCreate'
import UserDisplay from './components/UserDisplay'
import UserActivitiesDisplay from './components/UserActivitiesDisplay'
import WeightMachineSetup from './components/WeightMachineSetup'
import GeneralSetup from './components/GeneralSetup'
import UserCreatePage from './components/UserCreatePage'
import UserDisplayPage from './components/UserDisplayPage'
import UserChangePassword from './components/UserChangePassword'
import Dashboard from './components/Dashboard'
import CrudPage from './components/CrudPage'
import Navigation from './components/Navigation'

// Entry Pages
import PurchaseCreation from './components/PurchaseCreation'

import UnderConstruction from './components/UnderConstruction' // Generic placeholder for modules under development


import PurchaseDisplay from './components/PurchaseDisplay'
import GrainsCreation from './components/GrainsCreation'
import GrainsDisplay from './components/GrainsDisplay'
import WorkOrderSlipCreate from './components/WorkOrderSlipCreate'
import WorkOrderSlipDisplay from './components/WorkOrderSlipDisplay'
import FlourOutCreation from './components/FlourOutCreation'
import FlourOutDisplay from './components/FlourOutDisplay'
import FlourOutReturnCreation from './components/FlourOutReturnCreation'
import FlourOutReturnDisplay from './components/FlourOutReturnDisplay'
import PurchaseReturn from './components/PurchaseReturn'
import PurchaseReturnDisplay from './components/PurchaseReturnDisplay'
import SalesCreationPage from './components/SalesCreationPage'
import SalesDisplayPage from './components/SalesDisplayPage'
import SalesReturnCreate from './components/SalesReturnCreate'
import SalesReturnDisplay from './components/SalesReturnDisplay'
import ItemCreate from './components/ItemCreate'
import ItemDisplay from './components/ItemDisplay'
import ItemGroupCreate from './components/ItemGroupCreate'
import ItemGroupDisplay from './components/ItemGroupDisplay'

// Master Pages
import CustomerCreate from './components/CustomerCreate'
import CustomerDisplay from './components/CustomerDisplay'
import SupplierCreate from './components/SupplierCreate'
import SupplierDisplay from './components/SupplierDisplay'
import AreaCreate from './components/AreaCreate'
import AreaDisplay from './components/AreaDisplay'
import AreaUpdate from './components/AreaUpdate'
import CityCreate from './components/CityCreate'
import CityDisplay from './components/CityDisplay'
import CityUpdate from './components/CityUpdate'
import LedgerCreate from './components/LedgerCreate'
import LedgerDisplay from './components/LedgerDisplay'
import ConsigneeCreate from './components/ConsigneeCreate'
import ConsigneeDisplay from './components/ConsigneeDisplay'
import PTransCreate from './components/PTransCreate'
import PTransDisplay from './components/PTransDisplay'
import PTransUpdate from './components/PTransUpdate'
import DeductionSalesCreate from './components/DeductionSalesCreate'
import DeductionSalesDisplay from './components/DeductionSalesDisplay'
import DeductionPurchaseCreate from './components/DeductionPurchaseCreate'
import DeductionPurchaseDisplay from './components/DeductionPurchaseDisplay'
import FlourMillCreate from './components/FlourMillCreate'
import FlourMillDisplay from './components/FlourMillDisplay'
import PapadCompanyCreate from './components/PapadCompanyCreate'
import PapadCompanyDisplay from './components/PapadCompanyDisplay'
import WeightCreate from './components/WeightCreate'
import WeightDisplay from './components/WeightDisplay'
import LedgerGroupCreate from './components/LedgerGroupCreate'
import LedgerGroupDisplay from './components/LedgerGroupDisplay'
import SenderCreate from './components/SenderCreate'
import SenderDisplay from './components/SenderDisplay'
import TransportCreate from './components/TransportCreate'
import TransportDisplay from './components/TransportDisplay'
import GodownCreate from './components/master/GodownCreate'
import GodownDisplay from './components/master/GodownDisplay'
import { TaxMasterCreate, TaxMasterDisplay } from './components/tax'
import { DynamicMasterForm, DynamicMasterDisplay } from './components/master'

// Route wrappers for dynamic master modules
const ModuleFormRoute = () => {
  const { module } = useParams()
  return <DynamicMasterForm configKey={module} />
}

const ModuleDisplayRoute = () => {
  const { module } = useParams()
  return <DynamicMasterDisplay configKey={module} />
}

// Financial Year
import FinancialYearDisplay from './components/FinancialYearDisplay'
import FinancialYearCreate from './components/FinancialYearCreate'
import DatabaseUtility from './components/DatabaseUtility'
import RecycleBinPage from './components/RecycleBinPage'

// Additional Entry Pages
import PapadInCreate from './components/PapadInCreate'
import PapadInDisplay from './components/PapadInDisplay'
import PapadReturnCreate from './components/PapadReturnCreate'
import PapadReturnDisplay from './components/PapadReturnDisplay'
import ChequePrinting from './components/ChequePrinting'
import SalesCreate from './components/SalesCreate'
import SalesExportCreate from './components/SalesExportCreate'
import SalesExportDisplay from './components/SalesExportDisplay'
import SalesExportOrderCreate from './components/SalesExportOrderCreate'
import SalesExportOrderDisplay from './components/SalesExportOrderDisplay'
import QuotationCreate from './components/QuotationCreate'
import QuotationDisplay from './components/QuotationDisplay'
import StockAdjustCreate from './components/StockAdjustCreate'
import StockAdjustDisplay from './components/StockAdjustDisplay'
import PackingCreate from './components/PackingCreate'
import PackingDisplay from './components/PackingDisplay'
import AdvanceCreate from './components/AdvanceCreate'
import AdvanceDisplay from './components/AdvanceDisplay'
import OpenCreate from './components/OpenCreate'
import OpenDisplay from './components/OpenDisplay'
import WeightConversionCreate from './components/WeightConversionCreate'
import WeightConversionDisplay from './components/WeightConversionDisplay'
import VoucherCreate from './modules/vouchers/VoucherCreate'
import VoucherList from './modules/vouchers/VoucherList'
import PurchaseOrderList from './modules/purchaseOrder/pages/PurchaseOrderList'
import PurchaseOrderCreate from './modules/purchaseOrder/pages/PurchaseOrderCreate'
import PurchaseOrderView from './modules/purchaseOrder/pages/PurchaseOrderView'

// Purchase Request Module Pages
import PurchaseRequestCreate from './modules/purchaseRequest/PurchaseRequestCreate'
import PurchaseRequestDisplay from './modules/purchaseRequest/PurchaseRequestDisplay'
import PurchaseRequestApproval from './modules/purchaseRequest/PurchaseRequestApproval'
import PurchaseRequestReports from './modules/purchaseRequest/PurchaseRequestReports'
import PurchaseRequestDashboard from './modules/purchaseRequest/PurchaseRequestDashboard'
import QualityControlList from './modules/qualityControl/pages/QualityControlList'
import QualityControlCreate from './modules/qualityControl/pages/QualityControlCreate'
import QualityControlView from './modules/qualityControl/pages/QualityControlView'
import IncomingQualityList from './modules/incomingQuality/pages/IncomingQualityList'
import IncomingQualityCreate from './modules/incomingQuality/pages/IncomingQualityCreate'
import IncomingQualityView from './modules/incomingQuality/pages/IncomingQualityView'

// First-Class Quality Module Pages
import QualityDashboard from './modules/quality/pages/QualityDashboard'
import PurchaseLabTestingCreate from './modules/quality/pages/PurchaseLabTestingCreate'
import PurchaseLabTestingDisplay from './modules/quality/pages/PurchaseLabTestingDisplay'
import IncomingQualityReportDisplay from './modules/quality/pages/IncomingQualityReportDisplay'
import CertificateAnalysisDisplay from './modules/quality/pages/CertificateAnalysisDisplay'
import ParameterMaster from './modules/quality/pages/ParameterMaster'
import QCTemplateMaster from './modules/quality/pages/QCTemplateMaster'

import StockAlertDashboard from './components/StockAlert/StockAlertDashboard'
import StockAlertConfig from './components/StockAlert/StockAlertConfig'
import StockAlertContacts from './components/StockAlert/StockAlertContacts'

import StockReport from './components/StockReport'
import GodownTransfer from './components/GodownTransfer'
import ItemTransfer from './components/ItemTransfer'
import ReportPage from './components/ReportPage'

// Vehicle Movement - NEW
import VehicleCreate from './modules/vehicle/VehicleCreate'
import VehicleList from './modules/vehicle/VehicleList'

// Reports
import { 
  ReportsIndex,
  StockStatusReport, 
  GodownStockReport,
  LotHistoryReport,
  DailyProductionReport,
  CcpMonitoringReport,
  OprpMonitoringReport,
  TerminalInspectionReport,
  VehicleInspectionReport,
  PurchaseRegisterReport, 
  SalesRegisterReport,
  PurchaseReturnRegisterReport,
  SalesReturnRegisterReport,
  PapadLedgerReport,
  DayBookReport,
  TrialBalanceReport,
  BalanceSheetReport,
  ProfitLossReport,
  LedgerStatementReport,
  OutstandingSummaryReport,
  OutstandingDetailsReport
} from './components/Reports'
import CategoryReportPage from './components/Reports/CategoryReportPage'
import ComplianceHub from './components/compliance/ComplianceHub'

const theme = createTheme({
  palette: {
    primary: { main: '#1976d2' },
    secondary: { main: '#dc004e' },
  },
})

// Layout component that checks auth state
const AppLayout = () => {
  const { user, selectedCompany, loading, isSidebarOpen } = useAuth()

  // If still loading, show nothing
  if (loading) {
    return null
  }

  // If not logged in, redirect to login page
  if (!user) {
    return <Navigate to="/login" replace />
  }

  // If logged in but no company (shouldn't happen with proper login), redirect to login
  if (!selectedCompany) {
    return <Navigate to="/login" replace />
  }

  // Otherwise show the main app with navigation
  return (
    <>
      <Navigation />
        <Box sx={{
          width: '100%',
          px: { xs: 2, sm: 3 },
          pb: { xs: 2, sm: 3 },
          pt: { xs: 2, sm: 2.5 },
          boxSizing: 'border-box',
          '@media print': {
            padding: '0 !important',
          }
        }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/city-update" element={<CityUpdate />} />
          <Route path="/ptrans-update" element={<PTransUpdate />} />
          <Route path="/area-update" element={<AreaUpdate />} />
          <Route path="/report/stock-report" element={<StockReport />} />
          
          {/* Report Routes */}
          <Route path="/report/stock-status" element={<StockStatusReport />} />
          <Route path="/report/lot-history" element={<LotHistoryReport />} />
          <Route path="/report/purchase-register" element={<PurchaseRegisterReport />} />
          <Route path="/report/purchase-return-register" element={<PurchaseReturnRegisterReport />} />
          <Route path="/report/sales-register" element={<SalesRegisterReport />} />
          <Route path="/report/sales-return-register" element={<SalesReturnRegisterReport />} />
          <Route path="/report/papad-ledger" element={<PapadLedgerReport />} />
          
          {/* New Report Pages */}
          <Route path="/reports" element={<ReportsIndex />} />
          <Route path="/reports/category/:categoryKey" element={<CategoryReportPage />} />
          <Route path="/reports/category" element={<ReportsIndex />} />
          <Route path="/reports/stock-status" element={<StockStatusReport />} />
          <Route path="/reports/godown-stock" element={<GodownStockReport />} />
          <Route path="/reports/godown-wise-stock" element={<GodownStockReport />} />
          <Route path="/report/godown-stock" element={<GodownStockReport />} />
          
          {/* Inventory & Item Transfer Module */}
          <Route path="/inventory/item-transfer/create" element={<ItemTransfer initialView="create" />} />
          <Route path="/inventory/item-transfer/display" element={<ItemTransfer initialView="display" />} />
          <Route path="/inventory/item-transfer" element={<ItemTransfer initialView="create" />} />
          <Route path="/inventory/item-transfer-list" element={<ItemTransfer initialView="display" />} />
          <Route path="/godown-transfer" element={<ItemTransfer initialView="create" />} />
          <Route path="/godown-transfer-display" element={<ItemTransfer initialView="display" />} />
          <Route path="/entry/godown-transfer" element={<ItemTransfer initialView="create" />} />
          <Route path="/entry/godown-transfer-create" element={<ItemTransfer initialView="create" />} />
          <Route path="/entry/godown-transfer-display" element={<ItemTransfer initialView="display" />} />
          <Route path="/reports/lot-history" element={<LotHistoryReport />} />
          <Route path="/reports/daily-production" element={<DailyProductionReport />} />
          <Route path="/reports/ccp-monitoring" element={<CcpMonitoringReport />} />
          <Route path="/reports/oprp-monitoring" element={<OprpMonitoringReport />} />
          <Route path="/reports/terminal-inspection" element={<TerminalInspectionReport />} />
          <Route path="/reports/vehicle-inspection" element={<VehicleInspectionReport />} />
          <Route path="/reports/purchase-register" element={<PurchaseRegisterReport />} />
          <Route path="/reports/sales-register" element={<SalesRegisterReport />} />
          <Route path="/reports/purchase-return-register" element={<PurchaseReturnRegisterReport />} />
          <Route path="/reports/sales-return-register" element={<SalesReturnRegisterReport />} />
          <Route path="/reports/papad-ledger" element={<PapadLedgerReport />} />
          
          {/* Accounts Reports */}
          <Route path="/reports/day-book" element={<DayBookReport />} />
          <Route path="/reports/trial-balance" element={<TrialBalanceReport />} />
          <Route path="/reports/balance-sheet" element={<BalanceSheetReport />} />
          <Route path="/reports/profit-loss" element={<ProfitLossReport />} />
          <Route path="/reports/ledger-statement" element={<LedgerStatementReport />} />
          <Route path="/reports/outstanding-summary" element={<OutstandingSummaryReport />} />
          <Route path="/reports/outstanding-details" element={<OutstandingDetailsReport />} />
          
          {/* User Management */}
          <Route path="/master/user-create" element={<UserCreate />} />
          <Route path="/master/user-display" element={<UserDisplay />} />
          <Route path="/master/user-update/:userId" element={<UserCreate />} />
          <Route path="/db-utility" element={<DatabaseUtility />} />

          {/* Features Routes */}
          <Route path="/features/stock-alert-dashboard" element={<StockAlertDashboard />} />
          <Route path="/features/stock-alert-config" element={<StockAlertConfig />} />
          <Route path="/features/stock-alert-contacts" element={<StockAlertContacts />} />
          <Route path="/reports/stock-alerts" element={<StockAlertDashboard />} />
          <Route path="/features/user-activities" element={<UserActivitiesDisplay />} />
          <Route path="/features/setup" element={<WeightMachineSetup />} />
          <Route path="/features/general-setup" element={<GeneralSetup />} />
          <Route path="/features/user-create" element={<UserCreatePage />} />
          <Route path="/features/user-display" element={<UserDisplayPage />} />
          <Route path="/features/user-update/:userId" element={<UserCreatePage />} />
          <Route path="/features/change-password" element={<UserChangePassword />} />
          <Route path="/features/financial-year" element={<FinancialYearDisplay />} />
          <Route path="/features/financial-year-create" element={<FinancialYearCreate />} />
          <Route path="/features/financial-year-edit/:id" element={<FinancialYearCreate />} />

          {/* Entry Routes */}
          <Route path="/entry/purchase-create" element={<PurchaseCreation />} />
          <Route path="/purchase/edit/:id" element={<PurchaseCreation />} />
          {/* Purchase Order Routes */}
          <Route path="/entry/purchase-order-create" element={<PurchaseOrderCreate />} />
          <Route path="/entry/purchase-order-list" element={<PurchaseOrderList />} />
          <Route path="/entry/purchase-order-view/:id" element={<PurchaseOrderView />} />
          <Route path="/entry/purchase-order-display" element={<PurchaseOrderList />} />
          <Route path="/entry/purchase-order-report" element={<UnderConstruction moduleName="Purchase Order Report" />} />
          <Route path="/entry/purchase-order-print" element={<UnderConstruction moduleName="Purchase Order Print" />} />
          <Route path="/entry/purchase-display" element={<PurchaseDisplay />} />

          {/* Purchase Request Routes */}
          <Route path="/entry/purchase-request-create" element={<PurchaseRequestCreate />} />
          <Route path="/entry/purchase-request-display" element={<PurchaseRequestDisplay />} />
          <Route path="/entry/purchase-request-approval" element={<PurchaseRequestApproval />} />
          <Route path="/entry/purchase-request-reports" element={<PurchaseRequestReports />} />
          <Route path="/entry/purchase-request-dashboard" element={<PurchaseRequestDashboard />} />

          {/* Work Order Slip Routes */}
          <Route path="/entry/work-order-slip-create" element={<WorkOrderSlipCreate />} />
          <Route path="/entry/work-order-slip-display" element={<WorkOrderSlipDisplay />} />
          <Route path="/entry/work-order-slip" element={<WorkOrderSlipDisplay />} />
          <Route path="/entry/work-order-create" element={<WorkOrderSlipCreate />} />
          <Route path="/entry/work-order-display" element={<WorkOrderSlipDisplay />} />

          <Route path="/entry/grind-create" element={<GrainsCreation />} />
          <Route path="/entry/grind-display" element={<GrainsDisplay />} />
          <Route path="/entry/flour-out-create" element={<FlourOutCreation />} />
          <Route path="/entry/flour-out-display" element={<FlourOutDisplay />} />
          <Route path="/entry/flour-out-return-create" element={<FlourOutReturnCreation />} />
          <Route path="/entry/flour-out-return-display" element={<FlourOutReturnDisplay />} />
          <Route path="/entry/purchase-return-create" element={<PurchaseReturn />} />
          <Route path="/entry/purchase-return-display" element={<PurchaseReturnDisplay />} />
          <Route path="/entry/papad-in-create" element={<PapadInCreate />} />
          <Route path="/entry/papad-in-display" element={<PapadInDisplay />} />
          <Route path="/entry/papad-return-create" element={<PapadReturnCreate />} />
          <Route path="/entry/papad-return-display" element={<PapadReturnDisplay />} />
          <Route path="/entry/cheque-printing-create" element={<ChequePrinting />} />
          <Route path="/entry/cheque-printing-display" element={<ChequePrinting />} />
          <Route path="/entry/cheque-printing" element={<ChequePrinting />} />
          <Route path="/entry/sales-create" element={<SalesCreate />} />
          <Route path="/entry/sales-display" element={<SalesDisplayPage />} />
          <Route path="/entry/sales-order-create" element={<SalesCreate />} />
          <Route path="/entry/sales-order-display" element={<SalesDisplayPage />} />
          <Route path="/entry/sales-export-create" element={<SalesExportCreate />} />
          <Route path="/entry/sales-export-display" element={<SalesExportDisplay />} />
          <Route path="/entry/sales-export-order-create" element={<SalesExportOrderCreate />} />
          <Route path="/entry/sales-export-order-display" element={<SalesExportOrderDisplay />} />
          <Route path="/entry/quotation-create" element={<QuotationCreate />} />
          <Route path="/entry/quotation-display" element={<QuotationDisplay />} />
          <Route path="/entry/sales-return-create" element={<SalesReturnCreate />} />
          <Route path="/entry/sales-return-display" element={<SalesReturnDisplay />} />
          <Route path="/entry/stock-adjust-create" element={<StockAdjustCreate />} />
          <Route path="/entry/stock-adjust-display" element={<StockAdjustDisplay />} />
          <Route path="/entry/packing-create" element={<PackingCreate />} />
          <Route path="/entry/packing-display" element={<PackingDisplay />} />
          <Route path="/entry/quality-control-list" element={<QualityControlList />} />
          <Route path="/entry/quality-control-create" element={<QualityControlCreate />} />
          <Route path="/entry/quality-control-view/:id" element={<QualityControlView />} />
          <Route path="/entry/quality-control-view" element={<QualityControlView />} />
          <Route path="/entry/quality-control-display" element={<QualityControlList />} />
          <Route path="/entry/incoming-quality-list" element={<IncomingQualityList />} />
          <Route path="/entry/incoming-quality-create" element={<IncomingQualityCreate />} />
          <Route path="/entry/incoming-quality-view" element={<IncomingQualityView />} />
          <Route path="/entry/incoming-quality-display" element={<IncomingQualityList />} />

          {/* Quality, Compliance & Controlled Documents (D1-D11, P1-P8, C1-C10) */}
          <Route path="/compliance" element={<ComplianceHub />} />
          <Route path="/compliance/dashboard" element={<ComplianceHub />} />
          <Route path="/compliance/documents" element={<ComplianceHub />} />
          <Route path="/documents" element={<ComplianceHub />} />
          <Route path="/documents/dashboard" element={<ComplianceHub />} />
          <Route path="/documents/production" element={<ComplianceHub />} />
          <Route path="/documents/cleaning" element={<ComplianceHub />} />
          <Route path="/documents/controlled" element={<ComplianceHub />} />
          <Route path="/documents/templates" element={<ComplianceHub />} />
          <Route path="/documents/schedule" element={<ComplianceHub />} />
          <Route path="/documents/pending" element={<ComplianceHub />} />
          <Route path="/documents/expiring" element={<ComplianceHub />} />
          <Route path="/documents/register" element={<ComplianceHub />} />
          <Route path="/documents/traceability" element={<ComplianceHub />} />
          <Route path="/documents/recall" element={<ComplianceHub />} />
          <Route path="/quality/compliance" element={<ComplianceHub />} />
          <Route path="/quality/traceability" element={<ComplianceHub />} />
          <Route path="/quality/recall" element={<ComplianceHub />} />
          <Route path="/quality/scheduler" element={<ComplianceHub />} />

          {/* New Enterprise Quality Module routes under /quality/* */}
          <Route path="/quality/dashboard" element={<QualityDashboard />} />
          <Route path="/quality/purchase-lab-testing-create" element={<PurchaseLabTestingCreate />} />
          <Route path="/quality/purchase-lab-testing-display/:id" element={<PurchaseLabTestingDisplay />} />
          <Route path="/quality/iqr-display/:id" element={<IncomingQualityReportDisplay />} />
          <Route path="/quality/coa-display/:id" element={<CertificateAnalysisDisplay />} />
          <Route path="/quality/parameter-master" element={<ParameterMaster />} />
          <Route path="/quality/qc-template-master" element={<QCTemplateMaster />} />

          <Route path="/entry/weight-create" element={<WeightCreate />} />
          <Route path="/entry/weight-display" element={<WeightDisplay />} />
          <Route path="/entry/advance-create" element={<AdvanceCreate />} />
          <Route path="/entry/advance-display" element={<AdvanceDisplay />} />
          <Route path="/entry/open-create" element={<OpenCreate />} />
          <Route path="/entry/open-display" element={<OpenDisplay />} />
          <Route path="/entry/weight-conversion-create" element={<WeightConversionCreate />} />
          <Route path="/entry/weight-conversion-display" element={<WeightConversionDisplay />} />
          <Route path="/entry/voucher-create" element={<VoucherCreate />} />
          <Route path="/entry/voucher-create/:id" element={<VoucherCreate />} />
          <Route path="/entry/voucher-display" element={<VoucherList />} />
          
          {/* Vehicle Movement - NEW */}
          <Route path="/entry/vehicle-movement-create" element={<VehicleCreate />} />
          <Route path="/entry/vehicle-movement-display" element={<VehicleList />} />

          {/* Master Routes — All routed through dynamic config-driven components */}
          <Route path="/entry/item-create" element={<DynamicMasterForm configKey="item" key="item" />} />
          <Route path="/master/item-create" element={<DynamicMasterForm configKey="item" key="item" />} />
          <Route path="/master/item-display" element={<ItemDisplay />} />
          <Route path="/master/item-group-create" element={<DynamicMasterForm configKey="item_group" key="item_group" />} />
          <Route path="/master/item-group-display" element={<DynamicMasterDisplay configKey="item_group" key="item_group" />} />
          <Route path="/master/customer-create" element={<DynamicMasterForm configKey="customer" key="customer" />} />
          <Route path="/master/customer-display" element={<DynamicMasterDisplay configKey="customer" key="customer" />} />
          <Route path="/master/area-create" element={<DynamicMasterForm configKey="area" key="area" />} />
          <Route path="/master/area-display" element={<DynamicMasterDisplay configKey="area" key="area" />} />
          <Route path="/master/city-create" element={<DynamicMasterForm configKey="city" key="city" />} />
          <Route path="/master/city-display" element={<DynamicMasterDisplay configKey="city" key="city" />} />
          <Route path="/master/ledger-create" element={<DynamicMasterForm configKey="ledger" key="ledger" />} />
          <Route path="/master/ledger-display" element={<DynamicMasterDisplay configKey="ledger" key="ledger" />} />
          <Route path="/master/consignee-create" element={<DynamicMasterForm configKey="consignee" key="consignee" />} />
          <Route path="/master/consignee-display" element={<DynamicMasterDisplay configKey="consignee" key="consignee" />} />
          <Route path="/master/p-trans-create" element={<DynamicMasterForm configKey="p_trans" key="p_trans" />} />
          <Route path="/master/p-trans-display" element={<DynamicMasterDisplay configKey="p_trans" key="p_trans" />} />
          <Route path="/master/deduction-purchase-create" element={<DynamicMasterForm configKey="deduction_purchase" key="deduction_purchase" />} />
          <Route path="/master/deduction-purchase-display" element={<DynamicMasterDisplay configKey="deduction_purchase" key="deduction_purchase" />} />
          <Route path="/master/deduction-sales-create" element={<DynamicMasterForm configKey="deduction_sales" key="deduction_sales" />} />
          <Route path="/master/deduction-sales-display" element={<DynamicMasterDisplay configKey="deduction_sales" key="deduction_sales" />} />
          <Route path="/master/flour-mill-create" element={<DynamicMasterForm configKey="flour_mill" key="flour_mill" />} />
          <Route path="/master/flour-mill-display" element={<DynamicMasterDisplay configKey="flour_mill" key="flour_mill" />} />
          <Route path="/master/papad-company-create" element={<PapadCompanyCreate />} />
          <Route path="/master/papad-company-display" element={<DynamicMasterDisplay configKey="papad_company" key="papad_company" />} />
          <Route path="/papad-company-list" element={<DynamicMasterDisplay configKey="papad_company" key="papad_company" />} />
          <Route path="/master/weight-create" element={<DynamicMasterForm configKey="weight" key="weight" />} />
          <Route path="/master/weight-display" element={<DynamicMasterDisplay configKey="weight" key="weight" />} />
          <Route path="/master/ledger-group-create" element={<DynamicMasterForm configKey="ledger_group" key="ledger_group" />} />
          <Route path="/master/ledger-group-display" element={<DynamicMasterDisplay configKey="ledger_group" key="ledger_group" />} />
          <Route path="/master/sender-create" element={<DynamicMasterForm configKey="sender" key="sender" />} />
          <Route path="/master/sender-display" element={<DynamicMasterDisplay configKey="sender" key="sender" />} />
          <Route path="/master/transport-create" element={<DynamicMasterForm configKey="transport" key="transport" />} />
          <Route path="/master/transport-display" element={<DynamicMasterDisplay configKey="transport" key="transport" />} />
          <Route path="/master/godown-create" element={<DynamicMasterForm configKey="godown" key="godown" />} />
          <Route path="/master/godown-display" element={<DynamicMasterDisplay configKey="godown" key="godown" />} />

          {/* Tax Master Routes */}
          <Route path="/master/tax-create" element={<TaxMasterCreate />} />
          <Route path="/master/tax-display" element={<TaxMasterDisplay />} />
          <Route path="/tax/create" element={<TaxMasterCreate />} />
          <Route path="/tax/display" element={<TaxMasterDisplay />} />
          <Route path="/tax/edit/:id" element={<TaxMasterCreate />} />

          <Route path="/master/company-display" element={<CompanyDisplay />} />

          <Route path="/master/suppliers-create" element={<DynamicMasterForm configKey="supplier" key="supplier" />} />
          <Route path="/master/suppliers-display" element={<DynamicMasterDisplay configKey="supplier" key="supplier" />} />
          <Route path="/entry/supplier-create" element={<DynamicMasterForm configKey="supplier" key="supplier" />} />
          <Route path="/master/supplier-create" element={<DynamicMasterForm configKey="supplier" key="supplier" />} />
          <Route path="/master/supplier-display" element={<DynamicMasterDisplay configKey="supplier" key="supplier" />} />

          {/* Recycle Bin Route */}
          <Route path="/recycle-bin" element={<RecycleBinPage />} />

          {/* Dynamic Master Routes (config-driven) */}
          <Route path="/master/:module/create" element={<ModuleFormRoute />} />
          <Route path="/master/:module/display" element={<ModuleDisplayRoute />} />
        </Routes>
      </Box>
    </>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/company-select" element={<CompanySelection />} />
              <Route path="/company-create" element={<CompanyCreate />} />
              <Route path="/company-alter/:id" element={<CompanyCreate />} />
              <Route path="/company-display" element={<CompanyDisplay />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth-choice" element={<AuthChoice />} />
              <Route path="/user/create" element={<UserCreate />} />
              
              {/* Protected Routes */}
              <Route path="*" element={<AppLayout />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
