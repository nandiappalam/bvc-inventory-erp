export const MODULE_FIELDS = {
  item: {
    basic: ["item_name", "print_name"],
    classification: ["item_group", "type"],
    tax: ["tax", "hsn_code", "ed_percent"],
  },

  customer: {
    basic: ["name"],
    contact: ["phone", "address"],
    location: ["area", "city"],
  },

  supplier: {
    basic: ["name"],
    contact: ["phone", "address"],
    location: ["area"],
  },
};

