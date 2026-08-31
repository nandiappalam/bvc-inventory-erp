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
        navigate('/general-company-create');
        return;
      }
    } catch (error) { 
      console.error('Error fetching companies:', error);
      setError('Error connecting to server');
      navigate('/general-company-create');
    } finally { 
      setLoading(false); 
    }
  };

  const handleSelectCompany = (company) => { selectCompany(company); navigate('/auth-choice'); };
  const handleUpdate = (company) => { navigate(`/general-company-create/${company.id}`); };
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
    const printWindow = window.open('', '_blank', 'width=600,height=400');
    printWindow.document.write(`<html><head><title>Company Details - ${company.name}</title><style>body{font-family:Arial,sans-serif;padding:20px}h1{color:#1f4fb2}table{width:100%;border-collapse:collapse}td{padding:8px;border-bottom:1px solid #ddd}.label{font-weight:bold;width:120px}</style></head><body><h1>${company.name}</h1><table><tr><td class="label">Address:</td><td>${company.address||'N/A'}</td></tr><tr><td class="label">GST Number:</td><td>${company.gst_number||'N/A'}</td></tr><tr><td class="label">Contact:</td><td>${company.contact||'N/A'}</td></tr><tr><td class="label">Email:</td><td>${company.email||'N/A'}</td></tr></table><script>window.print();</script></body></html>`);
    printWindow.document.close();
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
            <Button variant="contained" startIcon={<AddIcon/>} onClick={()=>navigate('/general-company-create')} sx={{backgroundColor:themeColors.primary,'&:hover':{backgroundColor:themeColors.secondary}}}>Add Company</Button>
          </Box>
          {error && <Alert severity="error" sx={{mb:2}}>{error}</Alert>}
          {companies.length===0 ? (<Box sx={{textAlign:'center',py:4}}><Typography variant="body1" color="textSecondary" sx={{mb:2}}>No companies found. Please create a company first.</Typography><Button variant="contained" onClick={()=>navigate('/general-company-create')} sx={{backgroundColor:themeColors.primary,'&:hover':{backgroundColor:themeColors.secondary}}}>Create Company</Button></Box>) : (
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
