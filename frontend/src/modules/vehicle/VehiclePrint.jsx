
import React, { useState, useEffect } from 'react';
import { getVehicleMovement, updateVehicleMovement } from './vehicleService';
import { printHtml } from '../../utils/printHelper';

// Button wrapper for consistent styling
const Button = ({ onClick, children, style = {} }) => (
  <button 
    onClick={onClick} 
    style={{ 
      padding: '8px 16px', 
      margin: '4px',
      cursor: 'pointer',
      ...style 
    }}
  >
    {children}
  </button>
);

const VehiclePrint = ({ movementId, onClose }) => {
  const [movement, setMovement] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadMovement();
  }, [movementId]);

  const loadMovement = async () => {
    try {
      const data = await getVehicleMovement(movementId);
      setMovement(data);
    } catch (err) {
      console.error('Load movement failed:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !movement) {
    return <div>Loading print...</div>;
  }

  const formatDateTime = (dt) => dt ? new Date(dt).toLocaleString() : '';

  const handlePrint = async () => {
    // Record current time as Gate Out Time and maintain RETURNED/RETURN status if rejected
    const nowStr = new Date().toISOString();
    const isRet = (
      movement.status === 'RETURNED' || 
      movement.status === 'REJECTED' || 
      (movement.operation_type && String(movement.operation_type).toUpperCase().includes('RETURN')) ||
      (movement.status_details && String(movement.status_details).toUpperCase().includes('RETURN'))
    );
    const finalStatus = isRet ? 'RETURNED' : 'OUT';
    const finalOpType = isRet ? 'RETURN' : (movement.operation_type || 'UNLOAD');

    let updatedMovement = { 
      ...movement, 
      status: finalStatus, 
      operation_type: finalOpType,
      gate_out_time: nowStr 
    };
    
    try {
      await updateVehicleMovement(movement.id, {
        status: finalStatus,
        operation_type: finalOpType,
        gate_out_time: nowStr
      });
      setMovement(updatedMovement);
    } catch (e) {
      console.error("Failed to automatically record Gate Out status and time:", e);
    }

    const isUpdatedRet = (
      updatedMovement.status === 'RETURNED' || 
      updatedMovement.status === 'REJECTED' || 
      (updatedMovement.operation_type && String(updatedMovement.operation_type).toUpperCase().includes('RETURN')) ||
      (updatedMovement.status_details && String(updatedMovement.status_details).toUpperCase().includes('RETURN'))
    );

    const html = `
      <div style="font-family: 'Courier New', Courier, monospace; padding: 10px; width: 80mm; font-size: 13px; line-height: 1.4; color: #000; margin: 0 auto;">
        <div style="text-align: center; border-bottom: 2px dashed #000; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="font-size: 18px; font-weight: bold; letter-spacing: 1px;">BVC EXPORTS PVT LTD</div>
          <div style="font-size: 14px; font-weight: bold; margin-top: 2px;">VEHICLE GATE PASS</div>
          <div>Slip No: ${updatedMovement.id}</div>
        </div>

        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Date/Time:</span>
          <span>${formatDateTime(updatedMovement.created_at || updatedMovement.createdAt)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Vehicle No:</span>
          <span style="font-size: 14px; font-weight: bold;">${updatedMovement.vehicle_no || updatedMovement.vehicleNo}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Driver Name:</span>
          <span>${updatedMovement.driver_name || updatedMovement.driverName || '-'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Transporter:</span>
          <span>${updatedMovement.transporter_name || updatedMovement.transporterName || '-'}</span>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Movement Type:</span>
          <span>${updatedMovement.movement_type || updatedMovement.movementType || '-'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Operation Type:</span>
          <span style="font-weight: bold; ${isUpdatedRet ? 'color: #dc2626;' : ''}">${updatedMovement.operation_type || updatedMovement.operationType || (isUpdatedRet ? 'RETURN' : 'UNLOAD')}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Reference:</span>
          <span>${updatedMovement.reference_type || updatedMovement.referenceType || '-'} #${updatedMovement.reference_id || updatedMovement.referenceId || '-'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Party Name:</span>
          <span>${updatedMovement.party_name || updatedMovement.partyName || '-'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Lot No:</span>
          <span style="font-weight: bold; color: #111;">${updatedMovement.lot_no || '-'}</span>
        </div>
        ${(updatedMovement.movement_type === 'OUT' || updatedMovement.status === 'OUT' || Boolean(updatedMovement.gate_out_time) || String(updatedMovement.operation_type || '').toUpperCase().includes('OUT')) ? `
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Analyzing Team:</span>
          <span>${updatedMovement.analyzing_team || '-'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Analyzing Area:</span>
          <span>${updatedMovement.analyzing_area || '-'}</span>
        </div>
        ` : ''}
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Item Name:</span>
          <span>${updatedMovement.item_name || updatedMovement.itemName || '-'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Bag Qty:</span>
          <span>${updatedMovement.qty || '0'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Bag Weight:</span>
          <span>${updatedMovement.weight || '0'} kg</span>
        </div>

        <div style="border-top: 1px dashed #000; margin: 8px 0;"></div>

        <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 14px; font-weight: bold;">
          <span style="font-weight: bold;">Gross Weight:</span>
          <span>${updatedMovement.gross_weight || updatedMovement.grossWeight || '0'} kg</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Tare Weight:</span>
          <span>${updatedMovement.tare_weight || updatedMovement.tareWeight || '0'} kg</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0; font-size: 14px; font-weight: bold;">
          <span style="font-weight: bold;">Net Weight:</span>
          <span>${updatedMovement.net_weight || updatedMovement.netWeight || '0'} kg</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Gate In Time:</span>
          <span>${formatDateTime(updatedMovement.gate_in_time || updatedMovement.gateInTime)}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Gate Out Time:</span>
          <span>${formatDateTime(updatedMovement.gate_out_time || updatedMovement.gateOutTime) || '-'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Status:</span>
          <span style="font-weight: bold; ${isUpdatedRet ? 'color: #dc2626;' : ''}">${updatedMovement.status || 'IN'}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin: 4px 0;">
          <span style="font-weight: bold;">Status Details:</span>
          <span style="font-weight: bold; ${isUpdatedRet ? 'color: #dc2626;' : ''}">${updatedMovement.status_details || (isUpdatedRet ? 'REJECTED & RETURNED' : updatedMovement.status || 'IN')}</span>
        </div>

        <div style="margin-top: 30px; display: flex; justify-content: space-between;">
          <div style="border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 4px; font-size: 11px;">Security Sign</div>
          <div style="border-top: 1px solid #000; width: 45%; text-align: center; padding-top: 4px; font-size: 11px;">Receiver Sign</div>
        </div>

        <div style="border-top: 2px dashed #000; padding-top: 8px; margin-top: 15px; font-size: 11px; text-align: center;">
          <div>Thank you for your cooperation!</div>
          <div style="margin-top: 4px;">BVC GATE OPERATIONS</div>
        </div>
      </div>
    `;
    printHtml(html, `Gate_Slip_${updatedMovement.vehicle_no || updatedMovement.vehicleNo || 'Vehicle'}`);
  };

  return (
    <div className="print-wrapper">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-container { width: 80mm !important; }
          @page { size: 80mm auto; margin: 2mm; }
        }
        .print-container { 
          width: 80mm; 
          font-family: Arial, sans-serif; 
          font-size: 12px;
          padding: 10mm;
          margin: 0 auto;
          border: 1px solid #ccc;
        }
        .header { text-align: center; font-weight: bold; margin-bottom: 5mm; }
        .row { display: flex; justify-content: space-between; margin: 1mm 0; }
        .label { font-weight: bold; min-width: 40%; }
        .value { text-align: right; flex: 1; }
        .items { margin: 3mm 0; }
        .item-row { display: flex; border-bottom: 1px solid #eee; padding: 1mm 0; }
        .sign { margin-top: 10mm; text-align: right; }
      `}</style>

      <div className="no-print" style={{ marginBottom: '10px' }}>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={handlePrint}>Print 4-inch Slip</Button>
      </div>

      <div className="print-container" style={{
        width: '80mm', 
        fontFamily: 'Arial, sans-serif', 
        fontSize: '12px',
        padding: '10mm',
        margin: '0 auto',
        border: '1px solid #ccc'
      }}>
        {/* 4-INCH THERMAL PRINT LAYOUT */}
        <div className="header">
          <div>BVC EXPORTS PVT LTD</div>
          <div>GATE SLIP</div>
          <div>Movement ID: {movement.id}</div>
        </div>

        <div className="row">
          <span className="label">Date/Time:</span>
          <span className="value">{formatDateTime(movement.created_at)}</span>
        </div>

        <div className="row">
          <span className="label">Vehicle No:</span>
          <span className="value">{movement.vehicle_no}</span>
        </div>

        <div className="row">
          <span className="label">Driver:</span>
          <span className="value">{movement.driver_name || '-'}</span>
        </div>

        <div className="row">
          <span className="label">Transporter:</span>
          <span className="value">{movement.transporter_name || '-'}</span>
        </div>

        {(() => {
          const isPreviewRet = (
            movement.status === 'RETURNED' || 
            movement.status === 'REJECTED' || 
            (movement.operation_type && String(movement.operation_type).toUpperCase().includes('RETURN')) ||
            (movement.status_details && String(movement.status_details).toUpperCase().includes('RETURN'))
          );
          const isOutPassOnly = (
            movement.movement_type === 'OUT' ||
            movement.status === 'OUT' ||
            Boolean(movement.gate_out_time) ||
            String(movement.operation_type || '').toUpperCase().includes('OUT')
          );
          return (
            <>
              <div className="row">
                <span className="label">Type:</span>
                <span className="value" style={{ fontWeight: isPreviewRet ? 'bold' : 'normal', color: isPreviewRet ? '#dc2626' : 'inherit' }}>
                  {movement.movement_type} / {movement.operation_type || (isPreviewRet ? 'RETURN' : 'UNLOAD')}
                </span>
              </div>

              <div className="row">
                <span className="label">Reference:</span>
                <span className="value">{movement.reference_type} #{movement.reference_id}</span>
              </div>

              <div className="row">
                <span className="label">Party:</span>
                <span className="value">{movement.party_name || '-'}</span>
              </div>

              <div className="row">
                <span className="label">Lot No:</span>
                <span className="value" style={{ fontWeight: 'bold' }}>{movement.lot_no || '-'}</span>
              </div>

              {(!isOutPassOnly ? null : (
                <>
                  <div className="row">
                    <span className="label">Analyzing Team:</span>
                    <span className="value">{movement.analyzing_team || '-'}</span>
                  </div>

                  <div className="row">
                    <span className="label">Analyzing Area:</span>
                    <span className="value">{movement.analyzing_area || '-'}</span>
                  </div>
                </>
              ))}

              <div className="row">
                <span className="label">Item:</span>
                <span className="value">{movement.item_name || '-'}</span>
              </div>

              <div className="row">
                <span className="label">Bag Qty:</span>
                <span className="value">{movement.qty || '0'}</span>
              </div>

              <div className="row">
                <span className="label">Bag Weight:</span>
                <span className="value">{movement.weight || '0'} kg</span>
              </div>

              <div className="row">
                <span className="label">Weights:</span>
                <span className="value">
                  G:{movement.gross_weight} T:{movement.tare_weight} N:{movement.net_weight}
                </span>
              </div>

              <div className="row">
                <span className="label">Gate In:</span>
                <span className="value">{formatDateTime(movement.gate_in_time)}</span>
              </div>

              <div className="row">
                <span className="label">Gate Out:</span>
                <span className="value">{formatDateTime(movement.gate_out_time) || '-'}</span>
              </div>

              <div className="row">
                <span className="label">Status:</span>
                <span className="value" style={{ fontWeight: 'bold', color: isPreviewRet ? '#dc2626' : 'inherit' }}>
                  {movement.status}
                </span>
              </div>

              <div className="row">
                <span className="label">Status Details:</span>
                <span className="value" style={{ fontWeight: 'bold', color: isPreviewRet ? '#dc2626' : 'inherit' }}>
                  {movement.status_details || (isPreviewRet ? 'REJECTED & RETURNED' : movement.status || 'IN')}
                </span>
              </div>
            </>
          );
        })()}

        <div className="sign">
          <div>Receiver Signature: ________________</div>
          <div>Date: ________________</div>
        </div>

        <div style={{ marginTop: '10mm', fontSize: '10px', textAlign: 'center' }}>
          Thank you for your business!
        </div>
      </div>
    </div>
  );
};

export default VehiclePrint;
