const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve('database/company_1.db');
const db = new sqlite3.Database(dbPath);

console.log('========================================================================');
console.log('>>> DATABASE RECONCILIATION AUDIT: INPASS & OUTPASS SYSTEM (company_1.db)');
console.log('========================================================================\n');

db.serialize(() => {
  // 1. Audit Outpasses
  db.all('SELECT * FROM outpasses', (err, outpasses) => {
    if (err) {
      console.error('Error fetching outpasses:', err);
      return;
    }
    console.log(`[1. OUTPASS MASTER AUDIT] Total Outpass Records: ${outpasses.length}`);
    console.table(outpasses.map(o => ({
      id: o.id,
      outpass_no: o.outpass_no,
      date: o.date,
      purpose: o.purpose,
      party_name: o.party_name,
      total_qty: o.total_qty,
      total_weight: o.total_weight,
      returned_qty: o.returned_qty,
      returned_weight: o.returned_weight,
      pending_weight: (o.total_weight - (o.returned_weight || 0)),
      status: o.status
    })));

    // 2. Audit Outpass Items
    db.all('SELECT * FROM outpass_items', (err2, outpassItems) => {
      if (err2) {
        console.error('Error fetching outpass_items:', err2);
        return;
      }
      console.log(`\n[2. OUTPASS ITEMS AUDIT] Total Outpass Item Records: ${outpassItems.length}`);
      console.table(outpassItems.map(oi => ({
        id: oi.id,
        outpass_id: oi.outpass_id,
        outpass_no: oi.outpass_no,
        item_name: oi.item_name,
        lot_no: oi.lot_no,
        qty: oi.qty,
        weight: oi.weight,
        total_weight: oi.total_weight,
        returned_qty: oi.returned_qty,
        returned_weight: oi.returned_weight,
        status: oi.status
      })));

      // 3. Audit Inpasses
      db.all('SELECT * FROM inpasses', (err3, inpasses) => {
        if (err3) {
          console.error('Error fetching inpasses:', err3);
          return;
        }
        console.log(`\n[3. INPASS MASTER AUDIT] Total Inpass Records: ${inpasses.length}`);
        console.table(inpasses.map(ip => ({
          id: ip.id,
          inpass_no: ip.inpass_no,
          date: ip.date,
          outpass_no: ip.outpass_no,
          party_name: ip.party_name,
          input_weight: ip.input_weight,
          output_weight: ip.output_weight,
          byproduct_weight: ip.byproduct_weight,
          loss_weight: ip.loss_weight,
          discrepancy_weight: ip.discrepancy_weight,
          yield_percent: ip.yield_percent,
          status: ip.status
        })));

        // 4. Audit Inpass Items
        db.all('SELECT * FROM inpass_items', (err4, inpassItems) => {
          if (err4) {
            console.error('Error fetching inpass_items:', err4);
            return;
          }
          console.log(`\n[4. INPASS ITEMS AUDIT] Total Inpass Item Breakdown Records: ${inpassItems.length}`);
          console.table(inpassItems.map(ii => ({
            id: ii.id,
            inpass_id: ii.inpass_id,
            inpass_no: ii.inpass_no,
            item_name: ii.item_name,
            original_item_name: ii.original_item_name,
            output_type: ii.output_type,
            qty: ii.qty,
            weight: ii.weight,
            total_weight: ii.total_weight,
            qc_status: ii.qc_status,
            godown_name: ii.godown_name
          })));

          // 5. Cross-Table Reconciliation: Mass Balance & Return Integrity
          console.log('\n[5. CROSS-MODULE RECONCILIATION ANALYSIS]');
          for (const op of outpasses) {
            const linkedInpasses = inpasses.filter(ip => ip.outpass_id === op.id || ip.outpass_no === op.outpass_no);
            console.log(`\n--- Reconciling Outpass #${op.outpass_no} (Status: ${op.status}) ---`);
            console.log(`  Dispatched Input Weight: ${op.total_weight} KG, Returned Weight: ${op.returned_weight} KG`);
            console.log(`  Linked Inpass Records: ${linkedInpasses.length}`);

            let sumReturnedInput = 0;
            let sumTotalProduced = 0;
            for (const lip of linkedInpasses) {
              const produced = (lip.output_weight || 0) + (lip.byproduct_weight || 0) + (lip.loss_weight || 0);
              sumReturnedInput += (lip.input_weight || 0);
              sumTotalProduced += produced;
              console.log(`    -> Inpass #${lip.inpass_no}: Input=${lip.input_weight} KG, Output=${lip.output_weight} KG, Byproduct=${lip.byproduct_weight} KG, Loss=${lip.loss_weight} KG (Total Produced=${produced} KG, Discrepancy=${lip.discrepancy_weight || 0} KG)`);
              
              // Mass Balance Check
              const balanceDelta = (lip.input_weight || 0) - (produced + (lip.discrepancy_weight || 0));
              if (Math.abs(balanceDelta) < 0.01) {
                console.log(`       [MASS BALANCE RECONCILED]: Input (${lip.input_weight}) = Produced (${produced}) + Shortage (${lip.discrepancy_weight || 0})`);
              } else {
                console.warn(`       [MASS BALANCE MISMATCH]: Discrepancy delta = ${balanceDelta} KG`);
              }
            }

            // Custody check
            if (op.status === 'CLOSED' && Math.abs(op.total_weight - op.returned_weight) < 0.01) {
              console.log(`  [CUSTODY STATUS]: Fully Reconciled & Closed (100% material accounted for)`);
            } else if (op.status === 'OUTPASSED' || op.status === 'PARTIALLY_RETURNED') {
              console.log(`  [CUSTODY STATUS]: Active Outside Custody (${op.total_weight - op.returned_weight} KG remaining at ${op.party_name})`);
            }
          }

          // 6. Stock Lots Custody Reconciliation
          db.all('SELECT lot_no, item_name, remaining_quantity, outside_processing_qty, custody_status FROM stock_lots WHERE outside_processing_qty > 0 OR lot_no = "LOT0003"', (err5, lots) => {
            console.log(`\n[6. STOCK LOTS CUSTODY RECONCILIATION]`);
            console.table(lots);

            // 7. Masters Integrity
            db.all('SELECT id, flourmill, area, wages_kg FROM flour_mill_master', (err6, mills) => {
              console.log(`\n[7. FLOUR MILL MASTERS]`);
              console.table(mills);

              db.all('SELECT id, godown_name, print_name, storage_location FROM godown_master', (err7, godowns) => {
                console.log(`\n[8. GODOWN MASTERS]`);
                console.table(godowns);
                db.close();
              });
            });
          });
        });
      });
    });
  });
});
