import React from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';

const tabOrder = ['Physical', 'Chemical', 'Microbiology'];

const ERPParameterTabs = ({
  value,
  onChange,
  tabs = tabOrder,
  renderTabBody,
}) => {
  return (
    <Box>
      <Tabs
        value={value}
        onChange={(_, v) => onChange?.(v)}
        sx={{
          '& .MuiTabs-indicator': { backgroundColor: 'var(--erp-primary)' },
          '& .MuiTab-root': { textTransform: 'none', fontWeight: 800 },
        }}
      >
        {tabs.map((t) => (
          <Tab key={t} label={t} value={t} sx={{ color: 'var(--erp-primary)' }} />
        ))}
      </Tabs>
      <Box sx={{ pt: 1.25 }}>{renderTabBody?.(value) ?? <Typography />}</Box>
    </Box>
  );
};

export default ERPParameterTabs;

