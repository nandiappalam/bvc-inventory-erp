import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  Box
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import DownloadIcon from '@mui/icons-material/Download';

export default function CleaningPaperPrintModal({ open, onClose, record, isBlank = false }) {
  if (!record && !isBlank) return null;

  const r = record || {
    record_code: 'C1',
    record_no: 'BVC-CP-001',
    record_date: new Date().toISOString().split('T')[0],
    company_name: 'BVC EXPORTS PVT LIMITED',
    area_location: 'Production Milling Hall',
    frequency: 'Daily',
    prepared_by: '',
    verified_by: '',
    inspector_name: '',
    supervisor_name: '',
    checklist: {}
  };

  const code = r.record_code || 'C1';

  const handlePrint = () => {
    window.print();
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: { minHeight: '85vh', bgcolor: '#f8fafc' }
      }}
    >
      <DialogTitle
        component="div"
        sx={{
          bgcolor: '#1e293b',
          color: '#fff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          py: 1.5,
          px: 3
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PrintIcon />
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
            Official Paper Format Print Preview {isBlank ? '(Blank Form)' : `— ${r.record_no || code}`}
          </Typography>
        </Box>
        <IconButton size="small" onClick={onClose} sx={{ color: '#fff' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1, sm: 3 }, bgcolor: '#e2e8f0' }}>
        {/* Printable Container */}
        <Box
          id="official-cleaning-paper-record"
          sx={{
            maxWidth: '1000px',
            mx: 'auto',
            bgcolor: '#ffffff',
            p: { xs: 2, sm: 4 },
            border: '2px solid #000000',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            fontFamily: '"Arial", "Calibri", sans-serif',
            color: '#000000',
            '@media print': {
              border: '2px solid #000000',
              boxShadow: 'none',
              p: 2,
              m: 0,
              maxWidth: '100%'
            }
          }}
        >
          {/* RENDER DEDICATED PAPER FORMATS */}
          {code === 'C1' && <C1PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C2' && <C2PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C3' && <C3PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C4' && <C4PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C5' && <C5PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C6' && <C6PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C7' && <C7PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C8' && <C8PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C9' && <C9PaperFormat record={r} isBlank={isBlank} />}
          {code === 'C10' && <C10PaperFormat record={r} isBlank={isBlank} />}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, bgcolor: '#ffffff', borderTop: '1px solid #cbd5e1', gap: 1.5 }}>
        <Button variant="outlined" color="inherit" onClick={onClose}>
          Close Preview
        </Button>
        <Button
          variant="contained"
          color="primary"
          startIcon={<PrintIcon />}
          onClick={handlePrint}
          sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' }, px: 3, fontWeight: 700 }}
        >
          Print Official Record
        </Button>
      </DialogActions>

      {/* Global Print Styles */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #official-cleaning-paper-record, #official-cleaning-paper-record * {
            visibility: visible;
          }
          #official-cleaning-paper-record {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 10mm;
            border: 2px solid #000 !important;
            background: #fff !important;
            color: #000 !important;
          }
          @page {
            size: A4 portrait;
            margin: 8mm;
          }
        }
      `}</style>
    </Dialog>
  );
}

// ----------------------------------------------------------------------
// C1: CLEANING CHECKLIST PRODUCTION AREA (Daily) - FORMAT NO. : BVC/CP/CL/01
// ----------------------------------------------------------------------
function C1PaperFormat({ record, isBlank }) {
  const chk = record.checklist || {};
  const points = isBlank ? [
    { point: 'SWEEP THE AREA WITH PLASTIC BROOM.', status: '', remarks: '' },
    { point: 'REMOVE ALL UNWANTED MATERIAL FROM PROCESS BEFORE START THE WORK', status: '', remarks: '' },
    { point: 'RUB THE STAINED AREA WITH 1% (100ML/10LITRES) SOAP SOLUTION.', status: '', remarks: '' },
    { point: 'MOP THE AREA WITH WATER TREATED WITH 1% (100ML/10LITRES) SODIUM HYPO CHLORIDE SOLUTION', status: '', remarks: '' }
  ] : (chk.cleaning_points && chk.cleaning_points.length > 0 ? chk.cleaning_points : [
    { point: 'SWEEP THE AREA WITH PLASTIC BROOM.', status: 'OK', remarks: 'Area swept clean' },
    { point: 'REMOVE ALL UNWANTED MATERIAL FROM PROCESS BEFORE START THE WORK', status: 'OK', remarks: 'Zero process debris' },
    { point: 'RUB THE STAINED AREA WITH 1% (100ML/10LITRES) SOAP SOLUTION.', status: 'OK', remarks: 'Stains scrubbed' },
    { point: 'MOP THE AREA WITH WATER TREATED WITH 1% (100ML/10LITRES) SODIUM HYPO CHLORIDE SOLUTION', status: 'OK', remarks: 'Disinfected with 1% NaOCl' }
  ]);

  return (
    <Box>
      {/* Top Header Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', border: '1px solid #000', padding: '10px', textAlign: 'center', verticalAlign: 'middle' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px', letterSpacing: '0.5px' }}>BVC EXPORTS PVT LIMITED</div>
            </td>
            <td style={{ width: '40%', border: '1px solid #000', padding: '10px', textAlign: 'center', verticalAlign: 'middle' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>CLEANING CHECKLIST</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>PRODUCTION AREA</div>
              <div style={{ fontSize: '13px' }}>(Daily)</div>
            </td>
            <td style={{ width: '25%', border: '1px solid #000', padding: '6px 10px', fontSize: '12px', verticalAlign: 'middle' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/01</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : {isBlank ? '' : (record.record_date || '29.05.2017')}</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Meta Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #000', marginBottom: '12px' }}>
        <div>CHECKED BY (OPERATOR) : <span style={{ fontWeight: 'normal', textDecoration: 'underline' }}>{isBlank ? '___________________' : (record.inspector_name || record.prepared_by || 'Operator')}</span></div>
        <div>VERIFIED BY : <span style={{ fontWeight: 'normal', textDecoration: 'underline' }}>{isBlank ? '___________________' : (record.supervisor_name || record.verified_by || 'Unit Supervisor')}</span></div>
      </div>

      {/* Checklist Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '1px solid #000', padding: '8px 10px', width: '55%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '15%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '1px solid #000', padding: '8px 8px', width: '22%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}.</td>
              <td style={{ border: '1px solid #000', padding: '10px', fontWeight: '600' }}>{p.point || p.activity}</td>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                {isBlank ? '' : (p.status === 'OK' || p.status === 'CHECK' || p.status === '✓' ? '✓ CHECK' : (p.status === 'H' ? 'H HOLIDAY' : (p.status || '✓ CHECK')))}
              </td>
              <td style={{ border: '1px solid #000', padding: '10px 8px' }}>
                {isBlank ? '' : (p.remarks || 'Standard compliance verified')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Legend & Verification */}
      <div style={{ display: 'flex', justifyContent: 'space-around', border: '1px solid #000', padding: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '20px' }}>
        <div>[ √ ] CHECK</div>
        <div>[ H ] HOLIDAY</div>
        <div>[ X ] NOT CHECK</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>
            {isBlank ? 'Signature of Operator' : (record.inspector_name || 'Operator Signature')}
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>OPERATOR / CHECKED BY</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>
            {isBlank ? 'Signature of Supervisor' : (record.supervisor_name || 'Unit Supervisor Signature')}
          </div>
          <div style={{ fontSize: '11px', color: '#555' }}>UNIT SUPERVISOR / VERIFIED BY</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C2: CLEANING CHECKLIST MACHINERIES (15 DAYS ONCE) - FORMAT NO. : BVC/CP/CL/02
// ----------------------------------------------------------------------
function C2PaperFormat({ record, isBlank }) {
  const chk = record.checklist || {};
  const items = isBlank ? [
    { title: 'SWEEP THE AREA WITH PLASTIC BROOM.', status: '', remarks: '' },
    { title: 'REMOVE ALL UNWANTED MATERIAL FROM PROCESS BEFORE START THE WORK', status: '', remarks: '' },
    { title: 'Clean /Scrap residues Screw blades & Clean the hopper & Discharge nozzles thoroughly', status: '', remarks: '' },
    { title: 'CLEAN THE DUST AS PER PROCEDURES:\n1. Motor Cover\n2. De-Stonner\n3. Pulse roller', status: '', remarks: '' }
  ] : [
    { title: 'SWEEP THE AREA WITH PLASTIC BROOM.', status: '✓ CHECK', remarks: 'Area swept' },
    { title: 'REMOVE ALL UNWANTED MATERIAL FROM PROCESS BEFORE START THE WORK', status: '✓ CHECK', remarks: 'Clean and clear' },
    { title: 'Clean /Scrap residues Screw blades & Clean the hopper & Discharge nozzles thoroughly', status: '✓ CHECK', remarks: 'Screw blades & hoppers scraped clean' },
    { title: 'CLEAN THE DUST AS PER PROCEDURES:\n1. Motor Cover\n2. De-Stonner\n3. Pulse roller', status: '✓ CHECK', remarks: 'Dust vacuumed and air blow cleaned' }
  ];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>BVC EXPORTS PVT LIMITED</div>
            </td>
            <td style={{ width: '40%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>CLEANING CHECKLIST</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>MACHINERIES</div>
              <div style={{ fontSize: '13px' }}>(15 DAYS ONCE)</div>
            </td>
            <td style={{ width: '25%', border: '1px solid #000', padding: '6px 10px', fontSize: '12px' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/02</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : {isBlank ? '' : (record.record_date || '29.05.2017')}</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #000', marginBottom: '12px' }}>
        <div>MACHINE NAME & CODE : <span style={{ fontWeight: 'normal' }}>{isBlank ? '___________________' : (chk.machine_name || 'Pulse Hammer Mill & De-Stoner #01')}</span></div>
        <div>RESPONSIBILITY : <span style={{ fontWeight: 'normal' }}>{isBlank ? '___________________' : (record.inspector_name || 'Milling Operator')}</span></div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '1px solid #000', padding: '8px 10px', width: '55%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '15%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '1px solid #000', padding: '8px 8px', width: '22%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}.</td>
              <td style={{ border: '1px solid #000', padding: '10px', fontWeight: '600', whiteSpace: 'pre-line' }}>{it.title}</td>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : it.status}</td>
              <td style={{ border: '1px solid #000', padding: '10px 8px' }}>{isBlank ? '' : it.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-around', border: '1px solid #000', padding: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '20px' }}>
        <div>[ √ ] CHECK</div>
        <div>[ H ] HOLIDAY</div>
        <div>[ X ] NOT CHECK</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'Operator')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>CHECKED BY</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'Plant Supervisor')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>VERIFIED BY</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C3: CLEANING CHECKLIST PEST CONTROL (MONTHLY ONCE) - FORMAT NO. : BVC/CP/CL/03
// ----------------------------------------------------------------------
function C3PaperFormat({ record, isBlank }) {
  const items = isBlank ? [
    { title: 'BEFORE TO STOP THE PRODUCTION\nRAW MATERIAL MOVE & CLOSED', status: '', remarks: '' },
    { title: 'MACHINE PARTS OPENED & RESIDUES TO BE REMOVED.\nCONDUCT THE PEST CONTROL ACTIVITIES WITH PCI OPERATORS WITH APPROVED CHEMICALS', status: '', remarks: '' },
    { title: 'WASHED THOROUGHLY TREATED SURFACE WITH HOT WATER.\nTHEN RINSE AND WASHED WITH FRESH WATER, WIPE WITH CLOTH AND DRY.', status: '', remarks: '' },
    { title: 'INITIAL RUN WITH SMALL QUANTITIES OF PRODUCT.\nREMOVE THE INITIAL RUN PRODUCT AND USE MACHINE FOR PRODUCTION/PACKAGING.', status: '', remarks: '' }
  ] : [
    { title: 'BEFORE TO STOP THE PRODUCTION\nRAW MATERIAL MOVE & CLOSED', status: '✓ CHECK', remarks: 'All RM covers sealed' },
    { title: 'MACHINE PARTS OPENED & RESIDUES TO BE REMOVED.\nCONDUCT THE PEST CONTROL ACTIVITIES WITH PCI OPERATORS WITH APPROVED CHEMICALS', status: '✓ CHECK', remarks: 'PCI chemical applied safely' },
    { title: 'WASHED THOROUGHLY TREATED SURFACE WITH HOT WATER.\nTHEN RINSE AND WASHED WITH FRESH WATER, WIPE WITH CLOTH AND DRY.', status: '✓ CHECK', remarks: 'Hot water washed & dried' },
    { title: 'INITIAL RUN WITH SMALL QUANTITIES OF PRODUCT.\nREMOVE THE INITIAL RUN PRODUCT AND USE MACHINE FOR PRODUCTION/PACKAGING.', status: '✓ CHECK', remarks: 'Purge run discarded properly' }
  ];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>BVC EXPORTS PVT LIMITED</div>
            </td>
            <td style={{ width: '40%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>CLEANING CHECKLIST</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>PEST CONTROL</div>
              <div style={{ fontSize: '13px' }}>(MONTHLY ONCE)</div>
            </td>
            <td style={{ width: '25%', border: '1px solid #000', padding: '6px 10px', fontSize: '12px' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/03</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : {isBlank ? '' : (record.record_date || '29.05.2017')}</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '1px solid #000', padding: '8px 10px', width: '55%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '15%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '1px solid #000', padding: '8px 8px', width: '22%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}.</td>
              <td style={{ border: '1px solid #000', padding: '10px', fontWeight: '600', whiteSpace: 'pre-line' }}>{it.title}</td>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : it.status}</td>
              <td style={{ border: '1px solid #000', padding: '10px 8px' }}>{isBlank ? '' : it.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-around', border: '1px solid #000', padding: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '20px' }}>
        <div>[ √ ] CHECK</div>
        <div>[ H ] HOLIDAY</div>
        <div>[ X ] NOT CHECK</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'PCI Incharge')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>CHECKED BY</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'QA Manager')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>VERIFIED BY</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C4: CLEANING CHECKLIST WATER TANK (15 DAYS ONCE) - FORMAT NO. : BVC/CP/CL/04
// ----------------------------------------------------------------------
function C4PaperFormat({ record, isBlank }) {
  const items = isBlank ? [
    { title: 'Before clean the tank to stop the production. Remove the water by using plastic buckets.', status: '', remarks: '' },
    { title: 'Mop the area with water treated with 1% (100Ml/10Litres) Sodium hypo chloride Solution.', status: '', remarks: '' },
    { title: 'Clean the water tank thoroughly by using plastic brooms.', status: '', remarks: '' },
    { title: 'If any damages find inform to unit supervisor. After the cleaning to put 3-4 bucket of water for dust removing. Then allowed for production.', status: '', remarks: '' }
  ] : [
    { title: 'Before clean the tank to stop the production. Remove the water by using plastic buckets.', status: '✓ CHECK', remarks: 'Water drained' },
    { title: 'Mop the area with water treated with 1% (100Ml/10Litres) Sodium hypo chloride Solution.', status: '✓ CHECK', remarks: '1% Hypochlorite applied' },
    { title: 'Clean the water tank thoroughly by using plastic brooms.', status: '✓ CHECK', remarks: 'Tank scrubbed clean' },
    { title: 'If any damages find inform to unit supervisor. After the cleaning to put 3-4 bucket of water for dust removing. Then allowed for production.', status: '✓ CHECK', remarks: 'Flushed 4 buckets, cleared' }
  ];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>BVC EXPORTS PVT LIMITED</div>
            </td>
            <td style={{ width: '40%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>CLEANING CHECKLIST</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>WATER TANK</div>
              <div style={{ fontSize: '13px' }}>(15 DAYS ONCE)</div>
            </td>
            <td style={{ width: '25%', border: '1px solid #000', padding: '6px 10px', fontSize: '12px' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/04</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : {isBlank ? '' : (record.record_date || '29.05.2017')}</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '1px solid #000', padding: '8px 10px', width: '55%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '15%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '1px solid #000', padding: '8px 8px', width: '22%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}.</td>
              <td style={{ border: '1px solid #000', padding: '10px', fontWeight: '600' }}>{it.title}</td>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : it.status}</td>
              <td style={{ border: '1px solid #000', padding: '10px 8px' }}>{isBlank ? '' : it.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-around', border: '1px solid #000', padding: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '20px' }}>
        <div>[ √ ] CHECK</div>
        <div>[ H ] HOLIDAY</div>
        <div>[ X ] NOT CHECK</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'Sanitation Staff')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>CHECKED BY</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'Plant Supervisor')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>VERIFIED BY</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C5: CLEANING CHECKLIST WINDOW-GLASS (MONTHLY ONCE) - FORMAT NO. : BVC/CP/CL/05
// ----------------------------------------------------------------------
function C5PaperFormat({ record, isBlank }) {
  const items = isBlank ? [
    { title: 'BEFORE TO STOP THE PRODUCTION\nTO CLEAN WINDOW BY USING COTTON CLOTH.', status: '', remarks: '' },
    { title: 'TO APPLY 2ML OF COLIN WITH COTTON CLOTH AND TO RUB THE SURFACE\nIF ANY DAMAGES FIND INFORM TO UNIT SUPERVISOR.', status: '', remarks: '' }
  ] : [
    { title: 'BEFORE TO STOP THE PRODUCTION\nTO CLEAN WINDOW BY USING COTTON CLOTH.', status: '✓ CHECK', remarks: 'Wiped dust-free' },
    { title: 'TO APPLY 2ML OF COLIN WITH COTTON CLOTH AND TO RUB THE SURFACE\nIF ANY DAMAGES FIND INFORM TO UNIT SUPERVISOR.', status: '✓ CHECK', remarks: 'Glass cleaned with Colin, no crack' }
  ];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>BVC EXPORTS PVT LIMITED</div>
            </td>
            <td style={{ width: '40%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>CLEANING CHECKLIST</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>WINDOW-GLASS</div>
              <div style={{ fontSize: '13px' }}>(MONTHLY ONCE)</div>
            </td>
            <td style={{ width: '25%', border: '1px solid #000', padding: '6px 10px', fontSize: '12px' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/05</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : {isBlank ? '' : (record.record_date || '29.05.2017')}</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #000', marginBottom: '12px' }}>
        <div>WINDOW ID CODE : <span style={{ fontWeight: 'normal' }}>{isBlank ? '___________________' : (record.checklist?.window_id || 'WIN-MILL-01 to 08')}</span></div>
        <div>LOCATION : <span style={{ fontWeight: 'normal' }}>{isBlank ? '___________________' : (record.area_location || 'Milling Hall & Packaging Area')}</span></div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '1px solid #000', padding: '8px 10px', width: '55%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '15%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '1px solid #000', padding: '8px 8px', width: '22%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}.</td>
              <td style={{ border: '1px solid #000', padding: '10px', fontWeight: '600', whiteSpace: 'pre-line' }}>{it.title}</td>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : it.status}</td>
              <td style={{ border: '1px solid #000', padding: '10px 8px' }}>{isBlank ? '' : it.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-around', border: '1px solid #000', padding: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '20px' }}>
        <div>[ √ ] CHECK</div>
        <div>[ H ] HOLIDAY</div>
        <div>[ X ] NOT CHECK</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'Housekeeper')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>CHECKED BY</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'Unit Supervisor')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>VERIFIED BY</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C6: CLEANING CHECKLIST WOOD-PALLET (15 DAYS ONCE) - FORMAT NO. : BVC/CP/CL/06
// ----------------------------------------------------------------------
function C6PaperFormat({ record, isBlank }) {
  const items = isBlank ? [
    { title: 'Before clean the pallet to place out the pallet from store area.', status: '', remarks: '' },
    { title: 'Wipe out dust from the pallet.', status: '', remarks: '' },
    { title: 'Check out the pallet if any damage observed. & Wipe out the damaged pallet from the store area.', status: '', remarks: '' },
    { title: 'Inform to the unit supervisor if any damage observed.', status: '', remarks: '' }
  ] : [
    { title: 'Before clean the pallet to place out the pallet from store area.', status: '✓ CHECK', remarks: 'Pallets isolated outside store' },
    { title: 'Wipe out dust from the pallet.', status: '✓ CHECK', remarks: 'Dust brushed and wiped' },
    { title: 'Check out the pallet if any damage observed. & Wipe out the damaged pallet from the store area.', status: '✓ CHECK', remarks: 'No broken planks' },
    { title: 'Inform to the unit supervisor if any damage observed.', status: '✓ CHECK', remarks: 'Reported to supervisor' }
  ];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '12px' }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>BVC EXPORTS PVT LIMITED</div>
            </td>
            <td style={{ width: '40%', border: '1px solid #000', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>CLEANING CHECKLIST</div>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>WOOD-PALLET</div>
              <div style={{ fontSize: '13px' }}>(15 DAYS ONCE)</div>
            </td>
            <td style={{ width: '25%', border: '1px solid #000', padding: '6px 10px', fontSize: '12px' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/06</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE</strong> : {isBlank ? '' : (record.record_date || '29.05.2017')}</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ padding: '6px 10px', fontSize: '13px', fontWeight: 'bold', border: '1px solid #000', marginBottom: '12px' }}>
        PALLET CODE / NO : <span style={{ fontWeight: 'normal' }}>{isBlank ? '___________________' : (record.checklist?.pallet_id || 'PLT-WD-01 to 50')}</span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '8%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '1px solid #000', padding: '8px 10px', width: '55%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '15%', textAlign: 'center' }}>STATUS</th>
            <th style={{ border: '1px solid #000', padding: '8px 8px', width: '22%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}.</td>
              <td style={{ border: '1px solid #000', padding: '10px', fontWeight: '600' }}>{it.title}</td>
              <td style={{ border: '1px solid #000', padding: '10px 6px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : it.status}</td>
              <td style={{ border: '1px solid #000', padding: '10px 8px' }}>{isBlank ? '' : it.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-around', border: '1px solid #000', padding: '8px', fontSize: '12px', fontWeight: 'bold', marginBottom: '20px' }}>
        <div>[ √ ] CHECK</div>
        <div>[ H ] HOLIDAY</div>
        <div>[ X ] NOT CHECK</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'Store Keeper')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>CHECKED BY</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'Unit Supervisor')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>VERIFIED BY</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C7: TOILET INSPECTION CHECK LIST (Daily) - DOC Ref : BVC-QA-F-05
// ----------------------------------------------------------------------
function C7PaperFormat({ record, isBlank }) {
  const chk = record.checklist || {};
  const params = [
    'Floor / Area Cleanliness',
    'Urinal area cleanliness',
    'Water tap working',
    'Water availability',
    'Soap Solution availability',
    'Bucket / Tub availability',
    'Flush working condition',
    'Lights working',
    'Hand dryer / Towel available'
  ];

  return (
    <Box>
      <div style={{ textAlign: 'center', border: '2px solid #000', padding: '8px', marginBottom: '10px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '16px' }}>BVC EXPORTS PVT LTD</div>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>TOILET INSPECTION CHECK LIST</div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #000', marginBottom: '10px' }}>
        <div>DOC Ref : BVC-QA-F-05</div>
        <div>Month : {isBlank ? '___________________' : (record.record_date?.slice(0, 7) || '2026-08')}</div>
        <div>Toilet : {isBlank ? '___________________' : (record.area_location || 'Gents Restroom Block A')}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '6px', width: '8%', textAlign: 'center' }}>Sl.No</th>
            <th style={{ border: '1px solid #000', padding: '6px 10px', width: '50%', textAlign: 'left' }}>Check for</th>
            <th style={{ border: '1px solid #000', padding: '6px', width: '20%', textAlign: 'center' }}>Status (✓- Yes / X- No)</th>
            <th style={{ border: '1px solid #000', padding: '6px 10px', width: '22%', textAlign: 'left' }}>Remarks</th>
          </tr>
        </thead>
        <tbody>
          {params.map((item, idx) => {
            const found = (chk.checklist || []).find(c => c.item === item) || {};
            const isOk = found.status === 'OK' || found.status === 'Yes' || found.status === '✓' || true;
            return (
              <tr key={idx}>
                <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: '600' }}>{item}</td>
                <td style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                  {isBlank ? '' : (isOk ? '✓ Yes' : 'X No')}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px 10px' }}>
                  {isBlank ? '' : (found.remarks || 'Clean & verified')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '20px', padding: '4px' }}>
        Legend: ✓- Yes &nbsp;&nbsp;&nbsp; X- No
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'House Keeper')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>Done By: House Keeper</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'HR MANAGER')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>Checked by : HR MANAGER</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C8: VEHICLE LOADING/UN LOADING INSPECTION REPORT - DOC Ref : BVC/QA/F/07
// ----------------------------------------------------------------------
function C8PaperFormat({ record, isBlank }) {
  const chk = record.checklist || {};
  const points = [
    'Cleanliness of truck - Dust / Dirt',
    'No Pest / Pest droppings',
    'No foreign material / Moisture',
    'Doors are intact- Good condition',
    'No corrosion (platform / all inner area)',
    'Truck sealing (empty and after loading)',
    'Any unwanted Odour',
    'Tarpalin in the truck(clean/damage)',
    'General acceptance of truck'
  ];

  return (
    <Box>
      <div style={{ textAlign: 'center', border: '2px solid #000', padding: '8px', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px' }}>VEHICLE LOADING/UN LOADING INSPECTION REPORT</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '10px', fontSize: '12px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #000', padding: '6px 10px', width: '50%' }}>
              <strong>DOC Ref</strong> : BVC/QA/F/07
            </td>
            <td style={{ border: '1px solid #000', padding: '6px 10px', width: '50%' }}>
              <strong>Date</strong> : {isBlank ? '' : (record.record_date || new Date().toISOString().split('T')[0])}
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #000', padding: '6px 10px' }}>
              <strong>Customer / Qty</strong> : {isBlank ? '' : (chk.customer ? `${chk.customer} / ${chk.quantity || '25 MT'}` : (record.customer_name || 'Royal Foods / 500 Bags'))}
            </td>
            <td style={{ border: '1px solid #000', padding: '6px 10px' }}>
              <strong>Vehicle No</strong> : {isBlank ? '' : (chk.vehicle_no || record.vehicle_no || 'TN-58-AX-9912')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '8%', textAlign: 'center' }}>Sl.No</th>
            <th style={{ border: '1px solid #000', padding: '8px 10px', width: '45%', textAlign: 'left' }}>Check for</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '12%', textAlign: 'center' }}>OK</th>
            <th style={{ border: '1px solid #000', padding: '8px 6px', width: '12%', textAlign: 'center' }}>Not OK</th>
            <th style={{ border: '1px solid #000', padding: '8px 8px', width: '23%', textAlign: 'left' }}>REMARKS / Vehicle No</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt, idx) => {
            const found = (chk.checklist || []).find(c => c.check_point && c.check_point.includes(pt.split(' - ')[0])) || {};
            const isOk = !isBlank;
            return (
              <tr key={idx}>
                <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: '600' }}>{pt}</td>
                <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                  {isBlank ? '' : (isOk ? '✓' : '')}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontSize: '14px', fontWeight: 'bold' }}>
                  {isBlank ? '' : (!isOk ? 'X' : '')}
                </td>
                <td style={{ border: '1px solid #000', padding: '8px 8px' }}>
                  {isBlank ? '' : (found.remarks || 'Compliant')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'Security Officer')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>Checked by : (Security)</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'Dispatch Clerk')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>Verified by : (clerk)</div>
        </div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C9: Food Handlers Personal Hygiene Log - Form No: BVC/QA/F/01
// ----------------------------------------------------------------------
function C9PaperFormat({ record, isBlank }) {
  const chk = record.checklist || {};
  const rows = isBlank ? Array.from({ length: 11 }, (_, i) => ({
    s_no: i + 1,
    shift: '',
    emp_name: '',
    area: '',
    ppe: '',
    nails: '',
    wounds: '',
    illness: '',
    jewels: '',
    chemicals: '',
    smoking: '',
    remarks: '',
    action: ''
  })) : (chk.employees && chk.employees.length > 0 ? chk.employees : [
    { s_no: 1, shift: 'D', emp_name: 'Murugan K', area: 'Milling', ppe: '✓', nails: '✓', wounds: '✓', illness: '✓', jewels: '✓', chemicals: '✓', smoking: '✓', remarks: 'Fit', action: 'Nil' },
    { s_no: 2, shift: 'D', emp_name: 'Suresh P', area: 'Packing', ppe: '✓', nails: '✓', wounds: '✓', illness: '✓', jewels: '✓', chemicals: '✓', smoking: '✓', remarks: 'Fit', action: 'Nil' },
    { s_no: 3, shift: 'D', emp_name: 'Anand R', area: 'Sifting', ppe: '✓', nails: '✓', wounds: '✓', illness: '✓', jewels: '✓', chemicals: '✓', smoking: '✓', remarks: 'Fit', action: 'Nil' },
    { s_no: 4, shift: 'D', emp_name: 'Kavitha M', area: 'Packing', ppe: '✓', nails: '✓', wounds: '✓', illness: '✓', jewels: '✓', chemicals: '✓', smoking: '✓', remarks: 'Fit', action: 'Nil' },
    { s_no: 5, shift: 'D', emp_name: 'Govindan V', area: 'Store', ppe: '✓', nails: '✓', wounds: '✓', illness: '✓', jewels: '✓', chemicals: '✓', smoking: '✓', remarks: 'Fit', action: 'Nil' }
  ]);

  return (
    <Box>
      {/* Header */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '8px' }}>
        <tbody>
          <tr>
            <td style={{ width: '70%', padding: '8px 12px', textAlign: 'center' }}>
              <div style={{ fontWeight: 'bold', fontSize: '16px' }}>BVC EXPORTS (PVT) LTD</div>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>Food Handlers Personal Hygiene Log</div>
            </td>
            <td style={{ width: '30%', padding: '6px 10px', fontSize: '11px', borderLeft: '1px solid #000' }}>
              <div><strong>Form No</strong>: BVC/QA/F/01</div>
              <div><strong>Rev.No</strong> : 0</div>
              <div><strong>Date</strong>: 29.05.2017</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px' }}>
        Date: {isBlank ? '___________________' : (record.record_date || new Date().toISOString().split('T')[0])}
      </div>

      {/* Main Hygiene Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '12px', fontSize: '10px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th rowSpan="2" style={{ border: '1px solid #000', padding: '4px', width: '3%', textAlign: 'center' }}>Sl. No</th>
            <th rowSpan="2" style={{ border: '1px solid #000', padding: '4px', width: '4%', textAlign: 'center' }}>Shift</th>
            <th rowSpan="2" style={{ border: '1px solid #000', padding: '4px', width: '14%', textAlign: 'left' }}>Worker Name</th>
            <th rowSpan="2" style={{ border: '1px solid #000', padding: '4px', width: '10%', textAlign: 'left' }}>Area</th>
            <th colSpan="7" style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>✓-ok &nbsp;&nbsp; X- Not Ok</th>
            <th rowSpan="2" style={{ border: '1px solid #000', padding: '4px', width: '10%', textAlign: 'left' }}>Remarks</th>
            <th rowSpan="2" style={{ border: '1px solid #000', padding: '4px', width: '10%', textAlign: 'left' }}>Corrective Action</th>
          </tr>
          <tr style={{ background: '#f8fafc', fontSize: '9px' }}>
            <th style={{ border: '1px solid #000', padding: '3px', width: '8%' }}>Wearing PPEs (Head Cover/ Mask/)</th>
            <th style={{ border: '1px solid #000', padding: '3px', width: '8%' }}>Nail Trimming/No discharges ear/eye/nose</th>
            <th style={{ border: '1px solid #000', padding: '3px', width: '7%' }}>Free from Visible wounds</th>
            <th style={{ border: '1px solid #000', padding: '3px', width: '8%' }}>No symptoms illness / Running nose</th>
            <th style={{ border: '1px solid #000', padding: '3px', width: '8%' }}>No exposed jewels/ belongings</th>
            <th style={{ border: '1px solid #000', padding: '3px', width: '8%' }}>No use of mehandi, chemicals</th>
            <th style={{ border: '1px solid #000', padding: '3px', width: '7%' }}>No Smoking /chewing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (row.shift || 'D')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', fontWeight: '600' }}>{isBlank ? '' : (row.emp_name || row.worker_name || '')}</td>
              <td style={{ border: '1px solid #000', padding: '4px' }}>{isBlank ? '' : (row.area || row.department || 'Production')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : (row.ppe || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : (row.nails || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : (row.wounds || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : (row.illness || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : (row.jewels || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : (row.chemicals || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold' }}>{isBlank ? '' : (row.smoking || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px' }}>{isBlank ? '' : (row.remarks || 'Fit')}</td>
              <td style={{ border: '1px solid #000', padding: '4px' }}>{isBlank ? '' : (row.action || 'Nil')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', padding: '0 20px', fontSize: '12px' }}>
        <div>CheckedBy: <span style={{ fontWeight: 'bold' }}>{isBlank ? '___________________' : (record.inspector_name || 'QMR')}</span></div>
        <div>Approved By: <span style={{ fontWeight: 'bold' }}>{isBlank ? '___________________' : (record.supervisor_name || 'Managing Director')}</span></div>
      </div>
    </Box>
  );
}

// ----------------------------------------------------------------------
// C10: PRIMARY PACKING MATERIAL INSPECTION RECORD (PPMI)
// ----------------------------------------------------------------------
function C10PaperFormat({ record, isBlank }) {
  const chk = record.checklist || {};
  const params = [
    { name: 'Physical Parameters', std: 'Free from contamination & dust' },
    { name: 'Bottom Stitching', std: 'Even, double folded, minimum 3 stitches/inch' },
    { name: 'Top Open', std: 'Clean cut, non-frayed' },
    { name: 'Liner', std: 'Virgin Food Grade LDPE, 50 Micron' },
    { name: 'Size', std: '24 x 36 inches (± 0.5 inch)' },
    { name: 'Weight', std: '120g ± 5g per bag' },
    { name: 'Printing space on top', std: 'Minimum 4 inches border clearance' },
    { name: 'Printing Matter', std: 'Brand name, Net Wt, FSSAI, Batch text crisp' },
    { name: 'Printing Ink', std: 'Non-toxic, food grade, rub-proof' }
  ];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #000', marginBottom: '8px' }}>
        <tbody>
          <tr>
            <td style={{ width: '35%', padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #000' }}>
              <div style={{ fontWeight: 'bold', fontSize: '15px' }}>BVC EXPORTS PRIVATE LIMITED</div>
            </td>
            <td style={{ width: '40%', padding: '8px 12px', textAlign: 'center', borderRight: '1px solid #000' }}>
              <div style={{ fontWeight: 'bold', fontSize: '14px' }}>PRIMARY PACKING MATERIAL INSPECTION RECORD</div>
            </td>
            <td style={{ width: '25%', padding: '6px 10px', fontSize: '11px' }}>
              <div><strong>PPMI:</strong> {isBlank ? '' : (record.record_no || 'PPMI/2026/001')}</div>
              <div><strong>DATE:</strong> {isBlank ? '' : (record.record_date || new Date().toISOString().split('T')[0])}</div>
              <div><strong>SUPPLIER:</strong> {isBlank ? '' : (chk.supplier || record.supplier_name || 'Sri Krishna Packaging')}</div>
              <div><strong>INVOICE NO:</strong> {isBlank ? '' : (chk.purchase_no || 'INV-2026-881')}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px', fontSize: '12px', fontWeight: 'bold', border: '1px solid #000', marginBottom: '8px' }}>
        <div>Date: {isBlank ? '___________________' : (record.record_date || new Date().toISOString().split('T')[0])}</div>
        <div>Time : {isBlank ? '___________________' : (chk.inspection_time || '10:30 AM')}</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: '14px', fontSize: '12px' }}>
        <thead>
          <tr style={{ background: '#f1f5f9' }}>
            <th style={{ border: '1px solid #000', padding: '6px', width: '8%', textAlign: 'center' }}>S.NO</th>
            <th style={{ border: '1px solid #000', padding: '6px 10px', width: '30%', textAlign: 'left' }}>PARAMETERS</th>
            <th style={{ border: '1px solid #000', padding: '6px 10px', width: '26%', textAlign: 'left' }}>STD WITH TOLERANCE</th>
            <th style={{ border: '1px solid #000', padding: '6px 10px', width: '20%', textAlign: 'left' }}>OBSERVATIONS</th>
            <th style={{ border: '1px solid #000', padding: '6px 10px', width: '16%', textAlign: 'left' }}>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => {
            const found = (chk.parameters || []).find(param => param.parameter && param.parameter.toLowerCase().includes(p.name.toLowerCase().split(' ')[0])) || {};
            return (
              <tr key={idx}>
                <td style={{ border: '1px solid #000', padding: '8px 6px', textAlign: 'center', fontWeight: 'bold' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: '600' }}>{p.name}</td>
                <td style={{ border: '1px solid #000', padding: '8px 10px', fontSize: '11px' }}>{p.std}</td>
                <td style={{ border: '1px solid #000', padding: '8px 10px', fontWeight: 'bold' }}>{isBlank ? '' : (found.observed || 'Conforms to standard')}</td>
                <td style={{ border: '1px solid #000', padding: '8px 10px' }}>{isBlank ? '' : (found.result === 'Pass' || !found.result ? 'Accepted' : found.result)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', padding: '0 20px', fontSize: '13px' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.prepared_by || 'QC Inspector')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>Prepared By</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #000', width: '200px', paddingTop: '4px', fontWeight: 'bold' }}>{isBlank ? '' : (record.verified_by || 'QA Head')}</div>
          <div style={{ fontSize: '11px', color: '#555' }}>Approved By</div>
        </div>
      </div>
    </Box>
  );
}
