import React from "react";
import "./master.css";

export const FormSection = ({ title, children }) => {
  return (
    <div className="form-section">
      <div className="section-title">{title}</div>
      <div className="master-grid">
        {children}
      </div>
    </div>
  );
};
