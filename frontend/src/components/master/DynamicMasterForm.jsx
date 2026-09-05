import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { MASTER_CONFIG } from "../../utils/masterConfig.js";
import { safeArray } from "../../utils/safeArray.js";
import { createMaster, updateMaster, api } from "../../services/masterservice.js";
import MasterFormLayout from "./MasterFormLayout";
import SmartField from "./SmartField";
import "./master.css";

// Map config keys to API plural names used by getMasters
const API_NAME_MAP = {
  sender: "senders",
  consignee: "consignees",
  area: "areas",
  city: "cities",
  transport: "transports",
  p_trans: "ptrans",
  godown: "godowns",
  customer: "customers",
  supplier: "suppliers",
  flour_mill: "flour_mills",
  papad_company: "papad_companies",
  weight: "weights",
  ledger_group: "ledger_groups",
  ledger: "ledgers",
  item: "items",
  item_group: "item_groups",
  deduction_sales: "deduction_sales",
  deduction_purchase: "deduction_purchase",
  tax: "taxes",
};

export const DynamicMasterForm = ({ configKey }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("edit");

  const normalizedKey = configKey ? configKey.replace(/-/g, "_") : "";
  const config = MASTER_CONFIG[normalizedKey] || MASTER_CONFIG[configKey] || {};
  const title = config.title || (configKey || "").replace(/[_-]/g, " ").toUpperCase();

  // Flatten all fields from all sections
  const allFields = React.useMemo(() => {
    const fields = [];
    safeArray(config.sections).forEach((section) => {
      safeArray(section.fields).forEach((field) => {
        fields.push(field);
      });
    });
    return fields;
  }, [config]);

  const getInitialData = () => {
    const data = {};
    allFields.forEach((field) => {
      data[field.name] = field.defaultValue !== undefined ? field.defaultValue : "";
    });
    return data;
  };

  const [formData, setFormData] = useState(getInitialData);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("success");

  // Reset form data when switching master module
  useEffect(() => {
    setFormData(getInitialData());
    setMessage("");
  }, [configKey]);

  // Auto-generate readonly or editable code fields in creation mode
  useEffect(() => {
    if (editId) return; // Only for creation

    const codeField = allFields.find((f) => f.name.includes("_code"));
    if (!codeField) return;

    const generateCode = (prefix, count) => {
      return `${prefix}${String(count + 1).padStart(3, "0")}`;
    };

    const prefixes = {
      item: "ITM",
      item_group: "GRP",
      deduction_purchase: "DP",
    };

    const prefix = prefixes[configKey];
    if (!prefix) return;

    const apiName = API_NAME_MAP[configKey] || configKey;
    api(`/masters/${apiName}`).then((res) => {
      const count = Array.isArray(res?.data)
        ? res.data.length
        : Array.isArray(res)
        ? res.length
        : 0;
      const nextCode = generateCode(prefix, count);
      setFormData((prev) => ({ ...prev, [codeField.name]: nextCode }));
    });
  }, [editId, configKey, allFields]);

  // Load existing record for edit mode
  const loadRecord = async () => {
    if (!editId || !config.table) return;
    try {
      const res = await api(`/masters/record/${config.table}/${editId}`);
      if (res && !res.message) {
        // res is the record object directly
        const copy = { ...res };
        // Bidirectional field normalization to resolve frontend <-> backend differences
        if (copy.address !== undefined && copy.address1 === undefined) copy.address1 = copy.address;
        if (copy.address1 !== undefined && copy.address === undefined) copy.address = copy.address1;
        if (copy.mobile !== undefined && copy.mobile1 === undefined) copy.mobile1 = copy.mobile;
        if (copy.mobile1 !== undefined && copy.mobile === undefined) copy.mobile = copy.mobile1;
        if (copy.printname !== undefined && copy.print_name === undefined) copy.print_name = copy.printname;
        if (copy.print_name !== undefined && copy.printname === undefined) copy.printname = copy.print_name;
        if (copy.gst_no !== undefined && copy.gst_number === undefined) copy.gst_number = copy.gst_no;
        if (copy.gst_number !== undefined && copy.gst_no === undefined) copy.gst_no = copy.gst_number;
        
        setFormData((prev) => ({ ...prev, ...copy }));
      }
    } catch (err) {
      console.error("Failed to load record:", err);
    }
  };

  useEffect(() => {
    loadRecord();
  }, [editId, config.table]);

  const handleRefresh = async () => {
    setMessage("");
    if (editId) {
      await loadRecord();
    } else {
      const initial = getInitialData();
      setFormData(initial);
      
      const codeField = allFields.find((f) => f.name.includes("_code"));
      if (codeField) {
        const generateCode = (prefix, count) => {
          return `${prefix}${String(count + 1).padStart(3, "0")}`;
        };
        const prefixes = {
          item: "ITM",
          item_group: "GRP",
          deduction_purchase: "DP",
        };
        const prefix = prefixes[configKey];
        if (prefix) {
          const apiName = API_NAME_MAP[configKey] || configKey;
          try {
            const res = await api(`/masters/${apiName}`);
            const count = Array.isArray(res?.data)
              ? res.data.length
              : Array.isArray(res)
              ? res.length
              : 0;
            const nextCode = generateCode(prefix, count);
            setFormData((prev) => ({ ...prev, ...initial, [codeField.name]: nextCode }));
          } catch (e) {
            console.error("Failed to re-generate code:", e);
          }
        }
      }
    }
  };

  const handleChange = (name, value) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };
      
      // Auto-populate print_name / printname when entering any name field
      const nameFields = ["name", "item_name", "group_name", "ded_name", "flourmill", "godown_name"];
      if (nameFields.includes(name)) {
        const printNameField = allFields.find(f => f.name === "print_name" || f.name === "printname");
        if (printNameField) {
          const currentPrintValue = prev[printNameField.name] || "";
          const currentNameValue = prev[name] || "";
          if (!currentPrintValue || currentPrintValue === currentNameValue) {
            updated[printNameField.name] = value;
          }
        }
      }
      
      return updated;
    });
  };

  const validate = () => {
    for (const field of allFields) {
      if (field.required && !formData[field.name]?.toString().trim()) {
        setMessage(`${field.label || field.name} is required`);
        setMessageType("error");
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!validate()) return;

    setLoading(true);

    try {
      let result;
      if (editId) {
        result = await updateMaster(config.table, editId, formData);
      } else {
        result = await createMaster(config.table, formData);
      }

      if (result && result.success) {
        const successMessage = `${title} ${editId ? "updated" : "saved"} successfully!`;
        setMessage(successMessage);
        setMessageType("success");
        alert(successMessage);
        const routeKey = configKey.replace(/_/g, "-");
        navigate(`/master/${routeKey}-display`);
      } else {
        const errMsg = result?.message || result?.error || "Unknown error";
        setMessage("Error: " + errMsg);
        setMessageType("error");
      }
    } catch (error) {
      console.error("Save error:", error);
      setMessage(`Error ${editId ? "updating" : "saving"} ${title.toLowerCase()}`);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData(getInitialData());
    setMessage("");
    const routeKey = configKey.replace(/_/g, "-");
    navigate(`/master/${routeKey}-display`);
  };

  return (
    <MasterFormLayout
      title={`${title} ${editId ? "Update" : "Create"}`}
      onSave={handleSubmit}
      onCancel={handleCancel}
      saving={loading}
      onRefresh={handleRefresh}
    >
      {message && (
        <div className={`message ${messageType}`} style={{ gridColumn: "span 2", marginBottom: 12 }}>
          {message}
        </div>
      )}

      {allFields.map((field, idx) => (
        <SmartField
          key={`${field.name}_${idx}`}
          field={field}
          value={formData[field.name]}
          onChange={handleChange}
        />
      ))}

      {loading && (
        <div style={{ gridColumn: "span 2", textAlign: "center", padding: 12 }}>
          Saving...
        </div>
      )}
    </MasterFormLayout>
  );
};

export default DynamicMasterForm;

