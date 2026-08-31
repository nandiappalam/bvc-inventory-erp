import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Divider,
  Chip,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PrintIcon from '@mui/icons-material/Print';
import EditIcon from '@mui/icons-material/Edit';
import VerifiedIcon from '@mui/icons-material/Verified';

export default function DocumentViewerModal({ open, document: doc, onClose, onEdit }) {
  if (!doc) return null;

  const handlePrint = () => {
    window.print();
  };

  const details = doc.details || {};

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle component="div" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip label={doc.doc_code} color="primary" sx={{ fontWeight: 'bold' }} />
          <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#1e293b' }}>
            {doc.doc_number}: {doc.title}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={handlePrint}
            sx={{ fontWeight: 'bold' }}
          >
            Print / Export PDF
          </Button>
          {onEdit && (
            <Button
              size="small"
              variant="contained"
              startIcon={<EditIcon />}
              onClick={onEdit}
            >
              Edit
            </Button>
          )}
          <IconButton size="small" onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, md: 4 }, backgroundColor: '#ffffff' }}>
        {/* Formal Controlled Document Header */}
        <Box sx={{ border: '2px solid #0f172a', p: 2, mb: 3 }}>
          <Grid container alignItems="center" spacing={2}>
            <Grid item xs={12} sm={3} sx={{ textAlign: 'center', borderRight: { sm: '2px solid #0f172a' } }}>
              <Typography variant="h6" sx={{ fontWeight: '900', color: '#1f4fb2', letterSpacing: '1px' }}>
                BVC FOODS
              </Typography>
              <Typography variant="caption" sx={{ fontWeight: 'bold', display: 'block', color: 'text.secondary' }}>
                FOOD SAFETY MANAGEMENT SYSTEM
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '10px' }}>
                FSSAI / ISO 22000 COMPLIANT
              </Typography>
            </Grid>

            <Grid item xs={12} sm={6} sx={{ textAlign: 'center', borderRight: { sm: '2px solid #0f172a' } }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase' }}>
                {doc.title}
              </Typography>
              <Typography variant="body2" sx={{ color: '#0284c7', fontWeight: 'bold' }}>
                CONTROLLED QUALITY DOCUMENT
              </Typography>
              {doc.item_name && (
                <Chip size="small" label={`Product: ${doc.item_name}`} color="primary" variant="outlined" sx={{ mt: 0.5 }} />
              )}
            </Grid>

            <Grid item xs={12} sm={3}>
              <Box sx={{ fontSize: '12px', lineHeight: 1.6 }}>
                <div><strong>Doc No:</strong> {doc.doc_number}</div>
                <div><strong>Version:</strong> v{doc.version || '1.0'}</div>
                <div><strong>Effective:</strong> {doc.effective_date || '—'}</div>
                <div><strong>Status:</strong> <span style={{ color: '#10b981', fontWeight: 'bold' }}>{doc.status}</span></div>
              </Box>
            </Grid>
          </Grid>
        </Box>

        {/* Document Metadata Grid */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>DEPARTMENT</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{doc.department || 'All Departments'}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>PROCESS / MODULE</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{doc.process_stage || 'Manufacturing'}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>REVIEW CYCLE</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{doc.review_date || 'Annual'}</Typography>
          </Grid>
          <Grid item xs={6} sm={3}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>CLASSIFICATION</Typography>
            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>Controlled Document ({doc.doc_code})</Typography>
          </Grid>
        </Grid>

        <Divider sx={{ my: 2 }} />

        {/* Detailed Document Content according to Type */}
        {/* D1: Work Instruction */}
        {doc.doc_code === 'D1' && details.steps && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1 }}>
              OPERATIONAL PROCEDURES & CONTROLS
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold', width: 60 }}>Step</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Standard Operational Procedure</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Critical Quality & Safety Control</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.steps.map((step, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{step.step_no || idx + 1}</TableCell>
                      <TableCell>{step.action}</TableCell>
                      <TableCell sx={{ color: '#0284c7', fontWeight: 'bold' }}>{step.control}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* D2: Hazard Plan */}
        {doc.doc_code === 'D2' && details.hazards && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1 }}>
              HACCP / CCP / OPRP / VACCP HAZARD ANALYSIS & CRITICAL CONTROL LIMITS
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Process Step</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Hazard Type & Description</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Critical Limits</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Monitoring Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Corrective Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.hazards.map((h, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{h.process_step}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{h.hazard_type}</Typography>
                        <Typography variant="caption" color="text.secondary">{h.hazard_desc}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={h.control_category} color={h.control_category.includes('CCP') ? 'error' : 'warning'} sx={{ fontWeight: 'bold' }} />
                      </TableCell>
                      <TableCell sx={{ color: '#b91c1c', fontWeight: 'bold' }}>{h.critical_limit}</TableCell>
                      <TableCell>{h.monitoring_freq}</TableCell>
                      <TableCell>{h.corrective_action || 'Quarantine & Recalibrate'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* D3: MTR Specification */}
        {doc.doc_code === 'D3' && details.parameters && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1 }}>
              TECHNICAL SPECIFICATION & ACCEPTANCE PARAMETERS
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Quality Parameter</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Category</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Standard Requirement Limit</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Official Test Method</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.parameters.map((p, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{p.parameter}</TableCell>
                      <TableCell>{p.category || 'Physical'}</TableCell>
                      <TableCell sx={{ color: '#15803d', fontWeight: 'bold' }}>{p.standard_limit}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{p.test_method || 'IS 4333'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* D4: Training Record */}
        {doc.doc_code === 'D4' && details.attendees && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1 }}>
              ATTENDANCE & EVALUATION RECORD
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead sx={{ backgroundColor: '#f8fafc' }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 'bold' }}>Employee Name</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Emp ID</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Designation</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Score</TableCell>
                    <TableCell sx={{ fontWeight: 'bold' }}>Evaluation Result</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {details.attendees.map((att, idx) => (
                    <TableRow key={idx}>
                      <TableCell sx={{ fontWeight: 'bold' }}>{att.employee_name}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{att.emp_id}</TableCell>
                      <TableCell>{att.designation}</TableCell>
                      <TableCell sx={{ fontWeight: 'bold' }}>{att.evaluation_score}</TableCell>
                      <TableCell>
                        <Chip size="small" label={att.status || 'Passed'} color="success" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* D6: RCCA Record */}
        {doc.doc_code === 'D6' && details.five_why_analysis && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1 }}>
              5-WHY ROOT CAUSE ANALYSIS & CORRECTIVE/PREVENTIVE ACTION
            </Typography>
            <Box sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0', mb: 2 }}>
              {details.five_why_analysis.map((why, idx) => (
                <Typography key={idx} variant="body2" sx={{ mb: 0.5, fontWeight: idx === details.five_why_analysis.length - 1 ? 'bold' : 'normal', color: idx === details.five_why_analysis.length - 1 ? '#b91c1c' : '#334155' }}>
                  {why}
                </Typography>
              ))}
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderLeft: '4px solid #f59e0b' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#d97706' }}>IMMEDIATE CORRECTION</Typography>
                  <Typography variant="body2">{details.immediate_correction || 'Line quarantined and verified'}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Paper sx={{ p: 1.5, borderLeft: '4px solid #10b981' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#059669' }}>CORRECTIVE & PREVENTIVE ACTION (CAPA)</Typography>
                  <Typography variant="body2">{details.corrective_action || 'Preventive calibration schedule instituted'}</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        )}

        {/* D11: Process Flow Chart */}
        {doc.doc_code === 'D11' && details.stages && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 1.5 }}>
              MANUFACTURING PROCESS FLOW GATES & CONTROLS
            </Typography>
            <Grid container spacing={1.5}>
              {details.stages.map((stage, idx) => (
                <Grid item xs={12} sm={6} md={3} key={idx}>
                  <Card sx={{ height: '100%', border: '1px solid #cbd5e1', borderTop: `4px solid ${stage.ccp_type.includes('CCP') ? '#ef4444' : '#1f4fb2'}` }}>
                    <CardContent sx={{ p: 1.5 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                        <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary' }}>
                          STAGE {stage.stage_no || idx + 1}
                        </Typography>
                        <Chip size="small" label={stage.ccp_type} color={stage.ccp_type.includes('CCP') ? 'error' : 'primary'} />
                      </Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                        {stage.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        <strong>Controls:</strong> {stage.parameters}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Box>
        )}

        {/* Remarks / Scope */}
        {doc.remarks && (
          <Box sx={{ p: 2, backgroundColor: '#f8fafc', borderRadius: 1, border: '1px solid #e2e8f0', mb: 3 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>SCOPE & COMPLIANCE NOTES</Typography>
            <Typography variant="body2" sx={{ color: '#334155' }}>{doc.remarks}</Typography>
          </Box>
        )}

        {/* Formal Sign-off Approvals Section */}
        <Box sx={{ border: '1px solid #0f172a', mt: 4 }}>
          <Table size="small">
            <TableHead sx={{ backgroundColor: '#f1f5f9' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '33%' }}>PREPARED BY</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '33%' }}>REVIEWED / VERIFIED BY</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '34%' }}>APPROVED BY</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              <TableRow sx={{ height: 80 }}>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{doc.prepared_by || 'QA Executive'}</Typography>
                  <Typography variant="caption" color="text.secondary">Designation: Quality Assurance</Typography>
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: '#15803d' }}>
                    <VerifiedIcon sx={{ fontSize: 16 }} />
                    <Typography variant="caption">Digitally Signed on {doc.effective_date || '2026-08-16'}</Typography>
                  </Box>
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{doc.verified_by || 'Plant Operations Head'}</Typography>
                  <Typography variant="caption" color="text.secondary">Designation: Technical Manager</Typography>
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#1f4fb2' }}>{doc.approved_by || 'Managing Director'}</Typography>
                  <Typography variant="caption" color="text.secondary">Designation: Managing Director</Typography>
                  <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 0.5, color: '#15803d' }}>
                    <VerifiedIcon sx={{ fontSize: 16 }} />
                    <Typography variant="caption">Authorized & Released</Typography>
                  </Box>
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 2, backgroundColor: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
        <Button onClick={onClose} variant="outlined" color="inherit">
          Close
        </Button>
        <Button onClick={handlePrint} variant="contained" color="primary" startIcon={<PrintIcon />}>
          Print Official Document
        </Button>
      </DialogActions>
    </Dialog>
  );
}
