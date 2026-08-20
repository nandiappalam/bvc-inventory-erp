import React, { useState, useEffect } from 'react'
import {
  Typography,
  Container,
  Paper,
  Box,
  Button,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Grid,
  Alert,
} from '@mui/material'
import axios from 'axios'

const CrudPage = ({ module, action }) => {
  const [formData, setFormData] = useState({})
  const [tableData, setTableData] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)

  // Master module mapping
  const masterModules = {
    'Item': 'item_master',
    'Item Group': 'item_groups',
    'Deduction Sales': 'deduction_sales',
    'Deduction Purchase': 'deduction_purchase',
    'Customer': 'customer_master',
    'Suppliers': 'supplier_master',
    'Flour Mill': 'flour_mill_master',
    'Papad Company': 'papad_company_master',
    'Weight': 'weightmaster',
    'Ledger Group': 'ledgergroupmaster',
    'Ledger': 'ledgermaster',
    'Area': 'area_master',
    'City': 'city_master',
    'Consignee': 'consignee_group_master',
    'P.Trans': 'ptrans_master',
    'Sender': 'sender_group_master',
    'Transport': 'transport_master'
  }

  const isMasterModule = masterModules[module]
  const tableName = masterModules[module]

  // Load data for display actions
  useEffect(() => {
    if (action === 'Display' || action === 'Update/Edit' || action === 'Delete') {
      if (isMasterModule) {
        loadMasterData()
      } else {
        loadEntryData()
      }
    }
  }, [module, action])

  const loadMasterData = async () => {
    setLoading(true)
    try {
      const response = await axios.get(`/api/masters/${tableName}`)
      setTableData(response.data)
      setError('')
    } catch (err) {
      setError('Failed to load data')
      console.error('Error loading master data:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadEntryData = async () => {
    setLoading(true)
    try {
      // Map module names to API endpoints for display
      const moduleEndpoints = {
        'Purchase': 'purchases',
        'Purchase Return': 'purchase-returns',
        'Grind': 'grains',
        'Flour Out': 'flour-out',
        'Flour Out Return': 'flour-out-returns',
        'Sales': 'sales'
      }

      const endpoint = moduleEndpoints[module]
      if (!endpoint) {
        setError('Backend endpoint not implemented for this module')
        return
      }

      const response = await axios.get(`/api/${endpoint}`)
      setTableData(response.data)
      setError('')
    } catch (err) {
      setError('Failed to load data')
      console.error('Error loading entry data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Map module names to API endpoints
    const moduleEndpoints = {
      'Purchase': 'purchases',
      'Purchase Return': 'purchase-returns',
      'Grind': 'grains',
      'Flour Out': 'flour-out',
      'Flour Out Return': 'flour-out-returns',
      'Sales': 'sales'
    }

    const endpoint = moduleEndpoints[module]
    if (!endpoint) {
      alert('Backend endpoint not implemented for this module')
      return
    }

    const payload = {
      formData,
      items: tableData,
      totals: {
        totalQty: tableData.reduce((sum, item) => sum + item.qty, 0),
        totalWeight: tableData.reduce((sum, item) => sum + (item.weight * item.qty), 0),
        totalWages: tableData.reduce((sum, item) => sum + (item.qty * item.wagesBag), 0),
        totalAmount: tableData.reduce((sum, item) => sum + (item.qty * item.rate || 0), 0)
      }
    }

    console.log('Submitting:', payload)

    try {
      const response = await fetch(`/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (response.ok) {
        const result = await response.json()
        alert(`${module} saved successfully!`)
        console.log('Success:', result)
        // Reset form
        setFormData({})
        setTableData([{
          id: 1,
          itemName: '',
          weight: 0,
          qty: 0,
          totalWt: 0,
          papadKg: 0,
          cost: 0,
          wagesBag: 0,
          wages: 0
        }])
      } else {
        const error = await response.json()
        alert(`Error: ${error.message}`)
        console.error('Error:', error)
      }
    } catch (error) {
      alert('Network error occurred')
      console.error('Network error:', error)
    }
  }

  const handleDelete = (item) => {
    setSelectedItem(item)
    setDeleteDialogOpen(true)
  }

  const confirmDelete = async () => {
    try {
      if (isMasterModule) {
        // Delete from master table
        await axios.delete(`/api/masters/${tableName}/${selectedItem.id}`)
      } else {
        // Delete from entry table
        const moduleEndpoints = {
          'Purchase': 'purchases',
          'Purchase Return': 'purchase-returns',
          'Grind': 'grains',
          'Flour Out': 'flour-out',
          'Flour Out Return': 'flour-out-returns',
          'Sales': 'sales'
        }

        const endpoint = moduleEndpoints[module]
        if (endpoint) {
          await axios.delete(`/api/${endpoint}/${selectedItem.id}`)
        }
      }

      // Remove from local state
      setTableData(tableData.filter(item => item.id !== selectedItem.id))
      alert('Record deleted successfully!')
    } catch (error) {
      console.error('Error deleting record:', error)
      alert('Failed to delete record')
    } finally {
      setDeleteDialogOpen(false)
      setSelectedItem(null)
    }
  }

  const addRow = () => {
    const newRow = {
      id: tableData.length + 1,
      itemName: '',
      weight: 0,
      qty: 0,
      totalWt: 0,
      papadKg: 0,
      cost: 0,
      wagesBag: 0,
      wages: 0
    }
    setTableData([...tableData, newRow])
  }

  const deleteRow = (id) => {
    setTableData(tableData.filter(item => item.id !== id))
  }

  const renderEntryForm = () => (
    <Box>
      {/* Top Section */}
      <Paper sx={{ p: 2, mb: 2, backgroundColor: '#ede9ff' }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="S.No"
              name="sno"
              value={formData.sno || '1'}
              onChange={handleInputChange}
              InputProps={{ readOnly: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Date"
              name="date"
              type="datetime-local"
              value={formData.date || new Date().toISOString().slice(0, 16)}
              onChange={handleInputChange}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Tax Type"
              name="taxType"
              value={formData.taxType || ''}
              onChange={handleInputChange}
              placeholder="Cash / Credit"
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Remarks"
              name="remarks"
              value={formData.remarks || ''}
              onChange={handleInputChange}
              placeholder="Enter remarks"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <TableContainer component={Paper} sx={{ mb: 2 }}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#dcd6ff' }}>
              <TableCell>No</TableCell>
              <TableCell>Item Name</TableCell>
              <TableCell>Weight</TableCell>
              <TableCell>Qty</TableCell>
              <TableCell>Total Wt</TableCell>
              <TableCell>Papad Kg</TableCell>
              <TableCell>Cost</TableCell>
              <TableCell>Wages/Bag</TableCell>
              <TableCell>Wages</TableCell>
              <TableCell>Delete</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tableData.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.id}</TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    value={row.itemName}
                    onChange={(e) => {
                      const updated = tableData.map(item =>
                        item.id === row.id ? { ...item, itemName: e.target.value } : item
                      )
                      setTableData(updated)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    type="number"
                    value={row.weight}
                    onChange={(e) => {
                      const updated = tableData.map(item =>
                        item.id === row.id ? { ...item, weight: parseFloat(e.target.value) || 0 } : item
                      )
                      setTableData(updated)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    type="number"
                    value={row.qty}
                    onChange={(e) => {
                      const updated = tableData.map(item =>
                        item.id === row.id ? { ...item, qty: parseInt(e.target.value) || 0 } : item
                      )
                      setTableData(updated)
                    }}
                  />
                </TableCell>
                <TableCell>{(row.weight * row.qty).toFixed(2)}</TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    type="number"
                    value={row.papadKg}
                    onChange={(e) => {
                      const updated = tableData.map(item =>
                        item.id === row.id ? { ...item, papadKg: parseFloat(e.target.value) || 0 } : item
                      )
                      setTableData(updated)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    type="number"
                    value={row.cost}
                    onChange={(e) => {
                      const updated = tableData.map(item =>
                        item.id === row.id ? { ...item, cost: parseFloat(e.target.value) || 0 } : item
                      )
                      setTableData(updated)
                    }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    fullWidth
                    type="number"
                    value={row.wagesBag}
                    onChange={(e) => {
                      const updated = tableData.map(item =>
                        item.id === row.id ? { ...item, wagesBag: parseFloat(e.target.value) || 0 } : item
                      )
                      setTableData(updated)
                    }}
                  />
                </TableCell>
                <TableCell>{(row.qty * row.wagesBag).toFixed(2)}</TableCell>
                <TableCell>
                  <Button
                    variant="contained"
                    color="error"
                    size="small"
                    onClick={() => deleteRow(row.id)}
                  >
                    X
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Button variant="contained" onClick={addRow} sx={{ mb: 2 }}>
        + Add Row
      </Button>

      {/* Bottom Totals */}
      <Paper sx={{ p: 2, backgroundColor: '#f1ecff' }}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }}>
          <Typography variant="h6">
            Total Qty: {tableData.reduce((sum, item) => sum + item.qty, 0)}
          </Typography>
          <Typography variant="h6">
            Total Weight: {tableData.reduce((sum, item) => sum + (item.weight * item.qty), 0).toFixed(2)}
          </Typography>
          <Typography variant="h6">
            Total Wages: {tableData.reduce((sum, item) => sum + (item.qty * item.wagesBag), 0).toFixed(2)}
          </Typography>
        </Box>
      </Paper>

      <Button variant="contained" onClick={handleSubmit} sx={{ mt: 2 }}>
        Save
      </Button>
    </Box>
  )

  const renderDisplayTable = () => {
    if (isMasterModule) {
      // Master module display
      const columns = Object.keys(tableData[0] || {}).filter(key => key !== 'id')

      return (
        <Box>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          {loading ? (
            <Typography>Loading...</Typography>
          ) : (
            <TableContainer component={Paper} sx={{ height: 400, overflow: 'auto', backgroundColor: '#eef6ff' }}>
              <Table stickyHeader>
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#d6e6ff' }}>
                    <TableCell>S.No</TableCell>
                    {columns.map(col => (
                      <TableCell key={col}>{col.replace(/_/g, ' ').toUpperCase()}</TableCell>
                    ))}
                    {action === 'Delete' && <TableCell>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {tableData.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell>{index + 1}</TableCell>
                      {columns.map(col => (
                        <TableCell key={col}>{row[col] || ''}</TableCell>
                      ))}
                      {action === 'Delete' && (
                        <TableCell>
                          <Button
                            variant="contained"
                            color="error"
                            size="small"
                            onClick={() => handleDelete(row)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>
      )
    } else {
      // Display for entry modules (purchases, grains, flour-out, etc.)
      // Determine columns based on module type
      const getColumnsForModule = (module) => {
        switch (module) {
          case 'Purchase':
            return ['s_no', 'date', 'supplier', 'total_qty', 'total_weight', 'total_amount']
          case 'Purchase Return':
            return ['s_no', 'date', 'supplier', 'total_qty', 'total_weight', 'total_amount']
          case 'Grind':
            return ['s_no', 'date', 'flour_mill', 'remarks']
          case 'Flour Out':
            return ['s_no', 'date', 'papad_company', 'total_qty', 'total_weight', 'total_wages']
          case 'Flour Out Return':
            return ['s_no', 'date', 'tax_type', 'total_qty', 'total_weight', 'total_wages']
          case 'Sales':
            return ['s_no', 'date', 'customer', 'total_qty', 'total_wt', 'total_amt']
          default:
            return ['id', 'date', 'remarks']
        }
      }

      const columns = getColumnsForModule(module)

      return (
        <Box>
          {/* Filter Bar */}
          <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f5f9ff' }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item>
                <Typography variant="body1" sx={{ fontWeight: 'bold' }}>Date:</Typography>
              </Grid>
              <Grid item>
                <TextField type="date" size="small" />
              </Grid>
              <Grid item>
                <Typography variant="body1">To</Typography>
              </Grid>
              <Grid item>
                <TextField type="date" size="small" />
              </Grid>
            </Grid>
          </Paper>

          {/* Table */}
          <TableContainer component={Paper} sx={{ height: 400, overflow: 'auto', backgroundColor: '#eef6ff' }}>
            <Table stickyHeader>
              <TableHead>
                <TableRow sx={{ backgroundColor: '#d6e6ff' }}>
                  <TableCell>S.No</TableCell>
                  {columns.map(col => (
                    <TableCell key={col}>
                      {col.replace(/_/g, ' ').toUpperCase()}
                    </TableCell>
                  ))}
                  {action === 'Delete' && <TableCell>Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {tableData.map((row, index) => (
                  <TableRow key={row.id || index}>
                    <TableCell>{index + 1}</TableCell>
                    {columns.map(col => (
                      <TableCell key={col}>
                        {col === 'date' ? new Date(row[col]).toLocaleDateString() : (row[col] || '')}
                      </TableCell>
                    ))}
                    {action === 'Delete' && (
                      <TableCell>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => handleDelete(row)}
                        >
                          Delete
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Bottom Buttons */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2, p: 1, backgroundColor: '#dbe9f6' }}>
            <Box>
              <Button variant="outlined" sx={{ mr: 1 }}>Print</Button>
              <Button variant="outlined">Cancel</Button>
            </Box>
            <Box>
              <Button variant="outlined">Options</Button>
            </Box>
          </Box>
        </Box>
      )
    }
  }

  const renderContent = () => {
    if (action === 'Entry' || action === 'Create') {
      return renderEntryForm()
    } else if (action === 'Display') {
      return renderDisplayTable()
    } else if (action === 'Update/Edit') {
      return (
        <>
          {renderDisplayTable()}
          {renderEntryForm()}
        </>
      )
    } else if (action === 'Delete') {
      return renderDisplayTable()
    } else if (action === 'Print') {
      return renderDisplayTable()
    } else {
      return <Typography>Unknown action</Typography>
    }
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2 }}>
      <Paper elevation={3} sx={{ p: 2, backgroundColor: '#f3f0ff' }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{
            textAlign: 'center',
            backgroundColor: '#d9d2ff',
            p: 1,
            borderRadius: 1,
            mb: 2
          }}
        >
          {module.toUpperCase()} - {action.toUpperCase()}
        </Typography>
        {renderContent()}
      </Paper>
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this item?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDelete} color="error">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  )
}

export default CrudPage
