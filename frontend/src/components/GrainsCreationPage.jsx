import React, { useState } from 'react'
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
  Grid,
} from '@mui/material'

const GrainsCreationPage = () => {
  const [formData, setFormData] = useState({
    sno: '1',
    flourMill: '',
    date: new Date().toISOString().slice(0, 10),
    remarks: ''
  })
  const [table1Data, setTable1Data] = useState([
    { sno: 1, itemName: '', lotNo: '', weight: 0, qty: 0, totalWt: 0, wagesKg: 0, totalWages: 0 }
  ])
  const [table2Data, setTable2Data] = useState([
    { lno: 1, itemName: '', weight: 0, qty: 0, totalWt: 0 }
  ])

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleTable1Change = (index, field, value) => {
    const updated = table1Data.map((row, i) =>
      i === index ? { ...row, [field]: parseFloat(value) || 0 } : row
    )
    setTable1Data(updated)
    recalculateTable1(updated)
  }

  const handleTable2Change = (index, field, value) => {
    const updated = table2Data.map((row, i) =>
      i === index ? { ...row, [field]: parseFloat(value) || 0 } : row
    )
    setTable2Data(updated)
    recalculateTable2(updated)
  }

  const recalculateTable1 = (data) => {
    const updated = data.map(row => {
      const totalWt = row.weight * row.qty
      const totalWages = totalWt * row.wagesKg
      return { ...row, totalWt, totalWages }
    })
    setTable1Data(updated)
  }

  const recalculateTable2 = (data) => {
    const updated = data.map(row => {
      const totalWt = row.weight * row.qty
      return { ...row, totalWt }
    })
    setTable2Data(updated)
  }

  const addRow1 = () => {
    const newRow = {
      sno: table1Data.length + 1,
      itemName: '',
      lotNo: '',
      weight: 0,
      qty: 0,
      totalWt: 0,
      wagesKg: 0,
      totalWages: 0
    }
    setTable1Data([...table1Data, newRow])
  }

  const addRow2 = () => {
    const newRow = {
      lno: table2Data.length + 1,
      itemName: '',
      weight: 0,
      qty: 0,
      totalWt: 0
    }
    setTable2Data([...table2Data, newRow])
  }

  const deleteRow1 = (index) => {
    const updated = table1Data.filter((_, i) => i !== index)
    setTable1Data(updated)
  }

  const deleteRow2 = (index) => {
    const updated = table2Data.filter((_, i) => i !== index)
    setTable2Data(updated)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    console.log('Submitting:', { formData, table1Data, table2Data })
    // TODO: Implement actual submit logic
  }

  return (
    <Container maxWidth="xl" sx={{ mt: 2 }}>
      <Paper elevation={3} sx={{ p: 2, backgroundColor: '#C1F0B1' }}>
        <Typography
          variant="h5"
          component="h1"
          sx={{
            backgroundColor: '#66B4E3',
            color: 'white',
            p: 1.5,
            fontSize: '20px',
            fontWeight: 'bold',
            borderBottom: '2px solid #666'
          }}
        >
          Grind Creation
        </Typography>

        {/* Top Section */}
        <Paper sx={{ p: 2, m: 1, backgroundColor: '#66B4E3', border: '1px solid #777' }}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="S.No"
                name="sno"
                value={formData.sno}
                onChange={handleInputChange}
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Flour Mill"
                name="flourMill"
                value={formData.flourMill}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Date"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
              />
            </Grid>
            <Grid item xs={12} sm={3}>
              <TextField
                fullWidth
                label="Remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleInputChange}
              />
            </Grid>
          </Grid>
        </Paper>

        {/* First Table */}
        <TableContainer component={Paper} sx={{ m: 1 }}>
          <Button variant="contained" onClick={addRow1} sx={{ m: 1 }}>
            + Add Row
          </Button>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#66B4E3' }}>
                <TableCell>S.No</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>Lot No</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Total Wt</TableCell>
                <TableCell>Wages / Kg</TableCell>
                <TableCell>Total Wages</TableCell>
                <TableCell>❌</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {table1Data.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.sno}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      value={row.itemName}
                      onChange={(e) => handleTable1Change(index, 'itemName', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      value={row.lotNo}
                      onChange={(e) => handleTable1Change(index, 'lotNo', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      value={row.weight}
                      onChange={(e) => handleTable1Change(index, 'weight', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      value={row.qty}
                      onChange={(e) => handleTable1Change(index, 'qty', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>{row.totalWt.toFixed(3)}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      value={row.wagesKg}
                      onChange={(e) => handleTable1Change(index, 'wagesKg', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>{row.totalWages.toFixed(2)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => deleteRow1(index)}
                    >
                      ❌
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Second Table */}
        <TableContainer component={Paper} sx={{ m: 1 }}>
          <Button variant="contained" onClick={addRow2} sx={{ m: 1 }}>
            + Add Row
          </Button>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#66B4E3' }}>
                <TableCell>L.No</TableCell>
                <TableCell>Item Name</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Qty</TableCell>
                <TableCell>Total Wt</TableCell>
                <TableCell>❌</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {table2Data.map((row, index) => (
                <TableRow key={index}>
                  <TableCell>{row.lno}</TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      value={row.itemName}
                      onChange={(e) => handleTable2Change(index, 'itemName', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      value={row.weight}
                      onChange={(e) => handleTable2Change(index, 'weight', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      fullWidth
                      type="number"
                      value={row.qty}
                      onChange={(e) => handleTable2Change(index, 'qty', e.target.value)}
                    />
                  </TableCell>
                  <TableCell>{row.totalWt.toFixed(3)}</TableCell>
                  <TableCell>
                    <Button
                      variant="outlined"
                      color="error"
                      onClick={() => deleteRow2(index)}
                    >
                      ❌
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>

        <Button variant="contained" onClick={handleSubmit} sx={{ m: 1, float: 'right' }}>
          Save
        </Button>
      </Paper>
    </Container>
  )
}

export default GrainsCreationPage
