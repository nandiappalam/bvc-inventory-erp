import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api.js';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, IconButton, CircularProgress, Alert } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PrintIcon from '@mui/icons-material/Print';
import BusinessIcon from '@mui/icons-material/Business';
import AddIcon from '@mui/icons-material/Add';
import LoginIcon from '@mui/icons-material/Login';
import { printHtml } from '../utils/printHelper';

const themeColors = { primary: '#1f4fb2', secondary: '#2a5ea0', lightBlue: '#dbe7fb', white: '#ffffff', textPrimary: '#333333' };

const CompanySelection = () => {
  const navigate = useNavigate();
  const { selectCompany } = useAuth();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { fetchCompanies(); }, []);

  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const result = await api('companies');
      setCompanies(Array.isArray(result) ? result : []);
      if (!result || result.length === 0) {
        console.log('No companies found, redirecting to create company...');
        navigate('/company-create');
        return;
      }
    } catch (error) { 
      console.error('Error fetching companies:', error);
      setError('Error connecting to server');
    } finally { 
      setLoading(false); 
    }
  };

  const handleSelectCompany = (company) => { selectCompany(company); navigate('/auth-choice'); };
  const handleUpdate = (company) => { navigate(`/company-alter/${company.id}`); };
  const handleDelete = async (company) => {
    if (window.confirm(`Are you sure you want to delete "${company.name}"?`)) {
      try { 
        await api(`companies/${company.id}`, { method: 'DELETE' });
        fetchCompanies(); 
      }
      catch (error) { console.error('Error deleting company:', error); alert('Failed to delete company'); }
    }
  };
  const handlePrint = (company) => {
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; color: #0f172a;">
        <div style="border-bottom: 2px solid #1f4fb2; padding-bottom: 10px; margin-bottom: 15px;">
          <h2 style="color: #1f4fb2; margin: 0;">${company.name}</h2>
          <p style="margin: 4px 0 0; color: #64748b; font-size: 13px;">Company Master Record</p>
        </div>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <tr><td style="padding: 8px 0; font-weight: bold; width: 140px; border-bottom: 1px solid #e2e8f0;">Company Code:</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company.code || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Address:</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company.address || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e2e8f0;">GST Number:</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company.gst_number || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e2e8f0;">State / Code:</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company.state || 'Tamil Nadu'} (${company.state_code || '33'})</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Contact Number:</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company.contact || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Email:</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company.email || 'N/A'}</td></tr>
          <tr><td style="padding: 8px 0; font-weight: bold; border-bottom: 1px solid #e2e8f0;">Status:</td><td style="padding: 8px 0; border-bottom: 1px solid #e2e8f0;">${company.status || 'Active'}</td></tr>
        </table>
      </div>
    `;
    printHtml(html, `Company Details - ${company.name}`);
  };

  if (loading) { return (<Box sx={{display:'flex',justifyContent:'center',alignItems:'center',minHeight:'100vh',background:`linear-gradient(135deg,${themeColors.primary}0%,${themeColors.secondary}100%)`}}><CircularProgress sx={{color:themeColors.white}}/></Box>); }

  return (
    <Box sx={{minHeight:'100vh',display:'flex',justifyContent:'center',alignItems:'center',background:`linear-gradient(135deg,${themeColors.primary}0%,${themeColors.secondary}100%)`,padding:2}}>
      <Card sx={{maxWidth:900,width:'100%',boxShadow:'0 8px 40px rgba(0,0,0,0.2)',borderRadius:2}}>
        <CardContent sx={{p:4}}>
          <Box sx={{display:'flex',justifyContent:'space-between',alignItems:'center',mb:4}}>
            <Box sx={{display:'flex',alignItems:'center',gap:2}}>
              <BusinessIcon sx={{fontSize:40,color:themeColors.primary}}/>
              <Box><Typography variant="h4" sx={{fontWeight:'bold',color:themeColors.primary}}>Company Details</Typography><Typography variant="body1" color="textSecondary">View, update, delete or print company information</Typography></Box>
            </Box>
            <Button variant="contained" startIcon={<AddIcon/>} onClick={()=>navigate('/company-create')} sx={{backgroundColor:themeColors.primary,'&:hover':{backgroundColor:themeColors.secondary}}}>Add Company</Button>
          </Box>
          {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
          {companies.length===0 ? (<Box sx={{textAlign:'center',py:4}}><Typography variant="body1" color="textSecondary" sx={{mb:2}}>No companies found. Please create a company first.</Typography><Button variant="contained" onClick={()=>navigate('/company-create')} sx={{backgroundColor:themeColors.primary,'&:hover':{backgroundColor:themeColors.secondary}}}>Create Company</Button></Box>) : (
            <TableContainer component={Paper} sx={{boxShadow:'none',border:`1px solid ${themeColors.lightBlue}`}}>
              <Table>
                <TableHead sx={{backgroundColor:themeColors.lightBlue}}>
                  <TableRow>
                    <TableCell sx={{fontWeight:'bold',color:themeColors.primary}}>Company Name</TableCell>
                    <TableCell sx={{fontWeight:'bold',color:themeColors.primary}}>Address</TableCell>
                    <TableCell sx={{fontWeight:'bold',color:themeColors.primary}}>GST Number</TableCell>
                    <TableCell sx={{fontWeight:'bold',color:themeColors.primary}}>Contact</TableCell>
                    <TableCell sx={{fontWeight:'bold',color:themeColors.primary}}>Email</TableCell>
                    <TableCell sx={{fontWeight:'bold',color:themeColors.primary,textAlign:'center'}}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {companies.map((company)=>(
                    <TableRow key={company.id} hover>
                      <TableCell sx={{fontWeight:'bold',color:themeColors.primary}}>{company.name}</TableCell>
                      <TableCell>{company.address||'N/A'}</TableCell>
                      <TableCell>{company.gst_number||'N/A'}</TableCell>
                      <TableCell>{company.contact||'N/A'}</TableCell>
                      <TableCell>{company.email||'N/A'}</TableCell>
                      <TableCell>
                        <Box sx={{display:'flex',justifyContent:'center',gap:1}}>
                          <IconButton size="small" onClick={()=>handleSelectCompany(company)} sx={{color:themeColors.primary,'&:hover':{backgroundColor:themeColors.lightBlue}}} title="Open"><LoginIcon fontSize="small"/></IconButton>
                          <IconButton size="small" onClick={()=>handleUpdate(company)} sx={{color:themeColors.primary,'&:hover':{backgroundColor:themeColors.lightBlue}}} title="Update"><EditIcon fontSize="small"/></IconButton>
                          <IconButton size="small" onClick={()=>handleDelete(company)} sx={{color:'#d32f2f','&:hover':{backgroundColor:'#ffebee'}}} title="Delete"><DeleteIcon fontSize="small"/></IconButton>
                          <IconButton size="small" onClick={()=>handlePrint(company)} sx={{color:'#388e3c','&:hover':{backgroundColor:'#e8f5e9'}}} title="Print"><PrintIcon fontSize="small"/></IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default CompanySelection;
