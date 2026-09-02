import React from 'react';
import { Button, ButtonGroup } from '@mui/material';

const UniversalActionMenu = ({ actions = [] }) => {
  return (
    <ButtonGroup variant="outlined" size="small" aria-label="module actions">
      {actions.map((action) => (
        <Button
          key={action.label}
          onClick={action.onClick}
          color={action.color || 'primary'}
          disabled={action.disabled}
        >
          {action.label}
        </Button>
      ))}
    </ButtonGroup>
  );
};

export default UniversalActionMenu;
