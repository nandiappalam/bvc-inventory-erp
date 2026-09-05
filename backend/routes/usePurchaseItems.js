import { useState, useCallback } from 'react';

export const usePurchaseItems = (initialItems = []) => {
  const [items, setItems] = useState(initialItems);

  const addItem = useCallback(() => {
    const newItem = { id: Date.now(), /* default item properties */ };
    setItems(prev => [...prev, newItem]);
  }, []);

  const updateItem = useCallback((id, field, value) => {
    setItems(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  }, []);

  const deleteItem = useCallback((id) => {
    setItems(prev => prev.filter(item => item.id !== id));
  }, []);

  // onRowsChange allows for direct manipulation, e.g., from a data grid's state
  return { items, setItems, addItem, updateItem, deleteItem };
};