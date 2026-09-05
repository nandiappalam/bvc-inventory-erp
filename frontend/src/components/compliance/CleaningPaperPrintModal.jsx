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
import { printHtml } from '../../utils/printHelper';

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
    const el = document.getElementById('official-cleaning-paper-record');
    if (el) {
      printHtml(el.innerHTML, `Cleaning Record - ${r.record_no || code}`);
    } else {
      window.print();
    }
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
            Official BVC Paper Format Print Preview {isBlank ? '(Blank Form)' : `— ${r.record_no || code}`}
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
          {code === 'C1' && <C1Paper record={r} isBlank={isBlank} />}
          {code === 'C2' && <C2Paper record={r} isBlank={isBlank} />}
          {code === 'C3' && <C3Paper record={r} isBlank={isBlank} />}
          {code === 'C4' && <C4Paper record={r} isBlank={isBlank} />}
          {code === 'C5' && <C5Paper record={r} isBlank={isBlank} />}
          {code === 'C6' && <C6Paper record={r} isBlank={isBlank} />}
          {code === 'C7' && <C7Paper record={r} isBlank={isBlank} />}
          {code === 'C8' && <C8Paper record={r} isBlank={isBlank} />}
          {code === 'C9' && <C9Paper record={r} isBlank={isBlank} />}
          {code === 'C10' && <C10Paper record={r} isBlank={isBlank} />}
          {code === 'C11' && <C11Paper record={r} isBlank={isBlank} />}
          {code === 'C12' && <C12Paper record={r} isBlank={isBlank} />}
          {code === 'C13' && <C13Paper record={r} isBlank={isBlank} />}
          {code === 'C14' && <C14Paper record={r} isBlank={isBlank} />}
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
    </Dialog>
  );
}

// C1: PRODUCTION AREA CLEANING (DAILY)
function C1Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const activities = chk.activities || [
    { s_no: 1, activity: 'SWEEP THE AREA WITH PLASTIC BROOM.', status: 'OK', remarks: '' },
    { s_no: 2, activity: 'REMOVE ALL UNWANTED MATERIAL FROM PROCESS BEFORE START THE WORK', status: 'OK', remarks: '' },
    { s_no: 3, activity: 'RUB THE STAINED AREA WITH 1% (100ML/10LITRES) SOAP SOLUTION.', status: 'OK', remarks: '' },
    { s_no: 4, activity: 'MOP THE AREA WITH WATER TREATED WITH 1% (100ML/10LITRES) SODIUM HYPO CHLORIDE SOLUTION', status: 'OK', remarks: '' }
  ];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000' }}>
                BVC EXPORTS PVT LIMITED
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', color: '#000' }}>
                CLEANING CHECKLIST<br />PRODUCTION AREA<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(Daily)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/01</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE :</strong> {isBlank ? '' : record.record_date}</div>
              <div><strong>PAGE</strong> : 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>CHECKED BY (OPERATOR) :</strong> {isBlank ? '' : (record.inspector_name || 'Operator')}
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>VERIFIED BY : UNIT SUPERVISOR</strong> {isBlank ? '' : (record.supervisor_name || 'Supervisor')}
            </td>
          </tr>
        </tbody>
      </table>

      {/* Activities Grid */}
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '6%', textAlign: 'center' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '36%', textAlign: 'left' }}>ACTIVITIES</th>
            <th style={{ border: '2px solid #000', padding: '4px', width: '38%', textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #000', paddingBottom: 2, marginBottom: 2 }}>DAILY EXECUTION MATRIX</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', fontSize: '0.65rem' }}>
                {Array.from({ length: 16 }, (_, i) => <div key={i}>{i + 1}</div>)}
              </div>
            </th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '20%', textAlign: 'left' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600, fontSize: '0.85rem' }}>{act.activity}</td>
              <td style={{ border: '2px solid #000', padding: '4px', textAlign: 'center' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', fontSize: '0.75rem', fontWeight: 700 }}>
                  {Array.from({ length: 16 }, (_, i) => (
                    <div key={i} style={{ borderRight: '1px solid #ccc' }}>
                      {isBlank ? '' : (act.status === 'OK' ? '√' : act.status === 'HOLIDAY' ? 'H' : 'X')}
                    </div>
                  ))}
                </div>
              </td>
              <td style={{ border: '2px solid #000', padding: '8px', fontSize: '0.85rem' }}>{isBlank ? '' : (act.remarks || 'Cleaned as per SOP')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <Box><strong>[ √ ]</strong> CHECK</Box>
        <Box><strong>[ H ]</strong> HOLIDAY</Box>
        <Box><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// C2: MACHINERIES (15 DAYS ONCE)
function C2Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const activities = chk.activities || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PVT LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                CLEANING CHECKLIST<br />MACHINERIES<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(15 DAYS ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/02</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE :</strong> 29.05.2017</div>
              <div><strong>PAGE :</strong> 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>MACHINE NAME & CODE :</strong> {isBlank ? '' : (record.area_location || chk.machine_name || 'Pulse Hammer Mill #01')}
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>RESPONSIBILITY :</strong> {isBlank ? '' : (chk.responsibility || 'Operator / Cleaner')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', fontSize: '0.75rem' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '5%' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '35%', textAlign: 'left' }}>ACTIVITIES</th>
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => (
              <th key={m} style={{ border: '1px solid #000', padding: '2px', width: '3%' }}>{m}</th>
            ))}
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>CHECKED BY</th>
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>VERIFIED BY</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '8%' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx} style={{ fontSize: '0.8rem' }}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 600, whiteSpace: 'pre-line' }}>{act.activity}</td>
              {Array.from({ length: 12 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 700 }}>
                  {isBlank ? '' : '√'}
                </td>
              ))}
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.inspector_name || 'Operator')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.supervisor_name || 'Supervisor')}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : (act.remarks || 'OK')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <Box><strong>[ √ ]</strong> CHECK</Box>
        <Box><strong>[ H ]</strong> HOLIDAY</Box>
        <Box><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// C3: PEST CONTROL (MONTHLY ONCE)
function C3Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const activities = chk.activities || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PVT LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                CLEANING CHECKLIST<br />PEST CONTROL<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(MONTHLY ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/03</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE :</strong> 29.05.2017</div>
              <div><strong>PAGE :</strong> 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', fontSize: '0.75rem' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '5%' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '35%', textAlign: 'left' }}>ACTIVITIES</th>
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => (
              <th key={m} style={{ border: '1px solid #000', padding: '2px', width: '3%' }}>{m}</th>
            ))}
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>CHECKED BY</th>
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>VERIFIED BY</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '8%' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx} style={{ fontSize: '0.8rem' }}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 600, whiteSpace: 'pre-line' }}>{act.activity}</td>
              {Array.from({ length: 12 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 700 }}>
                  {isBlank ? '' : '√'}
                </td>
              ))}
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.inspector_name || 'PCI Op')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.supervisor_name || 'QA Incharge')}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : (act.remarks || 'Completed')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <Box><strong>[ √ ]</strong> CHECK</Box>
        <Box><strong>[ H ]</strong> HOLIDAY</Box>
        <Box><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// C4: WATER TANK (15 DAYS ONCE)
function C4Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const activities = chk.activities || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PVT LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                CLEANING CHECKLIST<br />WATER TANK<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(15 DAYS ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/04</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE :</strong> 29.05.2017</div>
              <div><strong>PAGE :</strong> 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', fontSize: '0.75rem' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '5%' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '35%', textAlign: 'left' }}>ACTIVITIES</th>
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => (
              <th key={m} style={{ border: '1px solid #000', padding: '2px', width: '3%' }}>{m}</th>
            ))}
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>CHECKED BY</th>
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>VERIFIED BY</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '8%' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx} style={{ fontSize: '0.8rem' }}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 600, whiteSpace: 'pre-line' }}>{act.activity}</td>
              {Array.from({ length: 12 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 700 }}>
                  {isBlank ? '' : '√'}
                </td>
              ))}
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.inspector_name || 'Sanitation')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.supervisor_name || 'Supervisor')}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : (act.remarks || 'Clean')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <Box><strong>[ √ ]</strong> CHECK</Box>
        <Box><strong>[ H ]</strong> HOLIDAY</Box>
        <Box><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// C5: WINDOW-GLASS (MONTHLY ONCE)
function C5Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const activities = chk.activities || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PVT LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                CLEANING CHECKLIST<br />WINDOW-GLASS<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(MONTHLY ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/05</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE :</strong> 29.05.2017</div>
              <div><strong>PAGE :</strong> 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>WINDOW ID CODE :</strong> {isBlank ? '' : (chk.window_id_code || 'WIN-MIL-01 to 08')}
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>LOCATION :</strong> {isBlank ? '' : (record.area_location || chk.location || 'Milling Hall Line 1')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', fontSize: '0.75rem' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '5%' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '35%', textAlign: 'left' }}>ACTIVITIES</th>
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => (
              <th key={m} style={{ border: '1px solid #000', padding: '2px', width: '3%' }}>{m}</th>
            ))}
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>CHECKED BY</th>
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>VERIFIED BY</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '8%' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx} style={{ fontSize: '0.8rem' }}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 600, whiteSpace: 'pre-line' }}>{act.activity}</td>
              {Array.from({ length: 12 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 700 }}>
                  {isBlank ? '' : '√'}
                </td>
              ))}
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.inspector_name || 'Housekeeper')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.supervisor_name || 'Supervisor')}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : (act.remarks || 'Glass clear')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <Box><strong>[ √ ]</strong> CHECK</Box>
        <Box><strong>[ H ]</strong> HOLIDAY</Box>
        <Box><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// C6: WOOD-PALLET (15 DAYS ONCE)
function C6Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const activities = chk.activities || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PVT LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                CLEANING CHECKLIST<br />WOOD-PALLET<br /><span style={{ fontSize: '0.9rem', fontWeight: 600 }}>(15 DAYS ONCE)</span>
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>FORMAT NO.</strong> : BVC/CP/CL/06</div>
              <div><strong>REV. NO.</strong> : 00</div>
              <div><strong>DATE :</strong> 29.05.2017</div>
              <div><strong>PAGE :</strong> 1 OF 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px' }}>
              <strong>PALLET CODE/NO :</strong> {isBlank ? '' : (record.area_location || chk.pallet_code || 'PLT-WD-01 to 50')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', fontSize: '0.75rem' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '5%' }}>SL.NO.</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '35%', textAlign: 'left' }}>ACTIVITIES</th>
            {['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'].map(m => (
              <th key={m} style={{ border: '1px solid #000', padding: '2px', width: '3%' }}>{m}</th>
            ))}
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>CHECKED BY</th>
            <th style={{ border: '1px solid #000', padding: '4px', width: '8%' }}>VERIFIED BY</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '8%' }}>REMARKS</th>
          </tr>
        </thead>
        <tbody>
          {activities.map((act, idx) => (
            <tr key={idx} style={{ fontSize: '0.8rem' }}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{act.s_no}.</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 600, whiteSpace: 'pre-line' }}>{act.activity}</td>
              {Array.from({ length: 12 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '2px', textAlign: 'center', fontWeight: 700 }}>
                  {isBlank ? '' : '√'}
                </td>
              ))}
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.inspector_name || 'Store Staff')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{isBlank ? '' : (record.supervisor_name || 'Supervisor')}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : (act.remarks || 'Pallets OK')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-around', alignItems: 'center' }}>
        <Box><strong>[ √ ]</strong> CHECK</Box>
        <Box><strong>[ H ]</strong> HOLIDAY</Box>
        <Box><strong>[ X ]</strong> NOT CHECK</Box>
      </Box>
    </Box>
  );
}

// C7: TOILET INSPECTION CHECK LIST
function C7Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const items = chk.check_items || [];

  return (
    <Box>
      <Box sx={{ textAlign: 'center', border: '2px solid #000', p: 1.5, mb: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>BVC EXPORTS PVT LTD</Typography>
        <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>TOILET INSPECTION CHECK LIST</Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: '0.88rem', px: 2 }}>
          <div><strong>DOC Ref :</strong> BVC-QA-F-05</div>
          <div><strong>Month :</strong> {isBlank ? '' : (chk.month || 'Current Month')}</div>
          <div><strong>Toilet :</strong> {isBlank ? '' : (record.area_location || chk.toilet_name || 'Block A')}</div>
        </Box>
      </Box>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', fontSize: '0.78rem' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '5%' }}>Sl.No</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '35%', textAlign: 'left' }}>Check for</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i} style={{ border: '1px solid #000', padding: '1px', fontSize: '0.62rem' }}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((it, idx) => (
            <tr key={idx} style={{ fontSize: '0.75rem' }}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{it.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 600 }}>{it.item}</td>
              {Array.from({ length: 31 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '1px', textAlign: 'center', fontWeight: 700 }}>
                  {isBlank ? '' : '✓'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Done By: House Keeper</strong> {isBlank ? '' : (record.inspector_name || 'House Keeper')}
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '50%' }}>
              <strong>Checked by : HR MANAGER</strong> {isBlank ? '' : (record.supervisor_name || 'HR MANAGER')}
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, textAlign: 'center', fontWeight: 700 }}>
        ✓- Yes &nbsp;&nbsp;&nbsp;&nbsp; X- No
      </Box>
    </Box>
  );
}

// C8: VEHICLE LOADING/UNLOADING INSPECTION REPORT
function C8Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const points = chk.check_points || [];

  return (
    <Box>
      <Box sx={{ textAlign: 'center', border: '2px solid #000', p: 1.5, mb: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>
          VEHICLE LOADING/UN LOADING INSPECTION REPORT
        </Typography>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, fontSize: '0.88rem' }}>
          <div><strong>DOC Ref :</strong> BVC/QA/F/07</div>
          <div><strong>Date :</strong> {isBlank ? '' : record.record_date}</div>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1, fontSize: '0.88rem' }}>
          <div><strong>Customer / Qty :</strong> {isBlank ? '' : (chk.customer_qty || 'Royal Foods Exporters / 500 Bags')}</div>
          <div><strong>Vehicle No :</strong> {isBlank ? '' : (record.area_location || chk.vehicle_no || 'TN-58-AX-9912')}</div>
        </Box>
      </Box>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>Sl.No</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '45%', textAlign: 'left' }}>Check for</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '10%', textAlign: 'center' }}>OK</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '10%', textAlign: 'center' }}>Not OK</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '27%', textAlign: 'left' }}>REMARKS / Vehicle No</th>
          </tr>
        </thead>
        <tbody>
          {points.map((pt, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{pt.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600 }}>{pt.item}</td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>
                {isBlank ? '' : (pt.ok ? '✓' : '')}
              </td>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>
                {isBlank ? '' : (pt.not_ok ? 'X' : '')}
              </td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>{isBlank ? '' : (pt.remarks || '')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px 12px', width: '50%' }}>
              <strong>Checked by :</strong> {isBlank ? '' : (record.inspector_name || 'Security')}
              <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 4 }}>(Security)</div>
            </td>
            <td style={{ border: '2px solid #000', padding: '14px 12px', width: '50%' }}>
              <strong>Verified by :</strong> {isBlank ? '' : (record.supervisor_name || 'Dispatch Clerk')}
              <div style={{ fontSize: '0.85rem', color: '#555', marginTop: 4 }}>(clerk)</div>
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// C9: FOOD HANDLERS PERSONAL HYGIENE LOG
function C9Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const workers = chk.workers || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '70%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }}>BVC EXPORTS (PVT) LTD</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', mt: 0.5 }}>
                Food Handlers Personal Hygiene Log
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '30%', fontSize: '0.82rem' }}>
              <div><strong>Form No:</strong> BVC/QA/F/01</div>
              <div><strong>Rev.No :</strong> 0</div>
              <div><strong>Date:</strong> 29.05.2017</div>
            </td>
          </tr>
        </tbody>
      </table>

      <Box sx={{ mb: 1, fontSize: '0.9rem' }}>
        <strong>Date:</strong> {isBlank ? '' : record.record_date}
      </Box>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12, fontSize: '0.74rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>Sl. No</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>Shift</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 100 }}>Worker Name</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 80 }}>Area</th>
            <th colSpan={7} style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>✓-ok &nbsp; X- Not Ok</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 80 }}>Remarks</th>
            <th rowSpan={2} style={{ border: '1px solid #000', padding: '4px', textAlign: 'left', minWidth: 80 }}>Corrective Action</th>
          </tr>
          <tr style={{ background: '#f8fafc', fontSize: '0.68rem' }}>
            <th style={{ border: '1px solid #000', padding: '2px' }}>Wearing PPEs</th>
            <th style={{ border: '1px solid #000', padding: '2px' }}>Nail Trimming</th>
            <th style={{ border: '1px solid #000', padding: '2px' }}>Free from Visible wounds</th>
            <th style={{ border: '1px solid #000', padding: '2px' }}>No illness / nose</th>
            <th style={{ border: '1px solid #000', padding: '2px' }}>No exposed jewels</th>
            <th style={{ border: '1px solid #000', padding: '2px' }}>No chemicals/ointment</th>
            <th style={{ border: '1px solid #000', padding: '2px' }}>No Smoking /chewing</th>
          </tr>
        </thead>
        <tbody>
          {(isBlank ? Array.from({ length: 11 }, (_, i) => ({ s_no: i + 1, shift: `${i + 1}. D`, worker_name: '', area: '' })) : workers).map((w, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{w.s_no || idx + 1}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center' }}>{w.shift || `${idx + 1}. D`}</td>
              <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 600 }}>{w.worker_name}</td>
              <td style={{ border: '1px solid #000', padding: '4px' }}>{w.area}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : (w.wearing_ppes || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : (w.nail_trimming || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : (w.free_wounds || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : (w.no_illness || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : (w.no_jewels || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : (w.no_chemicals || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : (w.no_smoking || '✓')}</td>
              <td style={{ border: '1px solid #000', padding: '4px' }}>{isBlank ? '' : (w.remarks || '')}</td>
              <td style={{ border: '1px solid #000', padding: '4px' }}>{isBlank ? '' : (w.corrective_action || '')}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '50%' }}>
              <strong>CheckedBy: QMR</strong> {isBlank ? '' : (record.inspector_name || 'QMR')}
            </td>
            <td style={{ border: '2px solid #000', padding: '12px', width: '50%' }}>
              <strong>Approved By: Managing Director</strong> {isBlank ? '' : (record.supervisor_name || 'Managing Director')}
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// C10: PRIMARY PACKING MATERIAL INSPECTION RECORD
function C10Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const params = chk.parameters || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PRIVATE LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                PRIMARY PACKING<br />MATERIAL INSPECTION<br />RECORD
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>PPMI:</strong> {isBlank ? '' : (chk.ppmi_no || 'PPMI-01')}</div>
              <div><strong>DATE:</strong> {isBlank ? '' : record.record_date}</div>
              <div><strong>SUPPLIER:</strong> {isBlank ? '' : (chk.supplier || 'Sri Krishna Packaging')}</div>
              <div><strong>INVOICE NO:</strong> {isBlank ? '' : (chk.invoice_no || 'INV-2026-01')}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Date:</strong> {isBlank ? '' : record.record_date}
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Time :</strong> {isBlank ? '' : (chk.time || '10:30 AM')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '2px solid #000', padding: '8px', width: '8%', textAlign: 'center' }}>S.NO</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '25%', textAlign: 'left' }}>PARAMETERS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '32%', textAlign: 'left' }}>STD WITH TOLORANCE</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '20%', textAlign: 'left' }}>OBSERVATIONS</th>
            <th style={{ border: '2px solid #000', padding: '8px', width: '15%', textAlign: 'left' }}>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '8px', textAlign: 'center', fontWeight: 700 }}>{p.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '8px', fontWeight: 600 }}>{p.parameter}</td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>{isBlank ? '' : p.std_tolerance}</td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>{isBlank ? '' : p.observations}</td>
              <td style={{ border: '2px solid #000', padding: '8px' }}>{isBlank ? '' : p.action_taken}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '50%' }}>
              <strong>Prepared By</strong> {isBlank ? '' : (record.inspector_name || 'QC Inspector')}
            </td>
            <td style={{ border: '2px solid #000', padding: '12px', width: '50%' }}>
              <strong>Approved By</strong> {isBlank ? '' : (record.supervisor_name || 'QA Head')}
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// C11: GLASS AND PLASTIC CONTROL CHECKLIST
function C11Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const params = chk.parameters || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PRIVATE LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                GLASS AND PLASTIC<br />CONTROL CHECKLIST
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>BVC/QA/F/03</strong></div>
              <div><strong>Rev.No./Date :</strong> 00/29.05.2017</div>
              <div><strong>Page no :</strong> 1 of 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Date /shift :</strong> {isBlank ? '' : `${record.record_date} / ${chk.shift || 'Day Shift'}`}
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Time :</strong> {isBlank ? '' : (chk.time || '09:00 AM')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '6%', textAlign: 'center' }}>Sl.no</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '42%', textAlign: 'left' }}>PARAMETERS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '10%', textAlign: 'center' }}>Checklist</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '12%', textAlign: 'center' }}>Conditons</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '15%', textAlign: 'left' }}>OBSERVATIONS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '15%', textAlign: 'left' }}>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{p.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontSize: '0.85rem' }}>{p.parameter}</td>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : p.checklist}</td>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : p.condition}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : p.observations}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : p.action_taken}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, mb: 1.5, fontSize: '0.8rem' }}>
        <strong>Conditions :</strong> IR - immediate repair required &nbsp;|&nbsp; NI : Check at next inspection &nbsp;|&nbsp; O.K- no problem noted
      </Box>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '10px 12px', width: '50%' }}>
              <strong>PREPARED BY</strong> {isBlank ? '' : (record.inspector_name || 'QA Officer')}
            </td>
            <td style={{ border: '2px solid #000', padding: '10px 12px', width: '50%' }}>
              <strong>APPROVED BY</strong> {isBlank ? '' : (record.supervisor_name || 'QA Manager')}
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// C12: PLASTIC PALLET CONTROL CHECKLIST
function C12Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const params = chk.parameters || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '14px', width: '38%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PRIVATE LIMITED</Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px', width: '37%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                PLASTIC PALLET CONTROL<br />CHECKLIST
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '25%', fontSize: '0.82rem' }}>
              <div><strong>BVC/QA/F/04</strong></div>
              <div><strong>Rev.No./Date :</strong> 00/29.05.2017</div>
              <div><strong>Page no :</strong> 1 of 1</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Date /shift :</strong> {isBlank ? '' : `${record.record_date} / ${chk.shift || 'Day Shift'}`}
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '50%' }}>
              <strong>Time :</strong> {isBlank ? '' : (chk.time || '09:30 AM')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '6%', textAlign: 'center' }}>Sl.no</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '46%', textAlign: 'left' }}>PARAMETERS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '14%', textAlign: 'center' }}>STD WITH TOLERANCE</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '17%', textAlign: 'left' }}>OBSERVATIONS</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '17%', textAlign: 'left' }}>ACTION TAKEN</th>
          </tr>
        </thead>
        <tbody>
          {params.map((p, idx) => (
            <tr key={idx}>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{p.s_no || idx + 1}</td>
              <td style={{ border: '2px solid #000', padding: '6px', fontSize: '0.85rem' }}>{p.parameter}</td>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center', fontWeight: 700 }}>{isBlank ? '' : p.std_tolerance}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : p.observations}</td>
              <td style={{ border: '2px solid #000', padding: '6px' }}>{isBlank ? '' : p.action_taken}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Box sx={{ border: '1px solid #000', p: 1, mb: 1.5, fontSize: '0.8rem' }}>
        <strong>Conditions:</strong> IR - immediate repair required &nbsp;|&nbsp; NI: Check at next inspection &nbsp;|&nbsp; O.K-no problem noted
      </Box>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '10px 12px', width: '50%' }}>
              <strong>PREPARED BY</strong> {isBlank ? '' : (record.inspector_name || 'QA Officer')}
            </td>
            <td style={{ border: '2px solid #000', padding: '10px 12px', width: '50%' }}>
              <strong>APPROVED BY</strong> {isBlank ? '' : (record.supervisor_name || 'QA Manager')}
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}

// C13: ROUTINE RODENT BAIT MONITORING RECORD
function C13Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const internal = chk.internal_stations || [];
  const outside = chk.outside_stations || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '70%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.1rem' }}>BVC EXPORTS PVT LIMITED</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>
                Routine Rodent bait Monitoring Record - Internal & Outside
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 10px', width: '30%', fontSize: '0.82rem' }}>
              <div><strong>Rec No :</strong> BVC/QA/F/10</div>
              <div><strong>Rev No:</strong> 01</div>
              <div><strong>Rev.Date:</strong> 01.01.2023</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>Month-</strong> {isBlank ? '' : (chk.month || 'Current Month')}
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>Prepared By:</strong> Vasu
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '34%' }}>
              <strong>Approved By (FSTL):</strong> Mr. Sasikumar
            </td>
          </tr>
        </tbody>
      </table>

      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', bgcolor: '#e2e8f0', p: 0.8, border: '1px solid #000' }}>
        Routine Rodent bait Monitoring Record-Internal (Rodent Trap station internal of the factory premises)
      </Typography>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 8, fontSize: '0.72rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '1px solid #000', padding: '4px', width: '15%' }}>Date/Trap Station</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i} style={{ border: '1px solid #000', padding: '1px' }}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {['RTS-1', 'RTS-2', 'RTS-3', 'RTS-4', 'RTS-5', 'RTS-6', 'RTS-7', 'RTS-8'].map((st, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 700 }}>{st}</td>
              {Array.from({ length: 31 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '1px', textAlign: 'center' }}>
                  {isBlank ? '' : '✓'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Box sx={{ border: '1px solid #000', p: 1, mb: 2, fontSize: '0.85rem' }}>
        <strong>CAPA :</strong> {isBlank ? '' : (chk.internal_capa || 'All internal snap traps inspected daily. Zero rodent intrusion observed.')}
      </Box>

      <Typography sx={{ fontWeight: 700, fontSize: '0.9rem', bgcolor: '#e2e8f0', p: 0.8, border: '1px solid #000' }}>
        Routine Rodent bait Monitoring Record-Outside
      </Typography>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 8, fontSize: '0.72rem' }}>
        <thead>
          <tr style={{ background: '#f8fafc' }}>
            <th style={{ border: '1px solid #000', padding: '4px', width: '15%' }}>Date/Bait Station</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i} style={{ border: '1px solid #000', padding: '1px' }}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {['RBS-1', 'RBS-2'].map((st, idx) => (
            <tr key={idx}>
              <td style={{ border: '1px solid #000', padding: '4px', fontWeight: 700 }}>{st}</td>
              {Array.from({ length: 31 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '1px', textAlign: 'center' }}>
                  {isBlank ? '' : '✓'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <Box sx={{ border: '1px solid #000', p: 1, mb: 2, fontSize: '0.85rem' }}>
        <strong>CAPA :</strong> {isBlank ? '' : (chk.outside_capa || 'Perimeter bait stations secure, locked and dry.')}
      </Box>

      <Box sx={{ border: '1px solid #000', p: 1, display: 'flex', justifyContent: 'space-between' }}>
        <div><strong>Verified By :</strong> Vasu (Pest Officer)</div>
        <div><strong>QA Manager :</strong> Mr. Sasikumar</div>
      </Box>
    </Box>
  );
}

// C14: ROUTINE / PREVENTIVE MAINTENANCE CHECKLIST
function C14Paper({ record, isBlank }) {
  const chk = record.checklist || {};
  const criteria = chk.criteria || [];

  return (
    <Box>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '12px', width: '60%', textAlign: 'center' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>BVC EXPORTS PRIVATE LIMITED</Typography>
              <Typography sx={{ fontWeight: 800, fontSize: '1rem', mt: 0.5 }}>
                ROUTINE/PREVENTIVE MAINTENANCE CHECKLIST
              </Typography>
            </td>
            <td style={{ border: '2px solid #000', padding: '8px 12px', width: '40%', fontSize: '0.82rem' }}>
              <div><strong>FORMAL NUMBER :</strong> BVC/MNTF/03</div>
              <div><strong>REV.NO/DATE :</strong> {isBlank ? '' : record.record_date}</div>
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>M/C NO :</strong> {isBlank ? '' : (chk.machine_no || 'MCH-MIL-01')}
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '33%' }}>
              <strong>M/C NAME :</strong> {isBlank ? '' : (record.area_location || chk.machine_name || 'Pulse Hammer Mill #01')}
            </td>
            <td style={{ border: '2px solid #000', padding: '6px 12px', width: '34%' }}>
              <strong>OPERATOR NAME :</strong> {isBlank ? '' : (record.inspector_name || chk.operator_name || 'Murugan K')}
            </td>
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000', marginBottom: 12 }}>
        <thead>
          <tr style={{ background: '#f8fafc', fontSize: '0.74rem' }}>
            <th style={{ border: '2px solid #000', padding: '6px', width: '22%', textAlign: 'left' }}>Criteria</th>
            <th style={{ border: '2px solid #000', padding: '6px', width: '10%', textAlign: 'center' }}>Frequency</th>
            {Array.from({ length: 31 }, (_, i) => (
              <th key={i} style={{ border: '1px solid #000', padding: '1px', fontSize: '0.62rem' }}>{i + 1}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {criteria.map((c, idx) => (
            <tr key={idx} style={{ fontSize: '0.74rem' }}>
              <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 600 }}>{c.criteria}</td>
              <td style={{ border: '2px solid #000', padding: '6px', textAlign: 'center' }}>{c.frequency}</td>
              {Array.from({ length: 31 }, (_, i) => (
                <td key={i} style={{ border: '1px solid #000', padding: '1px', textAlign: 'center', fontWeight: 700 }}>
                  {isBlank ? '' : '✓'}
                </td>
              ))}
            </tr>
          ))}
          <tr style={{ fontSize: '0.74rem' }}>
            <td style={{ border: '2px solid #000', padding: '6px', fontWeight: 700 }}>Checked by - Operator</td>
            <td style={{ border: '2px solid #000', padding: '6px' }}></td>
            {Array.from({ length: 31 }, (_, i) => (
              <td key={i} style={{ border: '1px solid #000', padding: '1px', textAlign: 'center', fontSize: '0.6rem' }}>
                {isBlank ? '' : 'OP'}
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table style={{ width: '100%', borderCollapse: 'collapse', border: '2px solid #000' }}>
        <tbody>
          <tr>
            <td style={{ border: '2px solid #000', padding: '10px 12px' }}>
              <strong>Approved by: Plant Incharge</strong> {isBlank ? '' : (record.supervisor_name || 'Plant Incharge')}
            </td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}
