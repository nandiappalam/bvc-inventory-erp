import React from 'react';
import CleaningServicesIcon from '@mui/icons-material/CleaningServices';
import EngineeringIcon from '@mui/icons-material/Engineering';
import BugReportIcon from '@mui/icons-material/BugReport';
import ShieldIcon from '@mui/icons-material/Shield';
import VisibilityIcon from '@mui/icons-material/Visibility';
import InventoryIcon from '@mui/icons-material/Inventory';
import WcIcon from '@mui/icons-material/Wc';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import BadgeIcon from '@mui/icons-material/Badge';
import BuildIcon from '@mui/icons-material/Build';
import FactCheckIcon from '@mui/icons-material/FactCheck';

export const CLEANING_RECORDS = [
  { code: 'ALL', label: 'All Compliance Records (C1–C14)', freq: '', icon: <FactCheckIcon fontSize="small" /> },
  { code: 'C1', label: 'C1: Production Area Cleaning (Daily)', docRef: 'BVC/CP/CL/01', revNo: '00', revDate: '29.05.2017', freq: 'Daily', color: '#1976d2', target: 'Production & Milling Floors', icon: <CleaningServicesIcon fontSize="small" /> },
  { code: 'C2', label: 'C2: Machineries Cleaning (15 Days Once)', docRef: 'BVC/CP/CL/02', revNo: '00', revDate: '29.05.2017', freq: '15 Days Once', color: '#c2185b', target: 'Milling, Destoner & Roller Machines', icon: <EngineeringIcon fontSize="small" /> },
  { code: 'C3', label: 'C3: Pest Control Cleaning (Monthly Once)', docRef: 'BVC/CP/CL/03', revNo: '00', revDate: '29.05.2017', freq: 'Monthly Once', color: '#d32f2f', target: 'Factory Chemical & Pest Disinfection', icon: <BugReportIcon fontSize="small" /> },
  { code: 'C4', label: 'C4: Water Tank Cleaning (15 Days Once)', docRef: 'BVC/CP/CL/04', revNo: '00', revDate: '29.05.2017', freq: '15 Days Once', color: '#0288d1', target: 'Overhead & Process Water Tanks', icon: <ShieldIcon fontSize="small" /> },
  { code: 'C5', label: 'C5: Window-Glass Cleaning (Monthly Once)', docRef: 'BVC/CP/CL/05', revNo: '00', revDate: '29.05.2017', freq: 'Monthly Once', color: '#7b1fa2', target: 'Milling & Packing Glass Glazing', icon: <VisibilityIcon fontSize="small" /> },
  { code: 'C6', label: 'C6: Wood-Pallet Cleaning (15 Days Once)', docRef: 'BVC/CP/CL/06', revNo: '00', revDate: '29.05.2017', freq: '15 Days Once', color: '#ed6c02', target: 'Godown Storage Wood Pallets', icon: <InventoryIcon fontSize="small" /> },
  { code: 'C7', label: 'C7: Toilet Inspection Check List', docRef: 'BVC-QA-F-05', revNo: '00', revDate: '29.05.2017', freq: 'Daily', color: '#00796b', target: 'Restroom & Handwash Facilities', icon: <WcIcon fontSize="small" /> },
  { code: 'C8', label: 'C8: Vehicle Loading/Unloading Inspection Report', docRef: 'BVC/QA/F/07', revNo: '00', revDate: '29.05.2017', freq: 'Per Vehicle', color: '#5d4037', target: 'Inward & Outward Dispatch Trucks', icon: <LocalShippingIcon fontSize="small" /> },
  { code: 'C9', label: 'C9: Food Handlers Personal Hygiene Log', docRef: 'BVC/QA/F/01', revNo: '00', revDate: '29.05.2017', freq: 'Daily', color: '#2e7d32', target: 'Factory Food Handlers & Operators', icon: <BadgeIcon fontSize="small" /> },
  { code: 'C10', label: 'C10: Primary Packing Material Inspection Record', docRef: 'PPMI/QA/F/08', revNo: '00', revDate: '29.05.2017', freq: 'Per Inward Lot', color: '#1565c0', target: 'HDPE Bags, LDPE Liners & Sacks', icon: <InventoryIcon fontSize="small" /> },
  { code: 'C11', label: 'C11: Glass and Plastic Control Checklist', docRef: 'BVC/QA/F/03', revNo: '00', revDate: '29.05.2017', freq: 'Periodic', color: '#6a1b9a', target: 'Windows, Lights & Acrylic Fixtures', icon: <VisibilityIcon fontSize="small" /> },
  { code: 'C12', label: 'C12: Plastic Pallet Control Checklist', docRef: 'BVC/QA/F/04', revNo: '00', revDate: '29.05.2017', freq: 'Periodic', color: '#ef6c00', target: 'Plastic Pallets & Storage Racks', icon: <InventoryIcon fontSize="small" /> },
  { code: 'C13', label: 'C13: Routine Rodent Bait Monitoring Record', docRef: 'BVC/QA/F/10', revNo: '01', revDate: '01.01.2023', freq: 'Monthly (Daily Grid)', color: '#b71c1c', target: 'Internal & Outside Bait Stations', icon: <BugReportIcon fontSize="small" /> },
  { code: 'C14', label: 'C14: Routine / Preventive Maintenance Checklist', docRef: 'BVC/MNTF/03', revNo: '00', revDate: '29.05.2017', freq: 'Daily / Weekly / Monthly', color: '#37474f', target: 'Factory Machinery Maintenance', icon: <BuildIcon fontSize="small" /> }
];

export const INVENTORY_PRESETS = [
  // C2 & C14: Machineries
  {
    category: 'Machineries (Milling & Processing)',
    code: 'C2',
    name: 'Pulse Hammer Mill #01 (50 HP) — Milling Floor Line 1',
    data: {
      machine_name: 'Pulse Hammer Mill #01 (50 HP Heavy Duty)',
      machine_id: 'MCH-MIL-01',
      location: 'Milling Floor Line 1',
      area_location: 'Milling Floor Line 1',
      operator_name: 'Murugan K',
      responsibility: 'Machine Operator & Sanitation Officer',
      inspector_name: 'Murugan K',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Machineries (Milling & Processing)',
    code: 'C2',
    name: 'De-Stoner & Gravity Separator #01 — Cleaner Hall',
    data: {
      machine_name: 'De-Stoner & Gravity Separator Unit #01',
      machine_id: 'MCH-DST-01',
      location: 'Pre-Cleaner Hall Godown 2',
      area_location: 'Pre-Cleaner Hall',
      operator_name: 'Suresh P',
      responsibility: 'Operator / Cleaner',
      inspector_name: 'Suresh P',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Machineries (Milling & Processing)',
    code: 'C2',
    name: 'Pulse Polishing & Water Roller #01 — Polishing Bay',
    data: {
      machine_name: 'Pulse Polishing & Water Roller #01',
      machine_id: 'MCH-POL-01',
      location: 'Polishing Bay Godown 2',
      area_location: 'Polishing Bay',
      operator_name: 'Anand R',
      responsibility: 'Polishing Line Incharge',
      inspector_name: 'Anand R',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Preventive Maintenance',
    code: 'C14',
    name: 'Sortex Optical Color Sorter #01 (BVC/MNTF/03)',
    data: {
      machine_no: 'MCH-STX-01',
      machine_name: 'Sortex Optical Color Sorter #01',
      operator_name: 'Karthik V',
      area_location: 'Sortex Clean Bay',
      inspector_name: 'Karthik V',
      supervisor_name: 'Plant Incharge'
    }
  },

  // C10: Primary Packing Material
  {
    category: 'Primary Packing Material (PPMI)',
    code: 'C10',
    name: '25kg HDPE Sacks with LDPE Liner — Sri Krishna Packaging',
    data: {
      ppmi_no: 'PPMI-2026-081',
      supplier: 'Sri Krishna Packaging Ltd.',
      invoice_no: 'INV-SKP-9921',
      packing_material: '25kg Virgin HDPE Woven Bags with LDPE Liner',
      area_location: 'Packaging Material Warehouse',
      inspector_name: 'QC Inspector',
      supervisor_name: 'QA Head'
    }
  },
  {
    category: 'Primary Packing Material (PPMI)',
    code: 'C10',
    name: '50kg Heavy-Duty Export Sacks — Apex PolyPack Ltd.',
    data: {
      ppmi_no: 'PPMI-2026-082',
      supplier: 'Apex PolyPack Ltd.',
      invoice_no: 'INV-APP-4402',
      packing_material: '50kg Export Grade Double Laminated Sacks',
      area_location: 'Packaging Material Warehouse',
      inspector_name: 'QC Inspector',
      supervisor_name: 'QA Head'
    }
  },

  // C8: Vehicles
  {
    category: 'Vehicles & Dispatches',
    code: 'C8',
    name: 'Export Dispatch Truck — TN-58-AX-9912 (Royal Foods Exporters)',
    data: {
      customer: 'Royal Foods Exporters',
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
      customer: 'Sri Meenakshi Logistics / Farm Inward',
      quantity: '400 Bags (20 MT Raw Black Gram)',
      vehicle_no: 'TN-67-B-4410',
      area_location: 'Inward Unloading Bay 2',
      inspector_name: 'Security Officer',
      supervisor_name: 'Weighbridge Clerk'
    }
  },

  // C6 & C12: Pallets
  {
    category: 'Pallets (Wood & Plastic)',
    code: 'C6',
    name: 'Wooden Pallets — FG Godown Bay A (PLT-WD-01 to 50)',
    data: {
      pallet_code: 'PLT-WD-01 to 50',
      area_location: 'Finished Goods Godown Bay A',
      inspector_name: 'Store Keeper',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Pallets (Wood & Plastic)',
    code: 'C12',
    name: 'Plastic Cleanroom Pallets — Export Bay (PLT-PL-01 to 30)',
    data: {
      pallet_code: 'PLT-PL-01 to 30',
      area_location: 'Export Clean Packing Bay',
      inspector_name: 'QA Executive',
      supervisor_name: 'QA Manager'
    }
  },

  // C4: Water Tanks
  {
    category: 'Water Tanks',
    code: 'C4',
    name: 'Main Overhead Process Water Tank (10,000 L)',
    data: {
      tank_id: 'OHT-01 (10,000 L)',
      area_location: 'Factory Rooftop & Process Line',
      inspector_name: 'Sanitation Staff',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Water Tanks',
    code: 'C4',
    name: 'RO Soft Water Storage Tank (5,000 L)',
    data: {
      tank_id: 'RO-TNK-02 (5,000 L)',
      area_location: 'RO Water Treatment Plant',
      inspector_name: 'Utility Operator',
      supervisor_name: 'Unit Supervisor'
    }
  },

  // C5 & C11: Windows & Glazing
  {
    category: 'Windows & Glazing',
    code: 'C5',
    name: 'Milling & Packaging Hall Glazing (WIN-MIL-01 to 08)',
    data: {
      window_id: 'WIN-MIL-01 to 08',
      location: 'Milling Hall Line 1 & Packaging Bay',
      area_location: 'Milling Hall Line 1 & Packaging Bay',
      inspector_name: 'Housekeeper',
      supervisor_name: 'Unit Supervisor'
    }
  },
  {
    category: 'Windows & Glazing',
    code: 'C11',
    name: 'Factory Glass & Plastic Partitions — Inspection Zone',
    data: {
      window_id: 'WIN-PL-ALL',
      location: 'Production & Inspection Zone',
      area_location: 'Production & Inspection Zone',
      inspector_name: 'QA Officer',
      supervisor_name: 'QA Manager'
    }
  },

  // C7: Restrooms
  {
    category: 'Restrooms & Hygiene',
    code: 'C7',
    name: 'Main Factory Restroom Block A & Handwash Stations',
    data: {
      toilet_name: 'Block A (Milling & Packing Area)',
      area_location: 'Block A Sanitation',
      inspector_name: 'House Keeper',
      supervisor_name: 'HR MANAGER'
    }
  },

  // C3 & C13: Pest & Rodent
  {
    category: 'Pest Control & Rodent Stations',
    code: 'C3',
    name: 'Monthly Factory Disinfection — PCI Pest Control Operators',
    data: {
      pci_agency: 'PCI Pest Control Operators (Approved Vendor)',
      area_location: 'Factory Godowns, Milling & Packaging Halls',
      inspector_name: 'PCI Operator',
      supervisor_name: 'QA Manager'
    }
  },
  {
    category: 'Pest Control & Rodent Stations',
    code: 'C13',
    name: 'Monthly Rodent Bait Monitoring — RTS-1 to RTS-8 & RBS-1..2',
    data: {
      area_location: 'Internal Factory Perimeter & Outside Stations',
      inspector_name: 'Mr. Y (Pest Officer)',
      supervisor_name: 'Mr. X (FSTL / QA Manager)'
    }
  }
];

export function getInitialChecklistForCode(code) {
  const currentDate = new Date().toISOString().split('T')[0];
  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });

  switch (code) {
    case 'C1':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        shift: 'Shift 1 (Morning)',
        activities: [
          { s_no: 1, activity: 'SWEEP THE AREA WITH PLASTIC BROOM.', status: 'OK', remarks: 'Area swept clean' },
          { s_no: 2, activity: 'REMOVE ALL UNWANTED MATERIAL FROM PROCESS BEFORE START THE WORK', status: 'OK', remarks: 'Cleared before start' },
          { s_no: 3, activity: 'RUB THE STAINED AREA WITH 1% (100ML/10LITRES) SOAP SOLUTION.', status: 'OK', remarks: 'Soap scrub applied' },
          { s_no: 4, activity: 'MOP THE AREA WITH WATER TREATED WITH 1% (100ML/10LITRES) SODIUM HYPO CHLORIDE SOLUTION', status: 'OK', remarks: 'Sanitized with chlorine' }
        ],
        days_grid: Array.from({ length: 31 }, (_, i) => ({ day: i + 1, status: '√', note: '' }))
      };

    case 'C2':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        machine_name: 'Pulse Hammer Mill #01 (50 HP Heavy Duty)',
        machine_code: 'MCH-MIL-01',
        responsibility: 'Operator / Cleaner',
        activities: [
          { s_no: 1, activity: 'SWEEP THE AREA WITH PLASTIC BROOM.', status: 'OK', remarks: 'Swept with plastic broom' },
          { s_no: 2, activity: 'REMOVE ALL UNWANTED MATERIAL FROM PROCESS BEFORE START THE WORK', status: 'OK', remarks: 'Unwanted items removed' },
          { s_no: 3, activity: 'Clean /Scrap residues Screw blades & Clean the hopper & Discharge nozzles thoroughly', status: 'OK', remarks: 'Blades & hopper scraped' },
          { s_no: 4, activity: 'CLEAN THE DUST AS PER PROCEDURES:\n1. Motor Cover\n2. De-Stonner\n3. Pulse roller', status: 'OK', remarks: 'All dust wiped per SOP' }
        ],
        months_grid: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => ({
          month: m,
          checked: '√',
          checked_by: 'Operator',
          verified_by: 'Supervisor',
          remarks: 'OK'
        }))
      };

    case 'C3':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        activities: [
          { s_no: 1, activity: 'BEFORE TO STOP THE PRODUCTION\nRAW MATERIAL MOVE & CLOSED', status: 'OK', remarks: 'All RM moved & sealed' },
          { s_no: 2, activity: 'MACHINE PARTS OPENED & RESIDUES TO BE REMOVED.\nCONDUCT THE PEST CONTROL ACTIVITIES WITH PCI OPERATORS WITH APPROVED CHEMICALS', status: 'OK', remarks: 'PCI chemical spray completed' },
          { s_no: 3, activity: 'WASHED THOROUGHLY TREATED SURFACE WITH HOT WATER.\nTHEN RINSE AND WASHED WITH FRESH WATER, WIPE WITH CLOTH AND DRY.', status: 'OK', remarks: 'Hot water washed & dried' },
          { s_no: 4, activity: 'INITIAL RUN WITH SMALL QUANTITIES OF PRODUCT.\nREMOVE THE INITIAL RUN PRODUCT AND USE MACHINE FOR PRODUCTION/PACKAGING.', status: 'OK', remarks: 'Initial run purged & cleared' }
        ],
        months_grid: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => ({
          month: m,
          checked: '√',
          checked_by: 'PCI Operator',
          verified_by: 'QA Incharge',
          remarks: 'Completed'
        }))
      };

    case 'C4':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        tank_id: 'Overhead Process Water Tank #01 (10,000 L)',
        activities: [
          { s_no: 1, activity: 'Before clean the tank to stop the production. Remove the water by using plastic buckets.', status: 'OK', remarks: 'Production paused, drained' },
          { s_no: 2, activity: 'Mop the area with water treated with 1% (100Ml/10Litres) Sodium hypo chloride Solution.', status: 'OK', remarks: 'Treated with chlorine solution' },
          { s_no: 3, activity: 'Clean the water tank thoroughly by using plastic brooms.', status: 'OK', remarks: 'Scrubbed with plastic broom' },
          { s_no: 4, activity: 'If any damages find inform to unit supervisor. After the cleaning to put 3-4 bucket of water for dust removing. Then allowed for production.', status: 'OK', remarks: 'Rinsed 4 times & approved' }
        ],
        months_grid: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => ({
          month: m,
          checked: '√',
          checked_by: 'Sanitation',
          verified_by: 'Supervisor',
          remarks: 'Clean'
        }))
      };

    case 'C5':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        window_id_code: 'WIN-MIL-01 to 08',
        location: 'Milling Line 1 & Packaging Hall',
        activities: [
          { s_no: 1, activity: 'BEFORE TO STOP THE PRODUCTION\nTO CLEAN WINDOW BY USING COTTON CLOTH.', status: 'OK', remarks: 'Cleaned with cotton cloth' },
          { s_no: 2, activity: 'TO APPLY 2ML OF COLIN WITH COTTON CLOTH AND TO RUB THE SURFACE\nIF ANY DAMAGES FIND INFORM TO UNIT SUPERVISOR.', status: 'OK', remarks: 'Colin applied, no damage' }
        ],
        months_grid: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => ({
          month: m,
          checked: '√',
          checked_by: 'Housekeeper',
          verified_by: 'Supervisor',
          remarks: 'Glass clear'
        }))
      };

    case 'C6':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        pallet_code: 'PLT-WD-01 to 50',
        activities: [
          { s_no: 1, activity: 'Before clean the pallet to place out the pallet from store area.', status: 'OK', remarks: 'Placed outside store area' },
          { s_no: 2, activity: 'Wipe out dust from the pallet.', status: 'OK', remarks: 'Dust wiped dry' },
          { s_no: 3, activity: 'Check out the pallet if any damage observed. & Wipe out the damaged pallet from the store area.', status: 'OK', remarks: 'No damage found' },
          { s_no: 4, activity: 'Inform to the unit supervisor if any damage observed.', status: 'OK', remarks: 'Supervisor verified OK' }
        ],
        months_grid: ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => ({
          month: m,
          checked: '√',
          checked_by: 'Store Staff',
          verified_by: 'Supervisor',
          remarks: 'Pallets OK'
        }))
      };

    case 'C7':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        month: currentMonth,
        toilet_name: 'Main Factory Restroom Block A (Milling & Packing Area)',
        check_items: [
          { s_no: 1, item: 'Floor / Area Cleanliness', status: '✓', remarks: 'Dry and scrubbed' },
          { s_no: 2, item: 'Urinal area cleanliness', status: '✓', remarks: 'Sanitized' },
          { s_no: 3, item: 'Water tap working', status: '✓', remarks: 'Good pressure' },
          { s_no: 4, item: 'Water availability', status: '✓', remarks: 'Available continuous' },
          { s_no: 5, item: 'Soap Solution availability', status: '✓', remarks: 'Refilled' },
          { s_no: 6, item: 'Bucket / Tub availability', status: '✓', remarks: 'Present' },
          { s_no: 7, item: 'Flush working condition', status: '✓', remarks: 'Operational' },
          { s_no: 8, item: 'Lights working', status: '✓', remarks: 'Functional' },
          { s_no: 9, item: 'Hand dryer / Towel available', status: '✓', remarks: 'Available' },
          { s_no: 10, item: 'Toilet bowl cleanliness & sanitization', status: '✓', remarks: 'Disinfected with bleach' },
          { s_no: 11, item: 'Wash basin & mirror clean', status: '✓', remarks: 'Spotless' },
          { s_no: 12, item: 'Waste bin cleared & lined with polybag', status: '✓', remarks: 'Cleared' },
          { s_no: 13, item: 'Odour / Exhaust fan working properly', status: '✓', remarks: 'Fan running, fresh' }
        ]
      };

    case 'C8':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        customer_qty: 'Royal Foods Exporters / 500 Bags (25 MT Urad Gota)',
        vehicle_no: 'TN-58-AX-9912',
        driver_name: 'K. Rajan (+91 98421 55678)',
        container_type: 'Closed Container Truck',
        movement_type: 'Outward Dispatch',
        check_points: [
          { s_no: 1, item: 'Cleanliness of truck - Dust / Dirt', ok: true, not_ok: false, remarks: 'Clean and swept' },
          { s_no: 2, item: 'No Pest / Pest droppings', ok: true, not_ok: false, remarks: 'Zero pest evidence' },
          { s_no: 3, item: 'No foreign material / Moisture', ok: true, not_ok: false, remarks: 'Dry floor' },
          { s_no: 4, item: 'Doors are intact- Good condition', ok: true, not_ok: false, remarks: 'Hinges & locks intact' },
          { s_no: 5, item: 'No corrosion (platform / all inner area)', ok: true, not_ok: false, remarks: 'Zero corrosion' },
          { s_no: 6, item: 'Truck sealing (empty and after loading)', ok: true, not_ok: false, remarks: 'Seal #BVC-9912 applied' },
          { s_no: 7, item: 'Any unwanted Odour', ok: true, not_ok: false, remarks: 'Odor-free' },
          { s_no: 8, item: 'Tarpalin in the truck(clean/damage)', ok: true, not_ok: false, remarks: 'Clean waterproof tarpaulin' },
          { s_no: 9, item: 'General acceptance of truck', ok: true, not_ok: false, remarks: 'Accepted for food transport' },
          { s_no: 10, item: 'Floor condition (no holes, protruding nails or splinters)', ok: true, not_ok: false, remarks: 'Smooth solid bed' },
          { s_no: 11, item: 'Container lock & seal number verified', ok: true, not_ok: false, remarks: 'Verified & locked' }
        ]
      };

    case 'C9':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        shift: 'Day Shift (1. D)',
        workers: [
          {
            s_no: 1,
            shift: '1. D',
            worker_name: 'M. Ramesh',
            area: 'Milling Line 1',
            wearing_ppes: '✓',
            nail_trimming: '✓',
            free_wounds: '✓',
            no_illness: '✓',
            no_jewels: '✓',
            no_chemicals: '✓',
            no_smoking: '✓',
            remarks: 'Fit for duty',
            corrective_action: 'None'
          },
          {
            s_no: 2,
            shift: '1. D',
            worker_name: 'K. Vignesh',
            area: 'Packing Bay',
            wearing_ppes: '✓',
            nail_trimming: '✓',
            free_wounds: '✓',
            no_illness: '✓',
            no_jewels: '✓',
            no_chemicals: '✓',
            no_smoking: '✓',
            remarks: 'Compliant',
            corrective_action: 'None'
          },
          {
            s_no: 3,
            shift: '1. D',
            worker_name: 'P. Anand',
            area: 'Sortex Section',
            wearing_ppes: '✓',
            nail_trimming: '✓',
            free_wounds: '✓',
            no_illness: '✓',
            no_jewels: '✓',
            no_chemicals: '✓',
            no_smoking: '✓',
            remarks: 'Compliant',
            corrective_action: 'None'
          },
          {
            s_no: 4,
            shift: '1. D',
            worker_name: 'S. Ganesan',
            area: 'Godown 2',
            wearing_ppes: '✓',
            nail_trimming: '✓',
            free_wounds: '✓',
            no_illness: '✓',
            no_jewels: '✓',
            no_chemicals: '✓',
            no_smoking: '✓',
            remarks: 'Compliant',
            corrective_action: 'None'
          },
          {
            s_no: 5,
            shift: '1. D',
            worker_name: 'T. Murugan',
            area: 'De-Stoner Line',
            wearing_ppes: '✓',
            nail_trimming: '✓',
            free_wounds: '✓',
            no_illness: '✓',
            no_jewels: '✓',
            no_chemicals: '✓',
            no_smoking: '✓',
            remarks: 'Compliant',
            corrective_action: 'None'
          },
          {
            s_no: 6,
            shift: '1. D',
            worker_name: 'R. Velu',
            area: 'Loading Bay',
            wearing_ppes: '✓',
            nail_trimming: '✓',
            free_wounds: '✓',
            no_illness: '✓',
            no_jewels: '✓',
            no_chemicals: '✓',
            no_smoking: '✓',
            remarks: 'Compliant',
            corrective_action: 'None'
          }
        ]
      };

    case 'C10':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        ppmi_no: 'PPMI-2026-088',
        supplier: 'Apex PolyPack Ltd.',
        invoice_no: 'INV-2026-904',
        po_no: 'PO-2026-889',
        material_name: '25kg Virgin HDPE Woven Bags with LDPE Liner',
        qty_received: '5,000 Bags',
        time: '10:30 AM',
        parameters: [
          { s_no: 1, parameter: 'Physical Parameters', std_tolerance: 'Virgin HDPE, Food-grade printed', observations: 'Conforms to specification', action_taken: 'Accepted' },
          { s_no: 2, parameter: 'Bottom Stitching', std_tolerance: 'Double lock chain stitch, tight', observations: 'Intact, no open stitch', action_taken: 'Passed' },
          { s_no: 3, parameter: 'Top Open', std_tolerance: 'Heat-cut clean edge', observations: 'Smooth, no fraying', action_taken: 'Passed' },
          { s_no: 4, parameter: 'Liner', std_tolerance: 'Food-grade LDPE liner 40 micron', observations: '42 micron measured, virgin clean', action_taken: 'Accepted' },
          { s_no: 5, parameter: 'Size', std_tolerance: '24" x 36" (± 0.5")', observations: '24.1" x 36.0"', action_taken: 'Passed' },
          { s_no: 6, parameter: 'Weight', std_tolerance: '120g ± 5g per bag', observations: '121.5g average', action_taken: 'Passed' },
          { s_no: 7, parameter: 'Printing space on top', std_tolerance: '50mm margin for seal', observations: '52mm margin', action_taken: 'Passed' },
          { s_no: 8, parameter: 'Printing Matter', std_tolerance: 'BVC Logo, FSSAI, Batch, Net Wt', observations: 'All mandatory text sharp & legible', action_taken: 'Passed' },
          { s_no: 9, parameter: 'Printing Ink', std_tolerance: 'Food grade non-toxic ink, rub resistant', observations: 'Tape adhesion test passed, no smudge', action_taken: 'Accepted' },
          { s_no: 10, parameter: 'Tensile / Bursting Strength', std_tolerance: 'Bursting strength > 18 kg/cm²', observations: '21.4 kg/cm² tested', action_taken: 'Passed' },
          { s_no: 11, parameter: 'Cleanliness & Odour', std_tolerance: 'Dust-free, dry, zero chemical odour', observations: 'Clean and odorless', action_taken: 'Accepted' },
          { s_no: 12, parameter: 'Packaging Condition', std_tolerance: 'Bundles wrapped in waterproof stretch wrap', observations: 'Securely packed in 500 pcs bundles', action_taken: 'Accepted' }
        ]
      };

    case 'C11':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        shift: 'Day Shift',
        time: '09:00 AM',
        parameters: [
          { s_no: 1, parameter: 'Are plastic frames of windows not Anchored to wall', checklist: 'Y', condition: 'O.K', observations: 'Firmly anchored', action_taken: 'Nil' },
          { s_no: 2, parameter: 'Rust,Rot or pealing in plastic frames', checklist: 'N', condition: 'O.K', observations: 'No rust or peeling', action_taken: 'Nil' },
          { s_no: 3, parameter: 'Any gaps in caulk', checklist: 'N', condition: 'O.K', observations: 'Seal intact', action_taken: 'Nil' },
          { s_no: 4, parameter: 'Is there any missing or loosed fastners in windows', checklist: 'N', condition: 'O.K', observations: 'All fasteners tight', action_taken: 'Nil' },
          { s_no: 5, parameter: 'Is the glass broken? (Broken glass should be repaired immediately to guard against water infiltration.)', checklist: 'N', condition: 'O.K', observations: 'Zero crack / shatter', action_taken: 'Nil' },
          { s_no: 6, parameter: 'Does the window sash (the movable part of the window) operate smoothly?', checklist: 'Y', condition: 'O.K', observations: 'Smooth movement', action_taken: 'Nil' },
          { s_no: 7, parameter: 'Is the window sash loose/broken or missing in its frame?', checklist: 'N', condition: 'O.K', observations: 'Secured in frame', action_taken: 'Nil' },
          { s_no: 8, parameter: 'Are the Insect protection screens damaged?', checklist: 'N', condition: 'O.K', observations: 'Insect mesh intact', action_taken: 'Nil' },
          { s_no: 9, parameter: 'Any damages in operating hardwares', checklist: 'N', condition: 'O.K', observations: 'Latches & handles good', action_taken: 'Nil' },
          { s_no: 10, parameter: 'Tube lights & LED fixtures acrylic shatter covers intact', checklist: 'Y', condition: 'O.K', observations: 'All light covers intact', action_taken: 'Nil' },
          { s_no: 11, parameter: 'Inspection zone acrylic shields & machine guards intact', checklist: 'Y', condition: 'O.K', observations: 'Guards secure', action_taken: 'Nil' },
          { s_no: 12, parameter: 'Control panel acrylic dials & push-button covers unbroken', checklist: 'Y', condition: 'O.K', observations: 'Panels clean and undamaged', action_taken: 'Nil' }
        ]
      };

    case 'C12':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        shift: 'Day Shift',
        time: '09:30 AM',
        parameters: [
          { s_no: 1, parameter: 'Plastic pallets must be kept in designated storage areas of the factory wherever practicable.', std_tolerance: 'Y', observations: 'Stacking in marked bays', action_taken: 'Verified' },
          { s_no: 2, parameter: 'Plastic pallets must not have loose,damaged or missing boards or blocks.', std_tolerance: 'Y', observations: 'Zero loose blocks', action_taken: 'Verified' },
          { s_no: 3, parameter: 'Pallets having any misaligned, split or tiered blocks', std_tolerance: 'N', observations: 'Structure aligned', action_taken: 'Verified' },
          { s_no: 4, parameter: 'Pallets having any breakage or chipped edges', std_tolerance: 'N', observations: 'No cracks or chipped edges', action_taken: 'Verified' },
          { s_no: 5, parameter: 'Pallets should not have any off odors, visible mold growth or other signs of contamination.', std_tolerance: 'Y', observations: 'Clean and odorless', action_taken: 'Verified' },
          { s_no: 6, parameter: 'Pallets should not have any visible evidence of pest activity.', std_tolerance: 'Y', observations: 'Zero pest signs', action_taken: 'Verified' },
          { s_no: 7, parameter: 'Pallets should be clean, dry and free of visible stains or discoloration, and not have excessive saw dust or other filth on them.', std_tolerance: 'Y', observations: 'Clean, dry and dust-free', action_taken: 'Accepted' },
          { s_no: 8, parameter: 'Pallets load rating (1,000 kg dynamic / 3,000 kg static) not exceeded.', std_tolerance: 'Y', observations: 'Stacking within safe weight limit', action_taken: 'Passed' },
          { s_no: 9, parameter: 'Pallet surface anti-skid rubber grommets and runners in sound condition.', std_tolerance: 'Y', observations: 'All anti-skid grommets intact', action_taken: 'Verified' }
        ]
      };

    case 'C13':
      return {
        rev_no: '01',
        rev_date: '01.01.2023',
        month: currentMonth,
        prepared_by_name: 'Mr. Y',
        approved_by_name: 'Mr. X (FSTL)',
        internal_stations: [
          { station_no: 'RTS-1', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-2', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-3', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-4', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-5', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-6', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-7', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-8', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-9', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' },
          { station_no: 'RTS-10', status_summary: 'OK (Internal Snap Trap Active / No Intrusion)' }
        ],
        internal_capa: 'All internal snap traps inspected daily. Zero rodent intrusion observed across factory perimeter.',
        outside_stations: [
          { station_no: 'RBS-1', status_summary: 'OK (Bromadiolone 0.005% bait blocks secure & active)' },
          { station_no: 'RBS-2', status_summary: 'OK (Bromadiolone 0.005% bait blocks secure & active)' },
          { station_no: 'RBS-3', status_summary: 'OK (Bromadiolone 0.005% bait blocks secure & active)' },
          { station_no: 'RBS-4', status_summary: 'OK (Bromadiolone 0.005% bait blocks secure & active)' }
        ],
        outside_capa: 'Perimeter bait stations secure, locked, tamper-resistant and dry.'
      };

    case 'C14':
      return {
        rev_no: '00',
        rev_date: '29.05.2017',
        machine_no: 'MCH-MIL-01',
        machine_name: 'Pulse Hammer Mill #01 (50 HP)',
        operator_name: 'Murugan K',
        criteria: [
          { s_no: 1, criteria: 'Machine cleaning', frequency: 'Daily', status: 'OK', remarks: 'Cleaned daily after shift' },
          { s_no: 2, criteria: 'Old material removal', frequency: 'Daily', status: 'OK', remarks: 'Hopper scraped clear' },
          { s_no: 3, criteria: 'Belt checking', frequency: 'Daily', status: 'OK', remarks: 'Tension optimal' },
          { s_no: 4, criteria: 'Machine Bolt & nut checking', frequency: 'Daily', status: 'OK', remarks: 'All fastners tightened' },
          { s_no: 5, criteria: 'Motor bearing greasing & lubrication', frequency: 'Weekly', status: 'OK', remarks: 'Food-grade grease applied' },
          { s_no: 6, criteria: 'Any abnormal sound / vibration', frequency: 'Weekly', status: 'OK', remarks: 'Vibration & sound normal' },
          { s_no: 7, criteria: 'Air filter & suction blower cleaning', frequency: 'Weekly', status: 'OK', remarks: 'Filter bag shaken & cleaned' },
          { s_no: 8, criteria: 'Machine Safety Guard & Emergency Stop Condition', frequency: 'Monthly', status: 'OK', remarks: 'Emergency stops operational' },
          { s_no: 9, criteria: 'Electrical panel earthing & wiring insulation check', frequency: 'Monthly', status: 'OK', remarks: 'Earthing resistance normal' },
          { s_no: 10, criteria: 'Wear & tear on hammer beaters / screen mesh sieve', frequency: '15 Days Once', status: 'OK', remarks: 'Beaters inspected, no excess wear' }
        ]
      };

    default:
      return {};
  }
}
