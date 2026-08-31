import React, { useMemo } from 'react';
import { Box } from '@mui/material';

import ERPParameterTabs from '../../../components/erp/ERPParameterTabs';
import ERPTable from '../../../components/erp/ERPTable';

const columns = [
  { key: 'parameter', label: 'Parameter', sx: { width: 240 } },
  { key: 'specification', label: 'Specification Min', sx: { width: 170 } },
  { key: 'actual', label: 'Result', sx: { width: 160 } },
  { key: 'unit', label: 'Unit', sx: { width: 90 } },
  { key: 'method', label: 'Method', sx: { width: 160 } },
  { key: 'status', label: 'Status', sx: { width: 120 } },
  { key: 'remarks', label: 'Remarks', sx: { width: 220 } },
];

function mapRowShape(r) {
  return {
    id: r?.parameterKey ?? r?.id ?? r?.parameter ?? `${Math.random()}`,
    parameter: r?.parameterName ?? r?.parameter ?? '-',
    specification: r?.specificationMin ?? r?.specification ?? '',
    actual: r?.actualResult ?? r?.result ?? '',
    unit: r?.unit ?? '-',
    method: r?.method ?? '-',
    status: r?.status ?? '',
    remarks: r?.remarks ?? '',
  };
}

export default function QualityParameterTabs({
  value,
  onChange,
  templates = { Physical: [], Chemical: [], Microbiology: [] },
  qcResults = [],
  readOnly = false,
  onUpdateRow,
}) {
  const renderTabBody = (tabValue) => {
    const categoryKey = tabValue;
    const templateRows = templates?.[categoryKey] ?? [];

    // Phase 1: simplistic join by id/key
    const mergedRows = templateRows.map((t) => {
      const found = qcResults.find((r) => String(r?.parameterKey ?? r?.id ?? r?.parameter) === String(t?.id ?? t?.parameter));
      return mapRowShape(found ? { ...t, ...found } : t);
    });

    return (
      <Box>
        <ERPTable
          columns={columns}
          rows={mergedRows}
          headerSx={{ '& .MuiTableCell-root': { paddingY: 0.75 } }}
          bodySx={{ '& .MuiTableCell-root': { paddingY: 0.75, verticalAlign: 'top' } }}
          renderRow={(row) => (
            // Phase 1: render as plain text cells for compile-safety.
            // Editing wiring is Phase 2.
            <tr key={row.id}>
              <td style={{ fontWeight: 800, padding: '6px 8px' }}>{row.parameter}</td>
              <td style={{ padding: '6px 8px' }}>{row.specification || '-'}</td>
              <td style={{ padding: '6px 8px' }}>{row.actual || '-'}</td>
              <td style={{ padding: '6px 8px' }}>{row.unit || '-'}</td>
              <td style={{ padding: '6px 8px' }}>{row.method || '-'}</td>
              <td style={{ padding: '6px 8px' }}>{row.status || '-'}</td>
              <td style={{ padding: '6px 8px' }}>{row.remarks || '-'}</td>
            </tr>
          )}
        />
      </Box>
    );
  };

  return <ERPParameterTabs value={value} onChange={onChange} renderTabBody={renderTabBody} />;
}

