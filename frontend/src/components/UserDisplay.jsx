import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  CircularProgress,
  Alert,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';

const themeColors = {
  primary: '#1f4fb2',
  secondary: '#2a5ea0',
  lightBlue: '#dbe7fb',
  lighterBlue: '#eaf2fb',
  white: '#ffffff',
  textPrimary: '#333333',
};

const UserDisplay = () => {
  const navigate = useNavigate();
  const { isAdmin, permissions, selectedCompany, hasPermission } = useAuth();
  
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteConfirmUser, setDeleteConfirmUser] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const canManageUsers = isAdmin || hasPermission('User', 'Display', 'can_view') || hasPermission('User', 'Display', 'can_edit') || hasPermission('User', 'Display', 'can_delete');
  const canEditUsers = isAdmin || hasPermission('User', 'Display', 'can_edit') || hasPermission('User', 'can_edit');
  const canDeleteUsers = isAdmin || hasPermission('User', 'Display', 'can_delete') || hasPermission('User', 'can_delete');

  useEffect(() => {
    if (selectedCompany?.id) {
      fetchUsers();
    }
  }, [selectedCompany]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api(`/auth/users/${selectedCompany.id}`);
      if (Array.isArray(data)) {
        setUsers(data);
      } else if (data?.success === false) {
        throw new Error(data.message || 'Failed to fetch users');
      } else {
        setUsers(data?.data || []);
      }
    } catch (error) {
      setError(error.message || 'Error connecting to server');
      console.error('Error fetching users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (userId) => {
    navigate(`/master/user-update/${userId}`);
  };

  const handleDelete = async (userId) => {
    setDeleting(true);
    try {
      const result = await api(`/auth/users/${userId}`, { method: 'DELETE' });
      if (result && result.success !== false) {
        setUsers(users.filter(u => u.id !== userId));
        setError('User deleted successfully');
      } else {
        throw new Error(result?.message || 'Failed to delete user');
      }
    } catch (error) {
      setError(error.message || 'Error connecting to server');
      console.error('Error deleting user:', error);
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate('/')}
            sx={{ mr: 2, color: themeColors.textPrimary }}
          >
            Back
          </Button>
          <Typography variant="h5" sx={{ fontWeight: 'bold', color: themeColors.primary }}>
            User Management
          </Typography>
        </Box>
        
        {canManageUsers && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => navigate('/master/user-create')}
            sx={{
              backgroundColor: themeColors.primary,
              '&:hover': { backgroundColor: themeColors.secondary }
            }}
          >
            Create User
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity={error.includes('successfully') ? 'success' : 'error'} sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ backgroundColor: themeColors.lightBlue }}>
                  <TableCell sx={{ fontWeight: 'bold' }}>Username</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Company</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 'bold' }}>Created At</TableCell>
                  {canManageUsers && <TableCell sx={{ fontWeight: 'bold' }} align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canManageUsers ? 6 : 5} align="center" sx={{ py: 4 }}>
                      <Typography variant="body1" color="textSecondary">
                        No users found. {canManageUsers && 'Create a user to get started.'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user, index) => (
                    <TableRow key={user.id || `user-${index}`} hover>
                      <TableCell>{user.username || user.user_name || '-'}</TableCell>
                      <TableCell>{user.company_name || selectedCompany?.name || '-'}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role || 'User'}
                          color={user.role === 'Admin' ? 'primary' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={user.status || 'Active'}
                          color={user.status === 'Active' ? 'success' : 'error'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                      </TableCell>
                      {canManageUsers && (
                        <TableCell align="center">
                          {canEditUsers && (
                            <IconButton
                              onClick={() => handleEdit(user.id)}
                              sx={{ color: themeColors.primary, mr: 1 }}
                            >
                              <EditIcon />
                            </IconButton>
                          )}
                          {canDeleteUsers && (
                            <IconButton
                              onClick={() => setDeleteConfirmUser(user)}
                              disabled={deleting}
                              sx={{ color: '#f44336' }}
                            >
                              <DeleteIcon />
                            </IconButton>
                          )}
                          {!canEditUsers && !canDeleteUsers && '-'}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Material UI Delete Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteConfirmUser)}
        onClose={() => setDeleteConfirmUser(null)}
        aria-labelledby="delete-user-dialog-title"
        aria-describedby="delete-user-dialog-description"
      >
        <DialogTitle id="delete-user-dialog-title" sx={{ fontWeight: 'bold', color: '#f44336' }}>
          Confirm User Deletion
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="delete-user-dialog-description">
            Are you sure you want to delete user <strong>{deleteConfirmUser?.username}</strong>? This action is permanent and cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteConfirmUser(null)} variant="outlined" color="inherit">
            Cancel
          </Button>
          <Button 
            onClick={async () => {
              const u = deleteConfirmUser;
              setDeleteConfirmUser(null);
              await handleDelete(u.id);
            }} 
            variant="contained" 
            color="error" 
            autoFocus
          >
            Yes, Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default UserDisplay;
