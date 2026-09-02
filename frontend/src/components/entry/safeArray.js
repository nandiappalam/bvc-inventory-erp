const safeArray = (data) => {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (data.data) return data.data;
  return [];
};

export { safeArray };

