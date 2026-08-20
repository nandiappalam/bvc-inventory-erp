import { usePurchaseForm } from '../hooks/usePurchaseForm';
import PurchaseLayout from '../components/PurchaseLayout';
import PurchaseHeader from '../components/PurchaseHeader';
import PurchaseDetails from '../components/PurchaseDetails';
import PurchaseItemsTable from '../components/PurchaseItemsTable';
import PurchaseTotals from '../components/PurchaseTotals';
import PurchaseFooter from '../components/PurchaseFooter';
import { CircularProgress, Box } from '@mui/material';

const PurchaseCreate = () => {
  const purchase = usePurchaseForm();

  if (purchase.status.loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
  }

  return (
    <PurchaseLayout
      header={<PurchaseHeader form={purchase.form} />}
      details={
        <PurchaseDetails
          form={purchase.form}
          fieldErrors={purchase.validation.fieldErrors}
          onFormChange={purchase.actions.handleFormChange}
        />
      }
      itemGrid={
        <PurchaseItemsTable
          items={purchase.items}
          tableErrors={purchase.validation.tableErrors}
          onAddItem={purchase.actions.addItem}
          onUpdateItem={purchase.actions.updateItem}
          onDeleteItem={purchase.actions.deleteItem}
        />
      }
      totals={<PurchaseTotals summary={purchase.summary} />}
      footer={
        <PurchaseFooter
          saving={purchase.status.saving}
          canSave={purchase.validation.canSave}
          onSave={purchase.actions.savePurchase}
        />
      }
    />
  );
};

export default PurchaseCreate;