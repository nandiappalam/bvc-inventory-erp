import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { MASTER_CONFIG } from "../../utils/masterConfig.js";
import { safeArray } from "../../utils/safeArray.js";
import { getAllMasters, deleteMaster } from "../../services/masterservice.js";
import { printHtml } from "../../utils/printHelper";
import MasterTableLayout from "./MasterTableLayout";
import "./master.css";

export const DynamicMasterDisplay = ({ configKey }) => {
  const navigate = useNavigate();
  const normalizedKey = configKey ? configKey.replace(/-/g, "_") : "";
  const config = MASTER_CONFIG[normalizedKey] || MASTER_CONFIG[configKey] || {};
  const title = config.title || (configKey || "").replace(/[_-]/g, " ").toUpperCase();
  const tableName = config.table || normalizedKey || configKey;

  // Auto-generate columns from first section fields (up to 12) + status
  const columns = React.useMemo(() => {
    const cols = [{ key: "sno", title: "S.No", width: "50px", render: (_, __, index) => index + 1 }];

    const allFields = [];
    safeArray(config.sections).forEach((section) => {
      safeArray(section.fields).forEach((field) => {
        allFields.push(field);
      });
    });

    // Take first 12 visible fields
    const displayFields = allFields.filter((f) => !f.hidden).slice(0, 12);
    displayFields.forEach((field) => {
      cols.push({
        key: field.name,
        title: field.label || field.name,
      });
    });

    // Add status if present in fields AND not already in displayFields
    const hasStatusInDisplay = displayFields.some((f) => f.name === "status");
    if (!hasStatusInDisplay && allFields.some((f) => f.name === "status")) {
      cols.push({ key: "status", title: "Status", width: "80px" });
    }

    return cols;
  }, [config]);

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const result = await getAllMasters(tableName);
      
      // Bidirectional field normalization to resolve frontend <-> backend differences
      const normalized = safeArray(result).map((row) => {
        const copy = { ...row };
        
        // Address mappings
        if (copy.address !== undefined && copy.address1 === undefined) copy.address1 = copy.address;
        if (copy.address1 !== undefined && copy.address === undefined) copy.address = copy.address1;
        
        // Mobile mappings
        if (copy.mobile !== undefined && copy.mobile1 === undefined) copy.mobile1 = copy.mobile;
        if (copy.mobile1 !== undefined && copy.mobile === undefined) copy.mobile = copy.mobile1;
        
        // Print Name mappings
        if (copy.printname !== undefined && copy.print_name === undefined) copy.print_name = copy.printname;
        if (copy.print_name !== undefined && copy.printname === undefined) copy.printname = copy.print_name;
        
        // GST mappings
        if (copy.gst_no !== undefined && copy.gst_number === undefined) copy.gst_number = copy.gst_no;
        if (copy.gst_number !== undefined && copy.gst_no === undefined) copy.gst_no = copy.gst_number;
        
        // Deduction mappings
        if (copy.name !== undefined && copy.ded_name === undefined) copy.ded_name = copy.name;
        if (copy.ded_name !== undefined && copy.name === undefined) copy.name = copy.ded_name;
        if (copy.deduction_name !== undefined && copy.ded_name === undefined) copy.ded_name = copy.deduction_name;
        if (copy.code !== undefined && copy.ded_code === undefined) copy.ded_code = copy.code;
        if (copy.ded_code !== undefined && copy.code === undefined) copy.code = copy.ded_code;
        
        return copy;
      });
      
      setData(normalized);
    } catch (error) {
      console.error(`Error loading ${title}:`, error);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setData([]);
    loadData();
  }, [tableName]);

  const handleDelete = async (row) => {
    try {
      const rowId = row.id !== undefined && row.id !== null ? row.id : (row.item_code || row.group_code || row.ded_code);
      const result = await deleteMaster(tableName, rowId);
      if (result && result.success) {
        loadData();
      } else {
        const errMsg = result?.message || result?.error || "Unknown error";
        throw new Error(errMsg);
      }
    } catch (error) {
      console.error("Delete error:", error);
      throw error;
    }
  };

  const handleEdit = (row) => {
    const routeKey = configKey.replace(/_/g, '-');
    const rowId = row.id !== undefined && row.id !== null ? row.id : (row.item_code || row.group_code || row.ded_code);
    navigate(`/master/${routeKey}-create?edit=${rowId}`);
  };

  const handleCreate = () => {
    const routeKey = configKey.replace(/_/g, '-');
    navigate(`/master/${routeKey}-create`);
  };

  const handlePrint = (row) => {
    const fieldsToPrint = [];
    safeArray(config.sections).forEach((section) => {
      safeArray(section.fields).forEach((field) => {
        if (!field.hidden && field.name !== 'status') {
          fieldsToPrint.push({
            label: field.label || field.name,
            value: row[field.name] !== undefined ? row[field.name] : ''
          });
        }
      });
    });

    const rowsHtml = fieldsToPrint.map(field => `
      <tr>
        <td style="font-weight: bold; width: 40%; padding: 8px; border-bottom: 1px solid #eee; text-transform: capitalize;">${field.label}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${field.value}</td>
      </tr>
    `).join('');

    const html = `
      <div class="header" style="border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 20px;">
        <h2 style="color: #1976d2; margin: 0;">${title.toUpperCase()} DETAILS</h2>
        <div style="font-size: 12px; color: #666; margin-top: 5px;">Printed on: ${new Date().toLocaleString()}</div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
        ${rowsHtml}
        <tr>
          <td style="font-weight: bold; padding: 8px; border-bottom: 1px solid #eee;">Status</td>
          <td style="padding: 8px; border-bottom: 1px solid #eee;">${row.status || 'Active'}</td>
        </tr>
      </table>
      <div class="footer" style="margin-top: 30px; font-size: 11px; color: #777; border-top: 1px solid #ddd; padding-top: 10px; text-align: center;">
        BVC ERP System - Master Record Printout
      </div>
    `;

    printHtml(html, `${title} Details - ${row.name || row.godown_name || row.flourmill || ''}`);
  };

  return (
    <MasterTableLayout
      title={`${title} MASTER`}
      columns={columns}
      data={data}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onPrint={handlePrint}
      onCreate={handleCreate}
      showActions={true}
      onRefresh={loadData}
    />
  );
};

export default DynamicMasterDisplay;
