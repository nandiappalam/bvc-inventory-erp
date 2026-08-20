import React, { useMemo, useState, useEffect } from 'react';
import { Box, Button, TextField, Typography, TableRow, TableCell } from '@mui/material';
import { useNavigate, useParams } from 'react-router-dom';
import purchaseOrderService from '../services/purchaseOrderService';
import {
  ERPActionBar,
  ERPHeader,
  ERPInformationCard,
  ERPPageLayout,
  ERPSummaryCard,
  ERPBreadcrumb,
  ERPRemarksCard,
  ERPTable,
  ERPStatusChip,
} from '../../../components/erp';

const PurchaseOrderView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    purchaseOrderService.get(id)
      .then((data) => {
        setForm(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading purchase order:', err);
        setLoading(false);
      });
  }, [id]);

  const breadcrumbItems = useMemo(
    () => [
      { label: 'Purchase' },
      { label: 'Purchase Order' },
      { label: 'View', isCurrent: true },
    ],
    []
  );

  const columns = useMemo(
    () => [
      { key: 'i', label: '#', sx: { width: 40 } },
      { key: 'item', label: 'Searchable Item', sx: { width: '30%' } },
      { key: 'uom', label: 'UOM' },
      { key: 'qty', label: 'Quantity' },
      { key: 'rate', label: 'Rate' },
      { key: 'disc', label: 'Discount %', sx: { width: '5%' } },
      { key: 'tax', label: 'Tax %' },
      { key: 'autoAmt', label: 'Auto Amount', sx: { textAlign: 'right' } },
    ],
    []
  );

  if (loading) {
    return <Typography sx={{ p: 3 }}>Loading purchase order...</Typography>;
  }

  if (!form) {
    return <Typography sx={{ p: 3 }}>Purchase order not found.</Typography>;
  }

  const rows = form?.items ?? [];
  const summary = {
    grossAmount: rows.reduce((sum, r) => sum + (Number(r.qty || 0) * Number(r.rate || 0)), 0),
    discount: rows.reduce((sum, r) => sum + (Number(r.qty || 0) * Number(r.rate || 0) * (Number(r.discountPercent || 0) / 100)), 0),
    taxableAmount: rows.reduce((sum, r) => {
      const gross = Number(r.qty || 0) * Number(r.rate || 0);
      return sum + (gross - (gross * (Number(r.discountPercent || 0) / 100)));
    }, 0),
    gst: rows.reduce((sum, r) => {
      const gross = Number(r.qty || 0) * Number(r.rate || 0);
      const taxable = gross - (gross * (Number(r.discountPercent || 0) / 100));
      return sum + (taxable * (Number(r.taxPercent || 0) / 100));
    }, 0),
    freight: Number(form.freight || 0),
    otherCharges: Number(form.otherCharges || 0),
    get roundOff() {
      const subtotal = this.taxableAmount + this.gst + this.freight + this.otherCharges;
      return Math.round(subtotal) - subtotal;
    },
    get grandTotal() {
      const subtotal = this.taxableAmount + this.gst + this.freight + this.otherCharges;
      return subtotal + this.roundOff;
    }
  };

  return (
    <ERPPageLayout
      breadcrumb={<ERPBreadcrumb items={breadcrumbItems} />}
      header={<ERPHeader title="Purchase Order" status={<ERPStatusChip status={form.status} />} />}
      childrenBottom={
        <ERPActionBar>
          <Button variant="outlined" onClick={() => navigate('/entry/purchase-order-list')}>
            Back
          </Button>
          <Button variant="contained" color="primary" onClick={() => navigate(`/entry/purchase-order-create?id=${id}`)}>
            Edit
          </Button>
          <Button variant="outlined" color="primary">Print</Button>
          <Button variant="outlined" color="primary">Download PDF</Button>
        </ERPActionBar>
      }
    >
      <Box>
        <ERPInformationCard sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, color: 'primary.dark', fontWeight: 'bold' }}>
            TRANSACTION INFORMATION
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' }, gap: 2 }}>
            <TextField label="PO Number" value={form.orderNo ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="PO Date" value={form.date ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Supplier" value={form.supplier ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Buyer" value={form.buyer ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Warehouse" value={form.warehouse ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Purchase Type" value={form.purchaseType ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Payment Terms" value={form.paymentTerms ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Expected Delivery" value={form.expectedDelivery ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Priority" value={form.priority ?? ''} size="small" InputProps={{ readOnly: true }} />
            <TextField label="Status" value={form.status ?? ''} size="small" InputProps={{ readOnly: true }} />
          </Box>
        </ERPInformationCard>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '70fr 30fr' }, gap: 2, mt: 2 }}>
          <Box>
            <Typography variant="h6" sx={{ mb: 1, color: 'primary.dark', fontWeight: 'bold' }}>
              ITEMS
            </Typography>
            <ERPTable
              columns={columns}
              rows={rows}
              renderRow={(r, idx) => (
                <TableRow key={idx}>
                  <TableCell>{idx + 1}</TableCell>
                  <TableCell>{r.itemName}</TableCell>
                  <TableCell>{r.uom}</TableCell>
                  <TableCell>{r.qty}</TableCell>
                  <TableCell>{r.rate}</TableCell>
                  <TableCell>{r.discountPercent}</TableCell>
                  <TableCell>{r.taxPercent}</TableCell>
                  <TableCell align="right">{Number(r.amount ?? 0).toFixed(2)}</TableCell>
                </TableRow>
              )}
            />
          </Box>

          <Box sx={{ position: 'sticky', top: '20px', alignSelf: 'start' }}>
            <ERPSummaryCard title="Summary">
              <Box sx={{ display: 'grid', gap: 0.75, fontSize: 13 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Gross Amount</span>
                  <b>{Number(summary.grossAmount ?? 0).toFixed(2)}</b>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Discount</span>
                  <b>{Number(summary.discount ?? 0).toFixed(2)}</b>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Taxable Amount</span>
                  <b>{Number(summary.taxableAmount ?? 0).toFixed(2)}</b>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>GST</span>
                  <b>{Number(summary.gst ?? 0).toFixed(2)}</b>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Freight</span>
                  <b>{Number(summary.freight ?? 0).toFixed(2)}</b>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Other Charges</span>
                  <b>{Number(summary.otherCharges ?? 0).toFixed(2)}</b>
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Round Off</span>
                  <b>{Number(summary.roundOff ?? 0).toFixed(2)}</b>
                </Box>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    mt: 1,
                    pt: 1,
                    borderTop: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    Grand Total
                  </Typography>
                  <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                    {Number(summary.grandTotal ?? 0).toFixed(2)}
                  </Typography>
                </Box>
              </Box>
            </ERPSummaryCard>
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <ERPRemarksCard title="Remarks">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
              <TextField
                label="Internal Remarks"
                value={form.internalRemarks ?? ''}
                multiline
                minRows={3}
                fullWidth
                variant="outlined"
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Supplier Notes"
                value={form.supplierNotes ?? ''}
                multiline
                minRows={3}
                fullWidth
                variant="outlined"
                InputProps={{ readOnly: true }}
              />
            </Box>
          </ERPRemarksCard>
        </Box>
      </Box>
    </ERPPageLayout>
  );
};

export default PurchaseOrderView;

