import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  MenuItem,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tabs,
  Tab,
  Divider,
  Alert,
  Switch,
  FormControlLabel,
  RadioGroup,
  Radio,
  FormControl,
  FormLabel,
  Stack,
  Badge
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import EventNoteIcon from '@mui/icons-material/EventNote';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import ScheduleIcon from '@mui/icons-material/Schedule';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BugReportIcon from '@mui/icons-material/BugReport';
import EngineeringIcon from '@mui/icons-material/Engineering';
import BadgeIcon from '@mui/icons-material/Badge';
import InventoryIcon from '@mui/icons-material/Inventory';
import WcIcon from '@mui/icons-material/Wc';
import PersonPinIcon from '@mui/icons-material/PersonPin';
import ShieldIcon from '@mui/icons-material/Shield';
import PaletteIcon from '@mui/icons-material/Palette';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CleaningPaperPrintModal from './CleaningPaperPrintModal';

export const INVENTORY_PRESETS = [
  {
    category: 'Machinery & Processing Line',
    code: 'C2',
    name: 'Pulse Hammer Mill #01 (50 HP) — Milling Floor',
    data: {
      machine_name: 'Pulse Hammer Mill #01 (50 HP Heavy Duty)',
      machine_id: 'MCH-MIL-01',
      location: 'Godown 2 - Milling Floor Line 1',
      area_location: 'Milling Floor Line 1',
      inspector_name: 'Murugan K',
      supervisor_name: 'Plant Incharge'
    }
  },
  {
    category: 'Machinery & Processing Line',
    code: 'C2',
    name: 'De-Stoner & Gravity Separator #01 — Cleaner Hall',
    data: {
      machine_name: 'De-Stoner & Gravity Separator Unit #01',
      machine_id: 'MCH-DST-01',
      location: 'Godown 2 - Destoning Section',
      area_location: 'Pre-Cleaner Section',
      inspector_name: 'Suresh P',
      supervisor_name: 'Plant Incharge'
    }
  },
  {
    category: 'Machinery & Processing Line',
    code: 'C2',
    name: 'Pulse Polishing & Roller #01 — Polishing Bay',
    data: {
      machine_name: 'Pulse Polishing & Water Roller #01',
      machine_id: 'MCH-POL-01',
      location: 'Godown 2 - Polishing Section',
      area_location: 'Polishing Bay',
      inspector_name: 'Anand R',
      supervisor_name: 'Plant Incharge'
    }
  },
  {
    category: 'Primary Packing Material (PPMI)',
    code: 'C10',
    name: '25kg HDPE Sacks with LDPE Liner — Sri Krishna Packaging',
    data: {
      supplier: 'Sri Krishna Packaging Ltd.',
      supplier_name: 'Sri Krishna Packaging Ltd.',
      purchase_no: 'INV-2026-881',
      packing_material: '25kg Virgin HDPE Woven Bags with LDPE Liner',
      quantity_received: '5,000 Bags',
      area_location: 'Packing Material Warehouse',
      inspector_name: 'QC Inspector',
      supervisor_name: 'QA Head'
    }
  },
  {
    category: 'Primary Packing Material (PPMI)',
    code: 'C10',
    name: '50kg Heavy-Duty Export Sacks — Super Polymers',
    data: {
      supplier: 'Super Polymers Corp.',
      supplier_name: 'Super Polymers Corp.',
      purchase_no: 'INV-2026-904',
      packing_material: '50kg Export Grade Double Laminated Sacks',
      quantity_received: '3,000 Bags',
      area_location: 'Packing Material Warehouse',
      inspector_name: 'QC Inspector',
      supervisor_name: 'QA Head'
    }
  },
  {
    category: 'Vehicles & Dispatches',
    code: 'C8',
    name: 'Export Dispatch Truck — TN-58-AX-9912 (Royal Foods)',
    data: {
      customer: 'Royal Foods Exporters',
      customer_name: 'Royal Foods Exporters',
      quantity: '500 Bags (25 MT Urad Gota)',
      vehicle_no: 'TN-58-AX-9912',
      area_location: 'Dispatch Loading Bay 1',
      inspector_name: 'Security Officer',
      supervisor_name: 'Dispatch Clerk'
    }
  },
  {
    category: 'Vehicles & Inward RM',
    code: 'C8',
    name: 'Inward RM Consignment — TN-67-B-4410 (Sri Meenakshi Logistics)',
    data: {
      customer: 'Sri Meenakshi Logistics / Farm Direct Inward',
      customer_name: 'Sri Meenakshi Logistics',
      quantity: '400 Bags (20 MT Raw Black Gram)',
      vehicle_no: 'TN-67-B-4410',
      area_location: 'Inward Unloading Bay 2',
      inspector_name: 'Security Officer',
      supervisor_name: 'Weighbridge Clerk'
    }
  },
  {
    category: 'Storage Pallets',
    code: 'C6',
    name: 'Wooden Pallets — FG Godown Bay A (PLT-WD-01 to 50)',
    data: {
      pallet_id: 'PLT-WD-01 to 50',
      area_location: 'Finished Goods Godown Bay A',
      inspector_name: 'Store Keeper',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Water Tanks',
    code: 'C4',
    name: 'Main Overhead Process Water Tank (10,000 L)',
    data: {
      tank_id: 'OHT-01 (10,000 L)',
      area_location: 'Facility Rooftop & Milling Line',
      inspector_name: 'Sanitation Staff',
      supervisor_name: 'Plant Supervisor'
    }
  },
  {
    category: 'Windows & Glazing',
    code: 'C5',
    name: 'Milling & Packaging Hall Glazing (WIN-MIL-01 to 08)',
    data: {
      window_id: 'WIN-MIL-01 to 08',
      area_location: 'Milling Hall & Packaging Area',
      inspector_name: 'Housekeeper',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Restrooms & Hygiene',
    code: 'C7',
    name: 'Factory Restroom Block A & Handwash Stations',
    data: {
      toilet_location: 'Main Factory Restroom Block A',
      area_location: 'Block A Sanitation',
      inspector_name: 'House Keeper',
      supervisor_name: 'HR MANAGER'
    }
  }
];

export const CLEANING_RECORDS = [
  { code: 'ALL', label: 'All Checklists (C1–C10)', freq: '', icon: <FactCheckIcon fontSize="small" /> },
  { code: 'C1', label: 'C1: Production Area Cleaning (BVC/CP/CL/01)', freq: 'Daily', icon: <CleaningServicesIcon fontSize="small" />, color: '#1976d2', target: 'Milling & Packaging Hall', docRef: 'BVC/CP/CL/01' },
  { code: 'C2', label: 'C2: Machineries Cleaning (BVC/CP/CL/02)', freq: '15 Days Once', icon: <EngineeringIcon fontSize="small" />, color: '#c2185b', target: 'Motor Cover, De-Stoner, Pulse Roller', docRef: 'BVC/CP/CL/02' },
  { code: 'C3', label: 'C3: Pest Control Cleaning (BVC/CP/CL/03)', freq: 'Monthly Once', icon: <BugReportIcon fontSize="small" />, color: '#d32f2f', target: 'PCI Operators & Chemical Treatment Area', docRef: 'BVC/CP/CL/03' },
  { code: 'C4', label: 'C4: Water Tank Cleaning (BVC/CP/CL/04)', freq: '15 Days Once', icon: <ShieldIcon fontSize="small" />, color: '#0288d1', target: 'Overhead & Process Water Tanks', docRef: 'BVC/CP/CL/04' },
  { code: 'C5', label: 'C5: Window-Glass Cleaning (BVC/CP/CL/05)', freq: 'Monthly Once', icon: <VisibilityIcon fontSize="small" />, color: '#7b1fa2', target: 'Factory Glazing & Glass Partitions', docRef: 'BVC/CP/CL/05' },
  { code: 'C6', label: 'C6: Wood-Pallet Cleaning (BVC/CP/CL/06)', freq: '15 Days Once', icon: <InventoryIcon fontSize="small" />, color: '#ed6c02', target: 'Godown Storage Pallets', docRef: 'BVC/CP/CL/06' },
  { code: 'C7', label: 'C7: Toilet Inspection Checklist (BVC-QA-F-05)', freq: 'Daily', icon: <WcIcon fontSize="small" />, color: '#00796b', target: 'Factory Restrooms & Handwash Areas', docRef: 'BVC-QA-F-05' },
  { code: 'C8', label: 'C8: Vehicle Loading / Unloading Inspection (BVC/QA/F/07)', freq: 'Loading', icon: <LocalShippingIcon fontSize="small" />, color: '#5d4037', target: 'Dispatch & Inward Trucks / Containers', docRef: 'BVC/QA/F/07' },
  { code: 'C9', label: 'C9: Food Handlers Personal Hygiene (BVC/QA/F/01)', freq: 'Daily', icon: <BadgeIcon fontSize="small" />, color: '#388e3c', target: 'All Production & Packing Staff', docRef: 'BVC/QA/F/01' },
  { code: 'C10', label: 'C10: Primary Packing Material Inspection (PPMI)', freq: 'PM Receiving', icon: <InventoryIcon fontSize="small" />, color: '#2e7d32', target: 'Inward Bags, Liners & Packaging Supplies', docRef: 'PPMI/QA/F/08' },
];

export default function CleaningControlList({ onRefresh }) {
  const [activeTab, setActiveTab] = useState(0); // 0: Register, 1: Schedule Summary, 2: Form
  const [records, setRecords] = useState([]);
  const [scheduleSummary, setScheduleSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedCode, setSelectedCode] = useState('ALL');
  
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  // Dialog & View state
  const [viewingRecord, setViewingRecord] = useState(null);
  const [isBlankPrint, setIsBlankPrint] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState(null);

  // Form State
  const [formState, setFormState] = useState(getInitialFormState('C1'));

  function getInitialFormState(code = 'C1') {
    const today = new Date().toISOString().split('T')[0];
    const recNo = `${code}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    
    // Default meta for selected code
    const meta = CLEANING_RECORDS.find(r => r.code === code) || CLEANING_RECORDS[1];

    let defaultChecklist = {};
    if (code === 'C1') {
      defaultChecklist = {
        shift: 'Morning (Shift 1)',
        cleaning_points: [
          { point: 'Floor', status: 'OK', remarks: 'Swept, scrubbed and dried' },
          { point: 'Walls', status: 'OK', remarks: 'Clean, dust-free' },
          { point: 'Working Area', status: 'OK', remarks: 'Sanitized with food-grade agent' },
          { point: 'Equipment Area', status: 'OK', remarks: 'Hoppers and beaters clean' },
          { point: 'Drainage Area', status: 'OK', remarks: 'Drains cleared and covered' },
          { point: 'Waste Area', status: 'OK', remarks: 'Disposed to external yard' },
          { point: 'Storage Area', status: 'OK', remarks: '18-inch wall gap maintained' }
        ]
      };
    } else if (code === 'C2') {
      defaultChecklist = {
        pallet_id: 'PLT-BAY-01',
        location: 'Finished Goods Bay',
        quantity: 50,
        condition: 'Good / Heat-Treated (ISPM-15)',
        parameters: [
          { parameter: 'Pallet condition', result: 'OK', remarks: 'Structurally sound' },
          { parameter: 'Broken pallet', result: 'No', remarks: 'Zero damage' },
          { parameter: 'Splintering', result: 'No', remarks: 'Smooth finish' },
          { parameter: 'Moisture', result: 'No', remarks: 'Dry (Moisture < 12%)' },
          { parameter: 'Contamination', result: 'No', remarks: 'Clean and oil-free' },
          { parameter: 'Pest evidence', result: 'No', remarks: 'No wood borers' },
          { parameter: 'Cleanliness', result: 'OK', remarks: 'Good hygiene' }
        ],
        action: 'Accepted'
      };
    } else if (code === 'C3') {
      defaultChecklist = {
        objects_checked: [
          { s_no: 1, location: 'Milling Line 1', object_item: 'Window Glazing', material_type: 'Polycarbonate Shielded', condition: 'OK', damage_found: 'No', action: '-', remarks: 'Film intact' },
          { s_no: 2, location: 'Sifter Bay', object_item: 'Sifter View Glass', material_type: 'Toughened Glass', condition: 'OK', damage_found: 'No', action: '-', remarks: 'No crack' },
          { s_no: 3, location: 'Packaging Line', object_item: 'Tube Light Diffusers', material_type: 'Hard Acrylic', condition: 'OK', damage_found: 'No', action: '-', remarks: 'Shatter-proof' },
          { s_no: 4, location: 'Lab Room', object_item: 'Moisture Balance Cover', material_type: 'Glass', condition: 'OK', damage_found: 'No', action: '-', remarks: 'Intact' }
        ],
        overall_result: 'ACCEPTED'
      };
    } else if (code === 'C4') {
      defaultChecklist = {
        inspection_time: '08:30 AM',
        pest_status: 'No Pest Evidence',
        monitoring_points: [
          { s_no: 1, location: 'Perimeter West', trap_no: 'RB-01 to RB-06', observation: 'Intact, locked', pest_found: 'No', droppings: 'No', evidence: 'None', action_taken: 'Bait replenished' },
          { s_no: 2, location: 'RM Godown Entrance', trap_no: 'EFC-01 (Fly Catcher)', observation: 'UV active', pest_found: 'No', droppings: 'No', evidence: 'None', action_taken: 'Inspected' },
          { s_no: 3, location: 'Milling Clean Zone', trap_no: 'GT-01 (Glue Trap)', observation: 'Clean', pest_found: 'No', droppings: 'No', evidence: 'None', action_taken: 'Checked' }
        ]
      };
    } else if (code === 'C5') {
      defaultChecklist = {
        customer: 'Royal Foods Exporters',
        quantity: '500 Bags (25 MT)',
        vehicle_no: 'TN-58-AX-9912',
        movement_type: 'Loading (Finished Goods Dispatch)',
        checklist: [
          { s_no: 1, check_point: 'Cleanliness of truck — Dust/Dirt', ok: true, not_ok: false, remarks: 'Clean and swept dry' },
          { s_no: 2, check_point: 'No Pest/Pest Droppings', ok: true, not_ok: false, remarks: 'Nil insect/pest' },
          { s_no: 3, check_point: 'No Foreign Material/Moisture', ok: true, not_ok: false, remarks: 'Dry floor' },
          { s_no: 4, check_point: 'Doors Intact / Good Condition', ok: true, not_ok: false, remarks: 'Seals tight' },
          { s_no: 5, check_point: 'No Corrosion', ok: true, not_ok: false, remarks: 'Smooth interior' },
          { s_no: 6, check_point: 'Truck Sealing — Empty/After Loading', ok: true, not_ok: false, remarks: 'Seal #BVC-SL-9014' },
          { s_no: 7, check_point: 'Unwanted Odour', ok: true, not_ok: false, remarks: 'Neutral, zero smell' },
          { s_no: 8, check_point: 'Tarpaulin — Clean/Damaged', ok: true, not_ok: false, remarks: 'Heavy-duty water tight' },
          { s_no: 9, check_point: 'General Acceptance of Truck', ok: true, not_ok: false, remarks: 'Accepted for food shipment' }
        ]
      };
    } else if (code === 'C6') {
      defaultChecklist = {
        inspection_time: '08:00 AM & 02:00 PM',
        checklist: [
          { item: 'Floor', status: 'OK', remarks: 'Dry and scrubbed' },
          { item: 'Toilet bowl', status: 'OK', remarks: 'Sanitized' },
          { item: 'Wash basin', status: 'OK', remarks: 'Clean' },
          { item: 'Doors', status: 'OK', remarks: 'Handles disinfected' },
          { item: 'Walls', status: 'OK', remarks: 'Wiped' },
          { item: 'Water availability', status: 'OK', remarks: 'Continuous supply' },
          { item: 'Cleaning material / Liquid Soap', status: 'OK', remarks: 'Refilled' },
          { item: 'Waste bin', status: 'OK', remarks: 'Cleared & lined' },
          { item: 'Odour', status: 'OK', remarks: 'Exhaust operational' },
          { item: 'Overall cleanliness', status: 'OK', remarks: 'Hygienic' }
        ]
      };
    } else if (code === 'C7') {
      defaultChecklist = {
        visitor_name: '',
        visitor_company: '',
        contact_no: '',
        purpose: 'Surveillance & Quality Review',
        area_to_visit: 'Milling & Packaging Hall',
        declaration_questions: [
          { question: 'Suffering from any communicable disease, flu, cough, or diarrhea?', answer: 'No' },
          { question: 'Recent exposure to contamination or infectious outbreak?', answer: 'No' },
          { question: 'Agreed to follow factory GMP & hygiene rules (No jewelry, watch, perfume)?', answer: 'Yes' },
          { question: 'Protective clothing (Hairnet, Coat, Shoe Covers) issued & worn?', answer: 'Yes' },
          { question: 'Visitor safety guidelines briefing provided?', answer: 'Yes' }
        ],
        declaration_status: 'ACCEPTED',
        visitor_signature_ack: 'Signed'
      };
    } else if (code === 'C8') {
      defaultChecklist = {
        supplier: '',
        purchase_no: '',
        packing_material: '25kg HDPE Bags with Food-grade LDPE Liner',
        lot_batch_no: '',
        quantity_received: '5,000 Bags',
        parameters: [
          { parameter: 'Material identity', requirement: 'Virgin HDPE, Food-grade printed', observed: 'Conforms to spec', result: 'Pass', remarks: 'Food grade mark present' },
          { parameter: 'Quantity', requirement: '5,000 Bags', observed: '5,000 Bags verified', result: 'Pass', remarks: 'Count matched' },
          { parameter: 'Packaging condition', requirement: 'Wrapped in waterproof stretch film', observed: 'Intact, no damage', result: 'Pass', remarks: 'Well protected' },
          { parameter: 'Cleanliness', requirement: 'Dust-free, dry, no grease', observed: 'Clean and odorless', result: 'Pass', remarks: 'No chemical smell' },
          { parameter: 'Damage', requirement: 'Zero cuts, pinholes or tears', observed: 'Zero defects in sample pull', result: 'Pass', remarks: 'AQL 1.0 passed' },
          { parameter: 'Moisture', requirement: 'Dry storage condition', observed: 'Dry', result: 'Pass', remarks: 'Moisture nil' },
          { parameter: 'Foreign material', requirement: 'Zero dirt, insect, foreign matter', observed: 'Clean interior liner', result: 'Pass', remarks: 'Virgin LDPE liner clean' },
          { parameter: 'Print / labelling', requirement: 'BVC Exports Pvt. Ltd., FSSAI, Batch, Net Wt', observed: 'Sharp legible print', result: 'Pass', remarks: 'Text and barcode crisp' },
          { parameter: 'Specification compliance', requirement: 'GSM 120 ± 5%, Bursting 18 kg/cm2', observed: 'GSM 122, Bursting 19.4', result: 'Pass', remarks: 'Tested in QC lab' }
        ],
        final_result: 'ACCEPT'
      };
    } else if (code === 'C9') {
      defaultChecklist = {
        shift: 'Morning Shift (08:00 - 16:30)',
        department: 'Milling & Packing Section',
        total_employees: 5,
        checked: 5,
        passed: 5,
        failed: 0,
        employees: [
          { s_no: 1, emp_name: 'Murugan K', emp_id: 'EMP-012', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Compliant' },
          { s_no: 2, emp_name: 'Suresh P', emp_id: 'EMP-019', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Compliant' },
          { s_no: 3, emp_name: 'Anand R', emp_id: 'EMP-023', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Compliant' },
          { s_no: 4, emp_name: 'Kavitha M', emp_id: 'EMP-031', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Compliant' },
          { s_no: 5, emp_name: 'Govindan V', emp_id: 'EMP-044', uniform: 'Yes', hairnet: 'Yes', clean_hands: 'Yes', trimmed_nails: 'Yes', no_jewelry: 'Yes', footwear: 'Yes', health: 'Fit', status: 'PASS', remarks: 'Compliant' }
        ]
      };
    } else if (code === 'C10') {
      defaultChecklist = {
        machine_name: 'Pulse Hammer Mill #01 (50 HP Heavy Duty)',
        machine_id: 'MCH-MIL-01',
        location: 'Milling Line 1',
        operator: 'Murugan K',
        parameters: [
          { check_point: 'Machine cleanliness', result: 'Acceptable', remarks: 'Casing and hopper cleaned' },
          { check_point: 'Food residue', result: 'Acceptable', remarks: 'Zero old meal buildup' },
          { check_point: 'Foreign material', result: 'Acceptable', remarks: 'Magnetic guard cleared' },
          { check_point: 'Lubrication condition', result: 'Acceptable', remarks: 'Food grade grease (NSF H1) topped' },
          { check_point: 'Guard condition', result: 'Acceptable', remarks: 'Belt drive guards secure' },
          { check_point: 'Electrical condition', result: 'Acceptable', remarks: 'Earthing & conduit intact' },
          { check_point: 'Physical damage', result: 'Acceptable', remarks: 'Hammer beaters wear < 5%' },
          { check_point: 'Abnormal noise / vibration', result: 'Acceptable', remarks: 'Bearing temp 48°C (Normal)' },
          { check_point: 'Safety condition', result: 'Acceptable', remarks: 'Emergency stop tested functional' },
          { check_point: 'General condition', result: 'Acceptable', remarks: 'Good for continuous production' }
        ],
        machine_status: 'Acceptable',
        problem: '-',
        action_required: '-',
        target_date: '-',
        completion_date: today
      };
    }

    return {
      record_code: code,
      record_no: recNo,
      record_date: today,
      area_location: meta.target || 'Factory Premises',
      frequency: meta.freq || 'Daily',
      company_name: 'BVC Exports Pvt. Ltd.',
      financial_year: '2026-2027',
      inspector_name: 'Sanitation Officer',
      supervisor_name: 'Plant Supervisor',
      prepared_by: 'Inspector QA',
      verified_by: 'QA Manager',
      customer_name: '',
      supplier_name: '',
      vehicle_no: '',
      status: 'COMPLETED',
      overall_status: 'PASS',
      corrective_action: 'None required. Standard operational compliance maintained.',
      remarks: `${meta.label} inspected and found compliant with ISO 22000:2018 standards.`,
      checklist: defaultChecklist
    };
  }

  // Fetch cleaning records
  const fetchRecords = async () => {
    try {
      setLoading(true);
      let url = `/api/compliance/cleaning-records?record_code=${selectedCode}`;
      if (statusFilter !== 'ALL') url += `&overall_status=${statusFilter}`;
      if (fromDate) url += `&from_date=${fromDate}`;
      if (toDate) url += `&to_date=${toDate}`;
      if (searchTerm) url += `&search=${encodeURIComponent(searchTerm)}`;

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setRecords(data.records || []);
      }
    } catch (err) {
      console.error('Error fetching cleaning records:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch cleaning schedule summary
  const fetchScheduleSummary = async () => {
    try {
      setScheduleLoading(true);
      const res = await fetch('/api/compliance/cleaning-schedule-summary');
      const data = await res.json();
      if (data.success) {
        setScheduleSummary(data.summary || []);
      }
    } catch (err) {
      console.error('Error fetching schedule summary:', err);
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [selectedCode, statusFilter, fromDate, toDate]);

  useEffect(() => {
    fetchScheduleSummary();
  }, []);

  const handleResetFilters = () => {
    setSelectedCode('ALL');
    setStatusFilter('ALL');
    setFromDate('');
    setToDate('');
    setSearchTerm('');
  };

  const handleCodeSelect = (code) => {
    setSelectedCode(code);
    if (activeTab !== 0) setActiveTab(0);
  };

  const handleStartNewRecord = (code = 'C1') => {
    setIsEditing(false);
    setEditingId(null);
    setFormState(getInitialFormState(code));
    setActiveTab(2); // switch to Form tab
  };

  const handleEditRecord = (record) => {
    setIsEditing(true);
    setEditingId(record.id);
    setFormState({
      record_code: record.record_code,
      record_no: record.record_no,
      record_date: record.record_date,
      area_location: record.area_location || '',
      frequency: record.frequency || 'Daily',
      company_name: record.company_name || 'BVC Exports Pvt. Ltd.',
      financial_year: record.financial_year || '2026-2027',
      inspector_name: record.inspector_name || '',
      supervisor_name: record.supervisor_name || '',
      prepared_by: record.prepared_by || '',
      verified_by: record.verified_by || '',
      customer_name: record.customer_name || '',
      supplier_name: record.supplier_name || '',
      vehicle_no: record.vehicle_no || '',
      status: record.status || 'COMPLETED',
      overall_status: record.overall_status || 'PASS',
      corrective_action: record.corrective_action || '',
      remarks: record.remarks || '',
      checklist: record.checklist || {}
    });
    setActiveTab(2);
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this cleaning checklist record?')) return;
    try {
      const res = await fetch(`/api/compliance/cleaning-records/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        fetchRecords();
        fetchScheduleSummary();
      }
    } catch (err) {
      console.error('Error deleting record:', err);
    }
  };

  const handleApplyInventoryPreset = (presetName) => {
    const preset = INVENTORY_PRESETS.find(p => p.name === presetName);
    if (!preset) return;
    
    // Switch to code if different
    let currentInitial = formState;
    if (formState.record_code !== preset.code) {
      currentInitial = getInitialFormState(preset.code);
    }

    const mergedChecklist = { ...(currentInitial.checklist || {}), ...preset.data };

    setFormState({
      ...currentInitial,
      record_code: preset.code,
      area_location: preset.data.area_location || currentInitial.area_location,
      inspector_name: preset.data.inspector_name || formState.inspector_name || '',
      supervisor_name: preset.data.supervisor_name || formState.supervisor_name || '',
      customer_name: preset.data.customer_name || currentInitial.customer_name || '',
      supplier_name: preset.data.supplier_name || currentInitial.supplier_name || '',
      vehicle_no: preset.data.vehicle_no || currentInitial.vehicle_no || '',
      checklist: mergedChecklist
    });
  };

  const handleQuickMarkAllOk = () => {
    const code = formState.record_code;
    const currentChk = { ...(formState.checklist || {}) };

    if (code === 'C1' && currentChk.cleaning_points) {
      currentChk.cleaning_points = currentChk.cleaning_points.map(p => ({ ...p, status: 'OK', remarks: 'Clean & sanitised' }));
    } else if (code === 'C2' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, result: 'OK', remarks: 'Compliant' }));
    } else if (code === 'C3' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, status: 'OK', condition: 'Secure' }));
    } else if (code === 'C4' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, result: 'Pass', remarks: 'Sanitized' }));
    } else if (code === 'C5' && currentChk.windows) {
      currentChk.windows = currentChk.windows.map(w => ({ ...w, status: 'OK', integrity: 'Intact', remarks: 'Cleaned with Colin' }));
    } else if (code === 'C6' && currentChk.steps) {
      currentChk.steps = currentChk.steps.map(s => ({ ...s, status: 'OK' }));
    } else if (code === 'C7' && currentChk.checklist) {
      currentChk.checklist = currentChk.checklist.map(c => ({ ...c, status: 'Yes', remarks: 'Clean & available' }));
    } else if (code === 'C8' && currentChk.checklist) {
      currentChk.checklist = currentChk.checklist.map(c => ({ ...c, status: 'OK', remarks: 'Pass' }));
    } else if (code === 'C9' && currentChk.employees) {
      currentChk.employees = currentChk.employees.map(e => ({
        ...e,
        ppe: '✓',
        nails: '✓',
        wounds: '✓',
        illness: '✓',
        jewels: '✓',
        chemicals: '✓',
        smoking: '✓',
        remarks: 'Fit',
        action: 'Nil'
      }));
    } else if (code === 'C10' && currentChk.parameters) {
      currentChk.parameters = currentChk.parameters.map(p => ({ ...p, result: 'Pass', observed: 'Conforms to standard' }));
    }

    setFormState({
      ...formState,
      overall_status: 'PASS',
      checklist: currentChk
    });
  };

  const handleSaveForm = async (e, autoPrint = false) => {
    if (e && e.preventDefault) e.preventDefault();
    try {
      const url = isEditing
        ? `/api/compliance/cleaning-records/${editingId}`
        : '/api/compliance/cleaning-records';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formState)
      });
      const data = await res.json();
      if (data.success) {
        fetchRecords();
        fetchScheduleSummary();
        if (onRefresh) onRefresh();

        if (autoPrint) {
          const savedData = data.record || formState;
          setViewingRecord(savedData);
          setIsBlankPrint(false);
        } else {
          alert(isEditing ? 'Cleaning record updated successfully!' : 'Cleaning record saved successfully!');
          setActiveTab(0); // return to register
        }
      } else {
        alert(`Error: ${data.message || data.error}`);
      }
    } catch (err) {
      console.error('Error saving cleaning record:', err);
      alert('Failed to save cleaning record.');
    }
  };

  // Helper for status badge rendering
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'PASS':
      case 'COMPLIANT':
        return <Chip icon={<CheckCircleIcon />} label="PASS / COMPLIANT" size="small" color="success" sx={{ fontWeight: 600 }} />;
      case 'ACTION_REQUIRED':
      case 'DUE_SOON':
      case 'DUE_TODAY':
        return <Chip icon={<WarningAmberIcon />} label={status.replace('_', ' ')} size="small" color="warning" sx={{ fontWeight: 600 }} />;
      case 'FAIL':
      case 'OVERDUE':
        return <Chip icon={<ErrorOutlineIcon />} label={status} size="small" color="error" sx={{ fontWeight: 600 }} />;
      case 'EVENT_TRIGGERED':
        return <Chip label="ON EVENT (LOADING/RECEIVING)" size="small" color="info" sx={{ fontWeight: 600 }} />;
      default:
        return <Chip label={status || 'COMPLETED'} size="small" variant="outlined" />;
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!records.length) return alert('No records to export');
    const headers = ['Record Code', 'Record No', 'Date', 'Frequency', 'Area/Location', 'Inspector', 'Supervisor', 'Overall Status', 'Remarks'];
    const rows = records.map(r => [
      r.record_code,
      r.record_no,
      r.record_date,
      r.frequency,
      `"${(r.area_location || '').replace(/"/g, '""')}"`,
      `"${(r.inspector_name || '').replace(/"/g, '""')}"`,
      `"${(r.supervisor_name || '').replace(/"/g, '""')}"`,
      r.overall_status,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `BVC_Cleaning_Records_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Box sx={{ width: '100%', pb: 4 }}>
      {/* Top Header Card */}
      <Paper elevation={2} sx={{ p: 2.5, mb: 3, borderRadius: 2, borderLeft: '6px solid #1976d2' }}>
        <Grid container alignItems="center" justifyContent="space-between" spacing={2}>
          <Grid item xs={12} md={7}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <CleaningServicesIcon color="primary" sx={{ fontSize: 36 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700, color: '#1a237e' }}>
                  BVC Exports Pvt. Ltd. — Cleaning & Control Records (C1–C10)
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ISO 22000:2018 & FSSAI Compliant Sanitation, Pest, Pallet, Vehicle, Glass, Machinery & Hygiene Registers
                </Typography>
              </Box>
            </Stack>
          </Grid>
          <Grid item xs={12} md={5}>
            <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => { fetchRecords(); fetchScheduleSummary(); }}
                size="small"
              >
                Refresh
              </Button>
              <Button
                variant="outlined"
                startIcon={<FileDownloadIcon />}
                onClick={handleExportCSV}
                size="small"
                color="secondary"
              >
                Export CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<PrintIcon />}
                onClick={() => {
                  setViewingRecord(getInitialFormState(selectedCode === 'ALL' ? 'C1' : selectedCode));
                  setIsBlankPrint(true);
                }}
                size="small"
                color="primary"
                sx={{ fontWeight: 600 }}
              >
                Print Blank Paper Form
              </Button>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => handleStartNewRecord(selectedCode === 'ALL' ? 'C1' : selectedCode)}
                size="small"
                sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#1565c0' }, fontWeight: 700 }}
              >
                + New Checklist Entry
              </Button>
            </Stack>
          </Grid>
        </Grid>

        {/* View Tabs */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 2.5 }}>
          <Tabs
            value={activeTab}
            onChange={(e, val) => setActiveTab(val)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab icon={<FactCheckIcon fontSize="small" />} iconPosition="start" label="Cleaning Records Register" />
            <Tab icon={<ScheduleIcon fontSize="small" />} iconPosition="start" label="C1–C10 Schedule & Due Dates" />
            <Tab icon={<AddIcon fontSize="small" />} iconPosition="start" label={isEditing ? 'Edit Checklist Record' : 'Create Checklist Entry'} />
          </Tabs>
        </Box>
      </Paper>

      {/* Proactive Audit & Frequency Notification Banner */}
      {(() => {
        const overdueList = scheduleSummary.filter(s => s.scheduleStatus === 'OVERDUE');
        const dueTodayList = scheduleSummary.filter(s => s.scheduleStatus === 'DUE_TODAY' || s.scheduleStatus === 'DUE_SOON');
        if (overdueList.length === 0 && dueTodayList.length === 0) return null;
        return (
          <Box sx={{ mb: 3 }}>
            {overdueList.length > 0 && (
              <Alert
                severity="error"
                icon={<ErrorOutlineIcon />}
                action={
                  <Button color="inherit" size="small" onClick={() => setActiveTab(1)}>
                    View Schedule Matrix
                  </Button>
                }
                sx={{ mb: 1.5, borderRadius: 2 }}
              >
                <strong>Compliance Attention Required ({overdueList.length} Overdue):</strong>{' '}
                {overdueList.map(o => `${o.code} (${o.name} - Mandated: ${o.frequency})`).join(' • ')} — Immediate inspection update required!
              </Alert>
            )}
            {dueTodayList.length > 0 && (
              <Alert
                severity="warning"
                icon={<WarningAmberIcon />}
                action={
                  <Button color="inherit" size="small" onClick={() => setActiveTab(1)}>
                    View Due Dates
                  </Button>
                }
                sx={{ borderRadius: 2 }}
              >
                <strong>Checklists Due for Inspection ({dueTodayList.length}):</strong>{' '}
                {dueTodayList.map(d => `${d.code} (${d.name} - Next Due: ${d.nextDueDate || 'Today'})`).join(' • ')}
              </Alert>
            )}
          </Box>
        );
      })()}

      {/* C1 to C10 Frequency Quick Filter Bar */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600, color: '#455a64' }}>
          Select Cleaning Record Format (C1–C10):
        </Typography>
        <Grid container spacing={1}>
          {CLEANING_RECORDS.map((item) => {
            const isSelected = selectedCode === item.code;
            return (
              <Grid item xs={6} sm={4} md={2.4} key={item.code}>
                <Card
                  onClick={() => handleCodeSelect(item.code)}
                  sx={{
                    cursor: 'pointer',
                    p: 1.2,
                    borderRadius: 1.5,
                    border: isSelected ? '2px solid #1976d2' : '1px solid #e0e0e0',
                    bgcolor: isSelected ? '#e3f2fd' : '#ffffff',
                    transition: 'all 0.2s',
                    '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' }
                  }}
                >
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Box sx={{ color: item.color || '#1976d2' }}>
                      {item.icon}
                    </Box>
                    <Box sx={{ overflow: 'hidden' }}>
                      <Typography variant="caption" sx={{ fontWeight: 700, display: 'block', noWrap: true }}>
                        {item.code} {item.code !== 'ALL' && `— ${item.freq}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {item.label.replace(`${item.code}: `, '')}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Box>

      {/* TAB 0: CLEANING RECORDS REGISTER */}
      {activeTab === 0 && (
        <Box>
          {/* Search & Filter Bar */}
          <Paper sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6} md={3.5}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search Record # / Area / Inspector / Notes"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchRecords()}
                  InputProps={{
                    endAdornment: (
                      <IconButton size="small" onClick={fetchRecords}>
                        <SearchIcon fontSize="small" />
                      </IconButton>
                    )
                  }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <TextField
                  fullWidth
                  select
                  size="small"
                  label="Result Status"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <MenuItem value="ALL">All Results</MenuItem>
                  <MenuItem value="PASS">PASS</MenuItem>
                  <MenuItem value="ACTION_REQUIRED">ACTION REQUIRED</MenuItem>
                  <MenuItem value="FAIL">FAIL</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="From Date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="To Date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6} sm={3} md={2.5}>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" size="small" onClick={fetchRecords} sx={{ flex: 1 }}>
                    Filter
                  </Button>
                  <Button variant="outlined" size="small" onClick={handleResetFilters}>
                    Reset
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Records Table */}
          <TableContainer component={Paper} elevation={1} sx={{ borderRadius: 2 }}>
            <Table size="small">
              <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>S.No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Format Code</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Record No</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Frequency</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Area / Location</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Inspector / Verified By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 700 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <CircularProgress size={32} />
                      <Typography variant="body2" sx={{ mt: 1 }}>Loading BVC Cleaning Records...</Typography>
                    </TableCell>
                  </TableRow>
                ) : records.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        No cleaning records found for the selected criteria.
                      </Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={() => handleStartNewRecord(selectedCode === 'ALL' ? 'C1' : selectedCode)}
                        sx={{ mt: 1.5 }}
                      >
                        Create New Entry
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  records.map((r, idx) => (
                    <TableRow key={r.id} hover>
                      <TableCell>{idx + 1}</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{r.record_date}</TableCell>
                      <TableCell>
                        <Chip
                          label={r.record_code}
                          size="small"
                          color={r.record_code === 'C1' ? 'primary' : r.record_code === 'C4' ? 'error' : r.record_code === 'C5' ? 'secondary' : 'default'}
                          sx={{ fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.record_no}</TableCell>
                      <TableCell>{r.frequency}</TableCell>
                      <TableCell>{r.area_location || r.customer_name || r.vehicle_no || '-'}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{r.inspector_name || '-'}</Typography>
                        <Typography variant="caption" color="text.secondary">Ver: {r.verified_by || '-'}</Typography>
                      </TableCell>
                      <TableCell>{renderStatusBadge(r.overall_status)}</TableCell>
                      <TableCell>
                        <Chip label={r.status || 'COMPLETED'} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell align="center">
                        <Stack direction="row" spacing={0.5} justifyContent="center">
                          <Tooltip title="Print Official BVC Paper Record">
                            <IconButton
                              size="small"
                              sx={{ color: '#0f172a' }}
                              onClick={() => {
                                setViewingRecord(r);
                                setIsBlankPrint(false);
                              }}
                            >
                              <PrintIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="View Certificate Preview">
                            <IconButton size="small" color="primary" onClick={() => { setViewingRecord(r); setIsBlankPrint(false); }}>
                              <VisibilityIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Record">
                            <IconButton size="small" color="info" onClick={() => handleEditRecord(r)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Record">
                            <IconButton size="small" color="error" onClick={() => handleDeleteRecord(r.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      )}

      {/* TAB 1: SCHEDULE & DUE DATES OVERVIEW */}
      {activeTab === 1 && (
        <Box>
          <Paper elevation={1} sx={{ p: 2, mb: 3, bgcolor: '#f8fafc', borderRadius: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a237e', mb: 1 }}>
              BVC Sanitation & Preventive Inspection Matrix (C1–C10 Compliance Schedule)
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Real-time audit tracking based on predefined statutory frequencies (Daily, 15 Days Once, Monthly Once, Event Triggered).
            </Typography>
          </Paper>

          <Grid container spacing={2}>
            {scheduleSummary.map((item) => (
              <Grid item xs={12} md={6} lg={4} key={item.code}>
                <Card sx={{ height: '100%', borderLeft: `6px solid ${item.scheduleStatus === 'OVERDUE' ? '#d32f2f' : item.scheduleStatus === 'DUE_TODAY' || item.scheduleStatus === 'DUE_SOON' ? '#ed6c02' : '#2e7d32'}`, boxShadow: 2 }}>
                  <CardContent sx={{ pb: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Chip label={item.code} color="primary" size="small" sx={{ fontWeight: 700 }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{item.name}</Typography>
                      </Stack>
                      {renderStatusBadge(item.scheduleStatus)}
                    </Stack>

                    <Divider sx={{ my: 1 }} />

                    <Grid container spacing={1} sx={{ fontSize: '0.85rem', mt: 0.5 }}>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" display="block">Mandated Frequency:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.frequency}</Typography>
                      </Grid>
                      <Grid item xs={6}>
                        <Typography variant="caption" color="text.secondary" display="block">Target Scope:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{item.target}</Typography>
                      </Grid>

                      <Grid item xs={6} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">Last Completed:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#1b5e20' }}>
                          {item.lastCompletedDate || 'No Record'}
                        </Typography>
                      </Grid>
                      <Grid item xs={6} sx={{ mt: 1 }}>
                        <Typography variant="caption" color="text.secondary" display="block">Next Due Date:</Typography>
                        <Typography variant="body2" sx={{ fontWeight: 700, color: item.daysRemaining < 0 ? '#d32f2f' : '#0d47a1' }}>
                          {item.nextDueDate || (item.intervalDays === 0 ? 'On Next Event' : 'Pending Initial Audit')}
                        </Typography>
                      </Grid>
                    </Grid>

                    <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px dashed #e0e0e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary">
                        {item.lastRecord ? `Last Ref: ${item.lastRecord.record_no}` : 'Awaiting entry'}
                      </Typography>
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => handleStartNewRecord(item.code)}
                      >
                        Log Now
                      </Button>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {/* TAB 2: CREATE / EDIT RECORD FORM */}
      {activeTab === 2 && (
        <Paper component="form" onSubmit={(e) => handleSaveForm(e, false)} elevation={2} sx={{ p: 3, borderRadius: 2 }}>
          {/* Form Header */}
          <Box sx={{ pb: 2, mb: 3, borderBottom: '2px solid #1976d2' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1a237e' }}>
                  {isEditing ? `Edit Checklist Record: ${formState.record_no}` : `Create New Cleaning & Control Checklist (${formState.record_code})`}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  BVC Exports Pvt. Ltd. — Quality Assurance & Sanitation Audit Form
                </Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PrintIcon />}
                  onClick={() => {
                    setViewingRecord(formState);
                    setIsBlankPrint(true);
                  }}
                  sx={{ color: '#334155' }}
                >
                  Print Blank Sheet
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<VisibilityIcon />}
                  onClick={() => {
                    setViewingRecord(formState);
                    setIsBlankPrint(false);
                  }}
                  color="primary"
                >
                  Live Paper Preview
                </Button>
                <Button variant="outlined" size="small" onClick={() => setActiveTab(0)}>
                  Cancel / Return
                </Button>
              </Stack>
            </Stack>
          </Box>

          {/* Quick-Fill & Inventory Preset Bar */}
          <Paper elevation={0} sx={{ p: 2, mb: 3, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 2 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={7}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <AutoAwesomeIcon sx={{ color: '#15803d' }} />
                  <TextField
                    select
                    fullWidth
                    size="small"
                    label="⚡ Auto-Fill From ERP Inventory & Machinery Masters"
                    defaultValue=""
                    onChange={(e) => handleApplyInventoryPreset(e.target.value)}
                    sx={{ bgcolor: '#fff' }}
                  >
                    <MenuItem value="" disabled>-- Select Machinery / Lot / Pallet / Packing Preset --</MenuItem>
                    {INVENTORY_PRESETS.map((p, idx) => (
                      <MenuItem key={idx} value={p.name}>
                        <strong>[{p.code}]</strong> {p.name}
                      </MenuItem>
                    ))}
                  </TextField>
                </Stack>
              </Grid>
              <Grid item xs={12} md={5}>
                <Stack direction="row" spacing={1.5} justifyContent={{ xs: 'flex-start', md: 'flex-end' }}>
                  <Button
                    variant="contained"
                    size="small"
                    color="success"
                    startIcon={<CheckCircleIcon />}
                    onClick={handleQuickMarkAllOk}
                    sx={{ fontWeight: 700 }}
                  >
                    ✓ Check All Activities as OK / Pass
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </Paper>

          {/* Section 1: Record Identification & Header Details */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1976d2', mb: 2 }}>
            1. Record Information & Audit Scope
          </Typography>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                select
                size="small"
                label="Record Format Code"
                value={formState.record_code}
                onChange={(e) => {
                  const newCode = e.target.value;
                  const newInitial = getInitialFormState(newCode);
                  setFormState({
                    ...newInitial,
                    company_name: formState.company_name,
                    financial_year: formState.financial_year,
                    inspector_name: formState.inspector_name,
                    supervisor_name: formState.supervisor_name
                  });
                }}
                disabled={isEditing}
              >
                {CLEANING_RECORDS.filter(c => c.code !== 'ALL').map(c => (
                  <MenuItem key={c.code} value={c.code}>
                    {c.code}: {c.label.replace(`${c.code}: `, '')} ({c.freq})
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Record / Audit No"
                value={formState.record_no}
                onChange={(e) => setFormState({ ...formState, record_no: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                type="date"
                label="Audit / Inspection Date"
                value={formState.record_date}
                onChange={(e) => setFormState({ ...formState, record_date: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                size="small"
                label="Mandated Frequency"
                value={formState.frequency}
                onChange={(e) => setFormState({ ...formState, frequency: e.target.value })}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Company Name"
                value={formState.company_name}
                onChange={(e) => setFormState({ ...formState, company_name: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Financial Year"
                value={formState.financial_year}
                onChange={(e) => setFormState({ ...formState, financial_year: e.target.value })}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                size="small"
                label="Area / Facility Location"
                value={formState.area_location}
                onChange={(e) => setFormState({ ...formState, area_location: e.target.value })}
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Section 2: Dynamic Dedicated Checklist Fields for C1 through C10 */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1976d2', mb: 2 }}>
            2. Specific Inspection Checkpoints ({formState.record_code})
          </Typography>

          {/* ================= C1: PRODUCTION AREA CLEANING ================= */}
          {formState.record_code === 'C1' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Operational Shift"
                    value={formState.checklist?.shift || 'Morning (Shift 1)'}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, shift: e.target.value }
                    })}
                  />
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: '25%' }}>Cleaning Point</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: '25%' }}>Status (OK / NOT OK)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Observations & Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.cleaning_points || []).map((cp, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{cp.point}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant={cp.status === 'OK' ? 'contained' : 'outlined'}
                              color="success"
                              onClick={() => {
                                const pts = [...formState.checklist.cleaning_points];
                                pts[idx].status = 'OK';
                                setFormState({ ...formState, checklist: { ...formState.checklist, cleaning_points: pts } });
                              }}
                            >
                              OK
                            </Button>
                            <Button
                              size="small"
                              variant={cp.status === 'NOT OK' ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() => {
                                const pts = [...formState.checklist.cleaning_points];
                                pts[idx].status = 'NOT OK';
                                setFormState({ ...formState, checklist: { ...formState.checklist, cleaning_points: pts } });
                              }}
                            >
                              NOT OK
                            </Button>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={cp.remarks}
                            onChange={(e) => {
                              const pts = [...formState.checklist.cleaning_points];
                              pts[idx].remarks = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, cleaning_points: pts } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C2: WOODEN PALLET CONTROL ================= */}
          {formState.record_code === 'C2' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Pallet ID / Batch"
                    value={formState.checklist?.pallet_id || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, pallet_id: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Quantity Inspected"
                    value={formState.checklist?.quantity || 0}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, quantity: parseInt(e.target.value, 10) || 0 }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="Pallet Action"
                    value={formState.checklist?.action || 'Accepted'}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, action: e.target.value }
                    })}
                  >
                    <MenuItem value="Accepted">Accepted for Food Storage</MenuItem>
                    <MenuItem value="Segregated">Segregated for Repair</MenuItem>
                    <MenuItem value="Rejected">Rejected / Scrapped</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Inspection Parameter</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Finding (OK / Yes / No)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.parameters || []).map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{p.parameter}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={p.result}
                            onChange={(e) => {
                              const params = [...formState.checklist.parameters];
                              params[idx].result = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, parameters: params } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={p.remarks}
                            onChange={(e) => {
                              const params = [...formState.checklist.parameters];
                              params[idx].remarks = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, parameters: params } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C3: GLASS & PLASTIC CONTROL ================= */}
          {formState.record_code === 'C3' && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Brittle Glass & Hard Plastic Register
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const objs = [...(formState.checklist?.objects_checked || [])];
                    objs.push({
                      s_no: objs.length + 1,
                      location: 'Factory Floor',
                      object_item: 'New Glass / Plastic Fixture',
                      material_type: 'Acrylic / Glass',
                      condition: 'OK',
                      damage_found: 'No',
                      action: '-',
                      remarks: 'Inspected'
                    });
                    setFormState({ ...formState, checklist: { ...formState.checklist, objects_checked: objs } });
                  }}
                >
                  + Add Fixture Row
                </Button>
              </Stack>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Location</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Item / Object</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Material Type</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Condition</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Damage Found?</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Action / Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.objects_checked || []).map((obj, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <TextField
                            size="small"
                            value={obj.location}
                            onChange={(e) => {
                              const list = [...formState.checklist.objects_checked];
                              list[idx].location = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, objects_checked: list } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={obj.object_item}
                            onChange={(e) => {
                              const list = [...formState.checklist.objects_checked];
                              list[idx].object_item = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, objects_checked: list } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={obj.material_type}
                            onChange={(e) => {
                              const list = [...formState.checklist.objects_checked];
                              list[idx].material_type = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, objects_checked: list } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={obj.condition}
                            onChange={(e) => {
                              const list = [...formState.checklist.objects_checked];
                              list[idx].condition = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, objects_checked: list } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={obj.damage_found}
                            onChange={(e) => {
                              const list = [...formState.checklist.objects_checked];
                              list[idx].damage_found = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, objects_checked: list } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={obj.remarks}
                            onChange={(e) => {
                              const list = [...formState.checklist.objects_checked];
                              list[idx].remarks = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, objects_checked: list } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C4: PEST CONTROL MONITORING ================= */}
          {formState.record_code === 'C4' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Inspection Time"
                    value={formState.checklist?.inspection_time || '08:30 AM'}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, inspection_time: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    size="small"
                    label="Pest Infestation Status"
                    value={formState.checklist?.pest_status || 'No Pest Evidence'}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, pest_status: e.target.value }
                    })}
                  >
                    <MenuItem value="No Pest Evidence">No Pest Evidence Observed</MenuItem>
                    <MenuItem value="Pest Evidence Found">Pest Activity / Evidence Detected</MenuItem>
                    <MenuItem value="Action Required">Corrective Action / Fogging Required</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Location & Trap #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Observation</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Pest Found?</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Action Taken</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.monitoring_points || []).map((mp, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{mp.location} ({mp.trap_no})</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={mp.observation}
                            onChange={(e) => {
                              const pts = [...formState.checklist.monitoring_points];
                              pts[idx].observation = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, monitoring_points: pts } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={mp.pest_found}
                            onChange={(e) => {
                              const pts = [...formState.checklist.monitoring_points];
                              pts[idx].pest_found = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, monitoring_points: pts } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={mp.action_taken}
                            onChange={(e) => {
                              const pts = [...formState.checklist.monitoring_points];
                              pts[idx].action_taken = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, monitoring_points: pts } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C5: VEHICLE LOADING / UNLOADING ================= */}
          {formState.record_code === 'C5' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Customer / Supplier Name"
                    value={formState.customer_name || formState.checklist?.customer || ''}
                    onChange={(e) => {
                      setFormState({
                        ...formState,
                        customer_name: e.target.value,
                        checklist: { ...formState.checklist, customer: e.target.value }
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Vehicle / Lorry No"
                    value={formState.vehicle_no || formState.checklist?.vehicle_no || ''}
                    onChange={(e) => {
                      setFormState({
                        ...formState,
                        vehicle_no: e.target.value,
                        checklist: { ...formState.checklist, vehicle_no: e.target.value }
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Quantity Loaded / Dispatched"
                    value={formState.checklist?.quantity || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, quantity: e.target.value }
                    })}
                  />
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: '5%' }}>S.No</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: '40%' }}>Check Points</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: '20%' }}>Inspection Result</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Remarks & Observations</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.checklist || []).map((chk, idx) => (
                      <TableRow key={idx}>
                        <TableCell>{chk.s_no || idx + 1}</TableCell>
                        <TableCell sx={{ fontWeight: 600 }}>{chk.check_point}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant={chk.ok ? 'contained' : 'outlined'}
                              color="success"
                              onClick={() => {
                                const list = [...formState.checklist.checklist];
                                list[idx].ok = true;
                                list[idx].not_ok = false;
                                setFormState({ ...formState, checklist: { ...formState.checklist, checklist: list } });
                              }}
                            >
                              OK
                            </Button>
                            <Button
                              size="small"
                              variant={chk.not_ok ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() => {
                                const list = [...formState.checklist.checklist];
                                list[idx].ok = false;
                                list[idx].not_ok = true;
                                setFormState({ ...formState, checklist: { ...formState.checklist, checklist: list } });
                              }}
                            >
                              NOT OK
                            </Button>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={chk.remarks}
                            onChange={(e) => {
                              const list = [...formState.checklist.checklist];
                              list[idx].remarks = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, checklist: list } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C6: TOILET CLEANING CHECKLIST ================= */}
          {formState.record_code === 'C6' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Sanitation Timing"
                    value={formState.checklist?.inspection_time || '07:30 AM & 01:30 PM'}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, inspection_time: e.target.value }
                    })}
                  />
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700, width: '30%' }}>Facility Item</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: '25%' }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Observations</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.checklist || []).map((chk, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{chk.item}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            <Button
                              size="small"
                              variant={chk.status === 'OK' ? 'contained' : 'outlined'}
                              color="success"
                              onClick={() => {
                                const list = [...formState.checklist.checklist];
                                list[idx].status = 'OK';
                                setFormState({ ...formState, checklist: { ...formState.checklist, checklist: list } });
                              }}
                            >
                              OK
                            </Button>
                            <Button
                              size="small"
                              variant={chk.status === 'NOT OK' ? 'contained' : 'outlined'}
                              color="error"
                              onClick={() => {
                                const list = [...formState.checklist.checklist];
                                list[idx].status = 'NOT OK';
                                setFormState({ ...formState, checklist: { ...formState.checklist, checklist: list } });
                              }}
                            >
                              NOT OK
                            </Button>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={chk.remarks}
                            onChange={(e) => {
                              const list = [...formState.checklist.checklist];
                              list[idx].remarks = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, checklist: list } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C7: VISITOR DECLARATION ================= */}
          {formState.record_code === 'C7' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Visitor Name"
                    value={formState.checklist?.visitor_name || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, visitor_name: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Visitor Company / Organization"
                    value={formState.checklist?.visitor_company || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, visitor_company: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Contact Phone No"
                    value={formState.checklist?.contact_no || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, contact_no: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Purpose of Visit"
                    value={formState.checklist?.purpose || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, purpose: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Area to Visit"
                    value={formState.checklist?.area_to_visit || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, area_to_visit: e.target.value }
                    })}
                  />
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Food Safety & Medical Declaration Question</TableCell>
                      <TableCell sx={{ fontWeight: 700, width: '20%' }}>Declaration Answer</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.declaration_questions || []).map((dq, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{dq.question}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={dq.answer}
                            onChange={(e) => {
                              const list = [...formState.checklist.declaration_questions];
                              list[idx].answer = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, declaration_questions: list } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C8: PACKING MATERIAL INSPECTION ================= */}
          {formState.record_code === 'C8' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Supplier Name"
                    value={formState.supplier_name || formState.checklist?.supplier || ''}
                    onChange={(e) => {
                      setFormState({
                        ...formState,
                        supplier_name: e.target.value,
                        checklist: { ...formState.checklist, supplier: e.target.value }
                      });
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="PO / Invoice No"
                    value={formState.checklist?.purchase_no || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, purchase_no: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Lot / Batch No"
                    value={formState.checklist?.lot_batch_no || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, lot_batch_no: e.target.value }
                    })}
                  />
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Inspection Parameter</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Standard Requirement</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Observed Finding</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.parameters || []).map((p, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{p.parameter}</TableCell>
                        <TableCell>{p.requirement}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={p.observed}
                            onChange={(e) => {
                              const params = [...formState.checklist.parameters];
                              params[idx].observed = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, parameters: params } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={p.result}
                            onChange={(e) => {
                              const params = [...formState.checklist.parameters];
                              params[idx].result = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, parameters: params } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C9: FOOD HANDLER HYGIENE ================= */}
          {formState.record_code === 'C9' && (
            <Box sx={{ mb: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Food Handler Personal Hygiene Checkpoints
                </Typography>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={() => {
                    const emps = [...(formState.checklist?.employees || [])];
                    emps.push({
                      s_no: emps.length + 1,
                      emp_name: 'New Worker',
                      emp_id: `EMP-${Math.floor(100 + Math.random() * 900)}`,
                      uniform: 'Yes',
                      hairnet: 'Yes',
                      clean_hands: 'Yes',
                      trimmed_nails: 'Yes',
                      no_jewelry: 'Yes',
                      footwear: 'Yes',
                      health: 'Fit',
                      status: 'PASS',
                      remarks: 'Good'
                    });
                    setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps, total_employees: emps.length, checked: emps.length, passed: emps.length } });
                  }}
                >
                  + Add Food Handler
                </Button>
              </Stack>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Emp Name & ID</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Uniform Clean?</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Hairnet?</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Clean Hands / Nails?</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>No Jewelry?</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Health / Fit?</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Result</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.employees || []).map((emp, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <TextField
                            size="small"
                            value={emp.emp_name}
                            onChange={(e) => {
                              const emps = [...formState.checklist.employees];
                              emps[idx].emp_name = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={emp.uniform}
                            onChange={(e) => {
                              const emps = [...formState.checklist.employees];
                              emps[idx].uniform = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={emp.hairnet}
                            onChange={(e) => {
                              const emps = [...formState.checklist.employees];
                              emps[idx].hairnet = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={emp.clean_hands}
                            onChange={(e) => {
                              const emps = [...formState.checklist.employees];
                              emps[idx].clean_hands = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={emp.no_jewelry}
                            onChange={(e) => {
                              const emps = [...formState.checklist.employees];
                              emps[idx].no_jewelry = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={emp.health}
                            onChange={(e) => {
                              const emps = [...formState.checklist.employees];
                              emps[idx].health = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={emp.status}
                            onChange={(e) => {
                              const emps = [...formState.checklist.employees];
                              emps[idx].status = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, employees: emps } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          {/* ================= C10: MACHINERY CHECKLIST ================= */}
          {formState.record_code === 'C10' && (
            <Box sx={{ mb: 3 }}>
              <Grid container spacing={2} sx={{ mb: 2 }}>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Machine Name"
                    value={formState.checklist?.machine_name || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, machine_name: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Machine Tag / ID"
                    value={formState.checklist?.machine_id || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, machine_id: e.target.value }
                    })}
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    fullWidth
                    size="small"
                    label="Operator Name"
                    value={formState.checklist?.operator || ''}
                    onChange={(e) => setFormState({
                      ...formState,
                      checklist: { ...formState.checklist, operator: e.target.value }
                    })}
                  />
                </Grid>
              </Grid>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f5f5f5' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Inspection Check Point</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Result (Acceptable / Action Required)</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(formState.checklist?.parameters || []).map((chk, idx) => (
                      <TableRow key={idx}>
                        <TableCell sx={{ fontWeight: 600 }}>{chk.check_point}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={chk.result}
                            onChange={(e) => {
                              const params = [...formState.checklist.parameters];
                              params[idx].result = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, parameters: params } });
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            value={chk.remarks}
                            onChange={(e) => {
                              const params = [...formState.checklist.parameters];
                              params[idx].remarks = e.target.value;
                              setFormState({ ...formState, checklist: { ...formState.checklist, parameters: params } });
                            }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Section 3: Result, Corrective Actions & Verification Sign-Off */}
          <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1976d2', mb: 2 }}>
            3. Overall Finding, Corrective Action & Verification
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                select
                size="small"
                label="Overall Inspection Result"
                value={formState.overall_status}
                onChange={(e) => setFormState({ ...formState, overall_status: e.target.value })}
              >
                <MenuItem value="PASS">PASS — Full Compliance</MenuItem>
                <MenuItem value="ACTION_REQUIRED">ACTION REQUIRED — Minor Deviation</MenuItem>
                <MenuItem value="FAIL">FAIL — Critical Non-Conformance</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Prepared By / Inspector"
                value={formState.inspector_name}
                onChange={(e) => setFormState({ ...formState, inspector_name: e.target.value, prepared_by: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                fullWidth
                size="small"
                label="Verified By / Supervisor"
                value={formState.supervisor_name}
                onChange={(e) => setFormState({ ...formState, supervisor_name: e.target.value, verified_by: e.target.value })}
                required
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="Corrective Action Required (If Any)"
                value={formState.corrective_action}
                onChange={(e) => setFormState({ ...formState, corrective_action: e.target.value })}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                label="General Remarks / Auditor Observations"
                value={formState.remarks}
                onChange={(e) => setFormState({ ...formState, remarks: e.target.value })}
              />
            </Grid>
          </Grid>

          {/* Form Actions */}
          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end', gap: 2, flexWrap: 'wrap' }}>
            <Button variant="outlined" onClick={() => setActiveTab(0)}>
              Cancel
            </Button>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              startIcon={<PrintIcon />}
              onClick={(e) => handleSaveForm(e, true)}
              sx={{ fontWeight: 700 }}
            >
              💾 Save & Print Document
            </Button>
            <Button
              type="submit"
              variant="contained"
              size="large"
              sx={{ bgcolor: '#1976d2', px: 4, '&:hover': { bgcolor: '#1565c0' }, fontWeight: 700 }}
            >
              {isEditing ? 'Update Cleaning Record' : 'Save Cleaning Record'}
            </Button>
          </Box>
        </Paper>
      )}

      {/* OFFICIAL BVC PAPER FORMAT PRINT MODAL */}
      <CleaningPaperPrintModal
        open={Boolean(viewingRecord)}
        record={viewingRecord}
        isBlank={isBlankPrint}
        onClose={() => {
          setViewingRecord(null);
          setIsBlankPrint(false);
        }}
      />
    </Box>
  );
}
