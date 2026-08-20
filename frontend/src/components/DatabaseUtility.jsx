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
      a.download = `bvc_erp_backup_${new Date().toISOString().slice(0, 10)}.db`;
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

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.db')) {
      setStatus({ type: 'error', message: 'Please select a valid SQLite database file (.db).' });
      return;
    }

    const confirmRestore = window.confirm(
      'WARNING: Restoring a database backup will overwrite all current data. Are you sure you want to proceed?'
    );
    if (!confirmRestore) return;

    setUploading(true);
    setStatus({ type: '', message: '' });

    const formData = new FormData();
    formData.append('database', file);

    try {
      const response = await fetch('/api/db/restore', {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get('content-type') || '';

      let data = {};
      if (contentType.includes('application/json')) {
        data = await response.json();
      } else {
        const responseText = await response.text();
        console.error('Non-JSON response received:', response.status, responseText);
        throw new Error(`Server returned status ${response.status}. Please ensure the backend server is running.`);
      }

      if (response.ok && data.success) {
        setStatus({
          type: 'success',
          message: 'Database backup restored successfully! Reloading page in 3 seconds to apply changes...',
        });
        setTimeout(() => {
          window.location.reload();
        }, 3000);
      } else {
        throw new Error(data.message || data.error || 'Restoration failed');
      }
    } catch (error) {
      console.error('Restore error:', error);
      setStatus({ type: 'error', message: `Failed to restore database: ${error.message}` });
    } finally {
      setUploading(false);
      // Reset file input
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
          Ephemeral Environment Warning
        </Typography>
        This application runs in an ephemeral sandbox environment. Every time the application updates or the dev server restarts, the local database file is reset back to its default state. 
        <br />
        <br />
        <strong>Please use this utility to export your database before completing tasks with the AI agent, and restore it afterward to avoid losing your work!</strong>
      </Alert>

      {status.message && (
        <Alert severity={status.type === 'error' ? 'error' : 'success'} sx={{ mb: 3, borderRadius: 2 }}>
          {status.message}
        </Alert>
      )}

      <Card sx={{ border: '1px solid #dbe7fb', borderRadius: 3, boxShadow: '0 4px 12px rgba(0,0,0,0.05)', mb: 3 }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1, color: '#333' }}>
            Export Database Backup
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Download the entire local SQLite database (including all your created companies, purchase logs, items, etc.) as a single file to your computer.
          </Typography>

          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleDownload}
            disabled={downloading || uploading}
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
            Import / Restore Database Backup
          </Typography>
          <Typography variant="body2" sx={{ color: '#666', mb: 3 }}>
            Overwrite the current database by uploading a previously downloaded <code>.db</code> backup file. This will restore all your previous records.
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Button
              variant="outlined"
              color="primary"
              size="large"
              component="label"
              disabled={downloading || uploading}
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
              {uploading ? 'Restoring Database...' : 'Select & Upload Backup (.db)'}
              <input type="file" accept=".db" hidden onChange={handleUpload} />
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
};

export default DatabaseUtility;
