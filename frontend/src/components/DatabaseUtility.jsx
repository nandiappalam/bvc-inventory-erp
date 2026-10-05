import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  IconButton,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const DatabaseUtility = () => {
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [status, setStatus] = useState({ type: '', message: '' });

  const [initializingKiya, setInitializingKiya] = useState(false);

  const handleInitKiya = async () => {
    const confirm = window.confirm(
      'Are you sure you want to restore and initialize all data for KIYA (Company 7)? This will populate all suppliers, items, purchases, vouchers, and stock.'
    );
    if (!confirm) return;

    setInitializingKiya(true);
    setStatus({ type: '', message: '' });

    const headers = { 'Content-Type': 'application/json' };
    try {
      const token = localStorage.getItem('erp_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      headers['X-Company-Id'] = '7';
    } catch (_) {}

    try {
      const response = await fetch('/api/db/init-kiya', {
        method: 'POST',
        headers,
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStatus({
          type: 'success',
          message: 'KIYA (Company 7) data restored successfully! Reloading page in 2 seconds...',
        });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.message || 'Failed to initialize KIYA data');
      }
    } catch (err) {
      console.error('Init KIYA error:', err);
      setStatus({ type: 'error', message: err.message });
    } finally {
      setInitializingKiya(false);
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    setStatus({ type: '', message: '' });
    try {
      // Trigger native download
      const response = await fetch('/api/db/backup');
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok || contentType.includes('text/html')) {
        let errText = `Server returned status ${response.status}`;
        try {
          const text = await response.text();
          if (text && !text.includes('<!DOCTYPE')) {
            errText = text;
          }
        } catch (e) {}
        throw new Error(errText);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = response.headers.get('content-disposition') || '';
      let filename = '';
      const filenameMatch = disposition.match(/filename="?([^";]+)"?/);
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].trim();
      } else {
        const ext = contentType.includes('json') ? 'json' : 'db';
        filename = `bvc_erp_backup_${new Date().toISOString().slice(0, 10)}.${ext}`;
      }
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      setStatus({ type: 'success', message: 'Database backup downloaded successfully!' });
    } catch (error) {
      console.error('Download error:', error);
      setStatus({ type: 'error', message: `Failed to download backup: ${error.message}` });
    } finally {
      setDownloading(false);
    }
  };

  const [jsonText, setJsonText] = useState('');
  const [showJsonPaste, setShowJsonPaste] = useState(false);
  const [restoringJson, setRestoringJson] = useState(false);

  const handleJsonPasteRestore = async () => {
    if (!jsonText.trim()) {
      setStatus({ type: 'error', message: 'Please paste valid JSON backup content.' });
      return;
    }

    let parsedData = null;
    try {
      parsedData = JSON.parse(jsonText.trim());
    } catch (e) {
      setStatus({ type: 'error', message: 'Invalid JSON format: ' + e.message });
      return;
    }

    const confirmRestore = window.confirm(
      'WARNING: Restoring will overwrite existing records with this JSON data. Are you sure you want to proceed?'
    );
    if (!confirmRestore) return;

    setRestoringJson(true);
    setStatus({ type: '', message: '' });

    const headers = { 'Content-Type': 'application/json' };
    try {
      const token = localStorage.getItem('erp_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const selComp = localStorage.getItem('erp_selected_company') || localStorage.getItem('erp_company');
      if (selComp) {
        try {
          const parsed = JSON.parse(selComp);
          if (parsed?.id) headers['X-Company-Id'] = String(parsed.id);
        } catch (_) {
          headers['X-Company-Id'] = String(selComp);
        }
      }
    } catch (_) {}

    try {
      const response = await fetch('/api/db/restore-json', {
        method: 'POST',
        headers,
        body: JSON.stringify({ jsonData: parsedData }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setStatus({
          type: 'success',
          message: 'Database restored successfully from JSON! Reloading page in 2 seconds...',
        });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.message || data.error || 'JSON restoration failed');
      }
    } catch (err) {
      console.error('JSON restore error:', err);
      setStatus({ type: 'error', message: `Failed to restore database: ${err.message}` });
    } finally {
      setRestoringJson(false);
    }
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.db') && !lowerName.endsWith('.json') && !lowerName.endsWith('.sql') && !lowerName.endsWith('.sqlite') && !lowerName.endsWith('.sqlite3')) {
      setStatus({ type: 'error', message: 'Please select a valid database backup file (.db, .sql, or .json).' });
      return;
    }

    const confirmRestore = window.confirm(
      'WARNING: Restoring a database backup will overwrite current data with the backup records. Are you sure you want to proceed?'
    );
    if (!confirmRestore) return;

    setUploading(true);
    setStatus({ type: '', message: '' });

    const headers = {};
    try {
      const token = localStorage.getItem('erp_token');
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const selComp = localStorage.getItem('erp_selected_company') || localStorage.getItem('erp_company');
      if (selComp) {
        try {
          const parsed = JSON.parse(selComp);
          if (parsed?.id) headers['X-Company-Id'] = String(parsed.id);
        } catch (_) {
          headers['X-Company-Id'] = String(selComp);
        }
      }
    } catch (_) {}

    try {
      // If it's a JSON file, read it client-side and use pure JSON API (bypasses multer/disk storage entirely)
      if (lowerName.endsWith('.json')) {
        const fileContent = await file.text();
        const parsedJson = JSON.parse(fileContent);
        headers['Content-Type'] = 'application/json';
        const response = await fetch('/api/db/restore-json', {
          method: 'POST',
          headers,
          body: JSON.stringify({ jsonData: parsedJson }),
        });
        const data = await response.json();
        if (response.ok && data.success) {
          setStatus({
            type: 'success',
            message: 'Database backup restored successfully! Reloading page in 2 seconds to apply changes...',
          });
          setTimeout(() => {
            window.location.reload();
          }, 2000);
          return;
        } else {
          throw new Error(data.message || data.error || 'Restoration failed');
        }
      }

      // For binary DB / SQL files, use standard multipart upload
      const formData = new FormData();
      formData.append('database', file);

      const response = await fetch('/api/db/restore', {
        method: 'POST',
        headers,
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';
      let data = {};
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const responseText = await response.text();
        throw new Error(`Server returned status ${response.status}: ${responseText.slice(0, 100)}`);
      }

      if (response.ok && data.success) {
        setStatus({
          type: 'success',
          message: 'Database backup restored successfully! Reloading page in 2 seconds to apply changes...',
        });
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error(data.message || data.error || 'Restoration failed');
      }
    } catch (error) {
      console.error('Restore error:', error);
      setStatus({ type: 'error', message: `Failed to restore database: ${error.message}` });
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  return (
    <Box sx={{ maxWidth: 650, mx: 'auto', mt: 4, p: 2 }}>
      <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: '#1f4fb2', mb: 3 }}>
        Database Maintenance & Backups
      </Typography>

      <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
          Ephemeral Environment 
        </Typography>
        <br />
        <br />
        <strong></strong>
      </Alert>

      {status.message && (
        <Alert severity={status.type === 'error' ? 'error' : 'success'} sx={{ mb: 3, borderRadius: 2 }}>
          {status.message}
        </Alert>
      )}

      <Card sx={{ border: '2px solid #2e7d32', borderRadius: 3, boxShadow: '0 4px 16px rgba(46,125,50,0.12)', mb: 3, backgroundColor: '#f1f8e9' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#1b5e20', display: 'flex', alignItems: 'center', gap: 1 }}>
            ⚡ 1-Click Restore KIYA Company (Company 7)
          </Typography>
          <Typography variant="body2" sx={{ color: '#2e7d32', mb: 3 }}>
            Directly populate and restore all KIYA company data (Suppliers, Items, Purchases, Vouchers, Stock Lots, and Ledger) with a single click. No file upload or SQL copy-paste needed!
          </Typography>

          <Button
            variant="contained"
            color="success"
            size="large"
            onClick={handleInitKiya}
            disabled={initializingKiya || downloading || uploading}
            startIcon={initializingKiya ? <CircularProgress size={20} color="inherit" /> : <CheckCircleIcon />}
            sx={{
              backgroundColor: '#2e7d32',
              textTransform: 'none',
              borderRadius: 2,
              fontWeight: 'bold',
              px: 4,
              py: 1.5,
              '&:hover': { backgroundColor: '#1b5e20' },
            }}
          >
            {initializingKiya ? 'Restoring KIYA Company Data...' : 'Restore KIYA Company (Company 7) Now'}
          </Button>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid #dbe7fb', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
            Export Database Backup
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Download your database backup as a JSON file or SQLite database to your computer.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleDownload}
            disabled={downloading || uploading || initializingKiya}
            startIcon={downloading ? <CircularProgress size={20} color="inherit" /> : <CloudDownloadIcon />}
            sx={{
              backgroundColor: '#1f4fb2',
              textTransform: 'none',
              borderRadius: 2,
              px: 4,
              py: 1.5,
              '&:hover': { backgroundColor: '#163a8a' },
            }}
          >
            {downloading ? 'Generating Backup...' : 'Download Backup File'}
          </Button>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid #dbe7fb', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
            Import / Restore Database Backup (JSON, DB, SQL)
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Upload any backup file (<code>.json</code>, <code>.db</code>, or <code>.sql</code>) to restore data.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              component="label"
              disabled={downloading || uploading || initializingKiya || restoringJson}
              startIcon={uploading ? <CircularProgress size={20} /> : <CloudUploadIcon />}
              sx={{
                textTransform: 'none',
                borderColor: '#1f4fb2',
                color: '#1f4fb2',
                borderRadius: 2,
                px: 4,
                py: 1.5,
                '&:hover': { borderColor: '#163a8a', backgroundColor: '#eaf2fb' },
              }}
            >
              {uploading ? 'Restoring Database...' : 'Select & Upload Backup (.json, .db, .sql)'}
              <input type="file" accept=".db,.json,.sqlite,.sqlite3,.sql" hidden onChange={handleUpload} />
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Card sx={{ border: '1px solid #dbe7fb', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mt: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
            📋 Direct JSON Paste & Restore
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
            Optionally copy and paste the contents of your <code>kiya_company_7_backup.json</code> file below to restore directly without file upload dialogs.
          </Typography>

          <Button
            size="small"
            onClick={() => setShowJsonPaste(!showJsonPaste)}
            sx={{ mb: 2, textTransform: 'none', fontWeight: 'bold', color: '#1f4fb2' }}
          >
            {showJsonPaste ? '▲ Hide Paste Box' : '▼ Show Paste Box'}
          </Button>

          {showJsonPaste && (
            <Box sx={{ mt: 1 }}>
              <textarea
                value={jsonText}
                onChange={(e) => setJsonText(e.target.value)}
                placeholder='Paste backup JSON content here: {"companyId": 7, "tables": { ... }}'
                style={{
                  width: '100%',
                  height: '140px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '6px',
                  boxSizing: 'border-box'
                }}
              />
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleJsonPasteRestore}
                  disabled={restoringJson || !jsonText.trim()}
                  startIcon={restoringJson ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
                  sx={{
                    backgroundColor: '#1f4fb2',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    borderRadius: 2,
                    px: 3,
                    py: 1,
                    '&:hover': { backgroundColor: '#163a8a' },
                  }}
                >
                  {restoringJson ? 'Restoring from JSON...' : 'Restore Pasted JSON Now'}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default DatabaseUtility;
