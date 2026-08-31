const db = require('./config/database');

async function check() {
  try {
    const purchases = await db.query("SELECT id, s_no, date, supplier, inv_no FROM purchases LIMIT 5");
    console.log("PURCHASES:", purchases.rows);

    const items = await db.query("SELECT id, purchase_id, item_name, qty, rate, amount FROM purchase_items LIMIT 5");
    console.log("PURCHASE ITEMS:", items.rows);

    const suppliers = await db.query("SELECT id, name, print_name FROM supplier_master LIMIT 5");
    console.log("SUPPLIERS:", suppliers.rows);
  } catch (err) {
    console.error("Error:", err);
  }
}

check();
