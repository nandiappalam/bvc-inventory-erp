const db = require('../config/database');
const lotGenealogyService = require('./lotGenealogyService');

function sanitizeDate(val) {
  if (val === null || val === undefined) return '';
  const s = String(val).trim();
  if (!s || s === 'null' || s === 'undefined') return '';
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})\s*[-\/]\s*(\d{1,2})\s*[-\/]\s*(\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s.slice(0, 10);
}

function round2(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Validates and sanitizes uploaded/linked evidence items so no unsafe URLs
 * (like javascript: or data:text/html) or oversized payloads enter storage.
 */
function sanitizeEvidenceList(rawList) {
  let list = [];
  if (typeof rawList === 'string') {
    try {
      const parsed = JSON.parse(rawList);
      if (Array.isArray(parsed)) list = parsed;
    } catch (_) {
      if (rawList.trim()) {
        list = [{ name: 'Attachment Reference', url: rawList.trim(), kind: 'document' }];
      }
    }
  } else if (Array.isArray(rawList)) {
    list = rawList;
  }

  const ALLOWED_DATA_MIME = /^data:(image\/(png|jpe?g|webp|gif)|video\/(mp4|webm)|application\/pdf);base64,/i;
  const ALLOWED_HTTP_URL = /^https?:\/\/[^\s"'<>]+$/i;
  const ALLOWED_REL_PATH = /^\/[a-zA-Z0-9_\-./]+$/;

  const cleaned = [];
  for (const entry of list.slice(0, 20)) {
    if (!entry || typeof entry !== 'object') continue;
    const name = String(entry.name || entry.title || 'Evidence File').trim().slice(0, 180);
    const notes = String(entry.notes || entry.description || '').trim().slice(0, 500);
    const rawUrl = String(entry.url || entry.dataUrl || '').trim();
    let safeUrl = '';
    if (rawUrl) {
      if (ALLOWED_DATA_MIME.test(rawUrl) && rawUrl.length <= 4_500_000) {
        safeUrl = rawUrl;
      } else if (ALLOWED_HTTP_URL.test(rawUrl) || ALLOWED_REL_PATH.test(rawUrl)) {
        safeUrl = rawUrl.slice(0, 1000);
      }
    }
    const rawMime = String(entry.mime_type || entry.mime || entry.type || '').trim().slice(0, 80);
    const inferredKind = ['image', 'video', 'document'].includes(String(entry.kind || '').toLowerCase())
      ? String(entry.kind).toLowerCase()
      : (rawMime.startsWith('video/') || safeUrl.startsWith('data:video/') || /\.(mp4|webm|mov|ogg)$/i.test(name))
        ? 'video'
        : (rawMime.startsWith('image/') || safeUrl.startsWith('data:image/') || /\.(png|jpe?g|webp|gif)$/i.test(name))
          ? 'image'
          : 'document';
    const normalizedMime = rawMime || (
      safeUrl.startsWith('data:video/') ? 'video/mp4'
        : safeUrl.startsWith('data:image/') ? 'image/png'
        : safeUrl.startsWith('data:application/pdf') ? 'application/pdf'
        : inferredKind
    );

    if (name || safeUrl || notes) {
      cleaned.push({
        id: String(entry.id || `${Date.now()}-${cleaned.length + 1}`),
        name: name || `Evidence ${cleaned.length + 1}`,
        kind: inferredKind,
        mime: normalizedMime,
        mime_type: normalizedMime,
        size: Number(entry.size || 0) || 0,
        url: safeUrl,
        notes,
        uploaded_at: String(entry.uploaded_at || new Date().toISOString().slice(0, 10))
      });
    }
  }
  return cleaned;
}

/**
 * Resolves Manufacturing Batch, Packaging, QC Inspection, and Parent RM Lot traceability
 * for a list of affected FG lots / items within a specific company tenant.
 */
async function resolveBatchAndRmTraceability(companyId, items = [], { originalSalesId = null } = {}) {
  const runner = db.forCompany(companyId);
  const lotsInput = Array.isArray(items) ? items : [];
  const traceRecords = [];
  const seenLots = new Set();

  for (const row of lotsInput) {
    const lotNo = String(row?.lot_no || '').trim();
    const itemName = String(row?.item_name || row?.product_name || '').trim();
    const traceKey = `${lotNo.toUpperCase()}|${itemName.toUpperCase()}`;
    if ((!lotNo && !itemName) || seenLots.has(traceKey)) continue;
    seenLots.add(traceKey);

    const record = {
      lot_no: lotNo || '—',
      item_name: itemName || '—',
      mfg_date: sanitizeDate(row?.mfg_date),
      exp_date: sanitizeDate(row?.exp_date),
      packing_batches: [],
      manufacturing_batches: [],
      rm_parent_lots: [],
      qc_inspections: [],
      shipped_invoices: [],
      sales_returns: []
    };

    if (lotNo) {
      // 1. Packing records creating/packing this FG lot
      const packRes = await runner.query(
        `SELECT p.id, p.s_no, p.date, p.remarks, pi.item_name, pi.lot_no, pi.qty, pi.total_wt
         FROM packing_items pi
         JOIN packing p ON p.id = pi.packing_id
         WHERE UPPER(TRIM(COALESCE(pi.lot_no, ''))) = UPPER(?)
         ORDER BY p.date DESC, p.id DESC LIMIT 10`,
        [lotNo]
      ).catch(() => ({ rows: [] }));

      for (const pk of (packRes.rows || [])) {
        record.packing_batches.push({
          packing_no: pk.s_no ? `PK-${pk.s_no}` : `PK-${pk.id}`,
          date: sanitizeDate(pk.date),
          qty: Number(pk.qty || 0),
          weight_kg: Number(pk.total_wt || 0),
          remarks: pk.remarks || ''
        });
        if (!record.mfg_date && pk.date) record.mfg_date = sanitizeDate(pk.date);
      }

      // 2. Grinding / Milling batches producing this lot
      const grainOutRes = await runner.query(
        `SELECT g.id, g.s_no, g.date, g.work_order_no, g.flour_mill, g.process_mode, g.mill_type,
                COALESCE(fmm.flourmill, g.flour_mill, 'BVC Mill') as mill_name,
                goi.item_name as out_item, goi.qty as out_qty, goi.total_wt as out_wt
         FROM grain_output_items goi
         JOIN grains g ON g.id = goi.grain_id
         LEFT JOIN flour_mill_master fmm ON (CAST(fmm.id AS TEXT) = CAST(g.flour_mill AS TEXT) OR fmm.flourmill = g.flour_mill)
         WHERE UPPER(TRIM(COALESCE(goi.lot_no, ''))) = UPPER(?)
         ORDER BY g.date DESC, g.id DESC LIMIT 10`,
        [lotNo]
      ).catch(() => ({ rows: [] }));

      for (const gr of (grainOutRes.rows || [])) {
        const inputsRes = await runner.query(
          `SELECT item_name, lot_no, qty, total_wt FROM grain_input_items WHERE grain_id = ?`,
          [gr.id]
        ).catch(() => ({ rows: [] }));

        const rmLots = (inputsRes.rows || []).map((ri) => ({
          lot_no: ri.lot_no || '',
          item_name: ri.item_name || '',
          qty: Number(ri.qty || 0),
          weight_kg: Number(ri.total_wt || 0)
        }));

        record.manufacturing_batches.push({
          batch_no: gr.work_order_no || `GRD-${gr.s_no || gr.id}`,
          date: sanitizeDate(gr.date),
          unit_name: gr.mill_name || 'BVC Mill',
          process_mode: gr.process_mode || gr.mill_type || 'Inside Mill',
          output_item: gr.out_item || itemName,
          output_qty: Number(gr.out_qty || 0),
          output_weight_kg: Number(gr.out_wt || 0),
          rm_inputs: rmLots
        });
        if (!record.mfg_date && gr.date) record.mfg_date = sanitizeDate(gr.date);
        for (const rml of rmLots) {
          if (rml.lot_no && !record.rm_parent_lots.some((x) => x.lot_no.toUpperCase() === rml.lot_no.toUpperCase())) {
            record.rm_parent_lots.push(rml);
          }
        }
      }

      // 3. Work orders outputting this FG lot
      const woRes = await runner.query(
        `SELECT wo.id, wo.work_order_no, wo.date, wo.work_unit, wo.product, woo.expected_qty, woo.output_kgs
         FROM work_order_outputs woo
         JOIN work_orders wo ON wo.id = woo.work_order_id
         WHERE UPPER(TRIM(COALESCE(woo.fg_lot_no, ''))) = UPPER(?)
         ORDER BY wo.date DESC LIMIT 10`,
        [lotNo]
      ).catch(() => ({ rows: [] }));

      for (const wo of (woRes.rows || [])) {
        if (!record.manufacturing_batches.some((b) => b.batch_no === wo.work_order_no)) {
          const woInRes = await runner.query(
            `SELECT item_name, lot_no, input_qty as qty, kgs as total_wt FROM work_order_items WHERE work_order_id = ?`,
            [wo.id]
          ).catch(() => ({ rows: [] }));
          const rmLots = (woInRes.rows || []).map((ri) => ({
            lot_no: ri.lot_no || '',
            item_name: ri.item_name || '',
            qty: Number(ri.qty || 0),
            weight_kg: Number(ri.total_wt || 0)
          }));
          record.manufacturing_batches.push({
            batch_no: wo.work_order_no,
            date: sanitizeDate(wo.date),
            unit_name: wo.work_unit || 'Production Floor',
            process_mode: 'WORK_ORDER',
            output_item: wo.product || itemName,
            output_qty: Number(wo.expected_qty || 0),
            output_weight_kg: Number(wo.output_kgs || 0),
            rm_inputs: rmLots
          });
          for (const rml of rmLots) {
            if (rml.lot_no && !record.rm_parent_lots.some((x) => x.lot_no.toUpperCase() === rml.lot_no.toUpperCase())) {
              record.rm_parent_lots.push(rml);
            }
          }
        }
        if (!record.mfg_date && wo.date) record.mfg_date = sanitizeDate(wo.date);
      }

      // 4. Deep lotGenealogyService enrichment (catches weight conversion, outside jobwork, parent purchases & suppliers)
      try {
        const gen = await lotGenealogyService.getLotDetails(lotNo, companyId);
        if (gen) {
          for (const mo of (gen.millingOutputs || [])) {
            if (!record.manufacturing_batches.some((b) => b.batch_no === mo.work_order_no)) {
              record.manufacturing_batches.push({
                batch_no: mo.work_order_no,
                date: sanitizeDate(mo.work_order_date),
                unit_name: mo.work_unit || 'Milling Unit',
                process_mode: mo.process_mode || 'Production',
                output_item: mo.finished_product || itemName,
                output_qty: Number(mo.output_bags || 0),
                output_weight_kg: Number(mo.output_kgs || 0),
                rm_inputs: (mo.inputs || []).map((i) => ({
                  lot_no: i.lot_no,
                  item_name: i.item_name,
                  qty: Number(i.qty || 0),
                  weight_kg: Number(i.total_wt || 0)
                }))
              });
            }
          }
          for (const pp of (gen.parentPurchases || [])) {
            const pLot = pp.parentLotNo || pp.lotNo;
            if (pLot) {
              const existingRm = record.rm_parent_lots.find((x) => x.lot_no.toUpperCase() === String(pLot).toUpperCase());
              if (existingRm) {
                existingRm.supplier = pp.supplierName || existingRm.supplier;
                existingRm.purchase_voucher = pp.voucherNo;
                existingRm.purchase_date = sanitizeDate(pp.purchaseDate);
              } else {
                record.rm_parent_lots.push({
                  lot_no: pLot,
                  item_name: pp.itemName || '',
                  qty: Number(pp.qty || 0),
                  weight_kg: Number(pp.totalWeight || 0),
                  supplier: pp.supplierName || '',
                  purchase_voucher: pp.voucherNo || '',
                  purchase_date: sanitizeDate(pp.purchaseDate)
                });
              }
            }
          }
          if (gen.purchase && gen.purchase.supplierName) {
            record.rm_parent_lots.push({
              lot_no: gen.purchase.lotNo || lotNo,
              item_name: gen.purchase.itemName || itemName,
              qty: Number(gen.purchase.qty || 0),
              weight_kg: Number(gen.purchase.totalWeight || 0),
              supplier: gen.purchase.supplierName,
              purchase_voucher: gen.purchase.voucherNo || '',
              purchase_date: sanitizeDate(gen.purchase.purchaseDate)
            });
          }
          if (gen.qc && gen.qc.qc_no) {
            record.qc_inspections.push({
              qc_no: gen.qc.qc_no,
              lot_no: lotNo,
              inspection_date: sanitizeDate(gen.qc.inspection_date),
              inspector: gen.qc.inspector || '',
              overall_result: gen.qc.overall_result || '',
              remarks: gen.qc.remarks || ''
            });
          }
        }
      } catch (e) {
        console.warn('[TraceabilityHelper] genealogy notice:', e.message);
      }

      // 5. Enrich supplier info for any RM parent lots that don't yet have purchase details
      for (const rml of record.rm_parent_lots) {
        if (!rml.supplier && rml.lot_no) {
          const purRes = await runner.query(
            `SELECT p.supplier, COALESCE(NULLIF(p.voucher_no,''), p.inv_no, 'PUR-' || CAST(p.id AS TEXT)) as voucher_no, p.date
             FROM purchase_items pi
             JOIN purchases p ON p.id = pi.purchase_id
             WHERE UPPER(TRIM(COALESCE(pi.lot_no, ''))) = UPPER(?)
             ORDER BY p.id DESC LIMIT 1`,
            [rml.lot_no]
          ).catch(() => ({ rows: [] }));
          if (purRes.rows?.[0]) {
            rml.supplier = purRes.rows[0].supplier || '';
            rml.purchase_voucher = purRes.rows[0].voucher_no || '';
            rml.purchase_date = sanitizeDate(purRes.rows[0].date);
          }
        }
        // Check RM lot QC inspections as well
        if (rml.lot_no) {
          const rmQcRes = await runner.query(
            `SELECT qc_no, rm_lot_no, inspection_date, inspector, overall_result, remarks
             FROM qc_inspections
             WHERE UPPER(TRIM(COALESCE(rm_lot_no, ''))) = UPPER(?)
             ORDER BY id DESC LIMIT 3`,
            [rml.lot_no]
          ).catch(() => ({ rows: [] }));
          for (const qcr of (rmQcRes.rows || [])) {
            if (!record.qc_inspections.some((x) => x.qc_no === qcr.qc_no)) {
              record.qc_inspections.push({
                qc_no: qcr.qc_no,
                lot_no: qcr.rm_lot_no,
                inspection_date: sanitizeDate(qcr.inspection_date),
                inspector: qcr.inspector || '',
                overall_result: qcr.overall_result || '',
                remarks: qcr.remarks || ''
              });
            }
          }
        }
      }

      // 6. QC inspections directly on this FG lot
      const fgQcRes = await runner.query(
        `SELECT qc_no, rm_lot_no, inspection_date, inspector, overall_result, remarks
         FROM qc_inspections
         WHERE UPPER(TRIM(COALESCE(rm_lot_no, ''))) = UPPER(?)
         ORDER BY id DESC LIMIT 5`,
        [lotNo]
      ).catch(() => ({ rows: [] }));
      for (const qcr of (fgQcRes.rows || [])) {
        if (!record.qc_inspections.some((x) => x.qc_no === qcr.qc_no)) {
          record.qc_inspections.push({
            qc_no: qcr.qc_no,
            lot_no: qcr.rm_lot_no,
            inspection_date: sanitizeDate(qcr.inspection_date),
            inspector: qcr.inspector || '',
            overall_result: qcr.overall_result || '',
            remarks: qcr.remarks || ''
          });
        }
      }

      // 7. Sales Invoices shipped from this FG lot
      const salesRes = await runner.query(
        `SELECT s.id, COALESCE(NULLIF(s.inv_no,''), 'SAL-' || CAST(s.s_no AS TEXT)) as inv_no,
                s.date, s.customer, si.qty, si.total_wt
         FROM sales_items si
         JOIN sales s ON s.id = si.sales_id
         WHERE UPPER(TRIM(COALESCE(si.lot_no, ''))) = UPPER(?)
           AND COALESCE(s.is_order, 0) = 0
         ORDER BY s.date DESC, s.id DESC LIMIT 15`,
        [lotNo]
      ).catch(() => ({ rows: [] }));
      record.shipped_invoices = (salesRes.rows || []).map((s) => ({
        sales_id: s.id,
        inv_no: s.inv_no,
        date: sanitizeDate(s.date),
        customer: s.customer,
        qty: Number(s.qty || 0),
        weight_kg: Number(s.total_wt || 0)
      }));

      // 8. Linked Sales Returns on this lot
      const srRes = await runner.query(
        `SELECT sr.id, COALESCE(NULLIF(sr.return_no,''), 'SR-' || CAST(sr.s_no AS TEXT)) as return_no,
                sr.date, sr.customer, sr.qc_status, sr.stock_status, sri.qty, sri.return_weight
         FROM sales_return_items sri
         JOIN sales_return sr ON sr.id = sri.sales_return_id
         WHERE UPPER(TRIM(COALESCE(sri.lot_no, ''))) = UPPER(?)
           AND COALESCE(UPPER(sr.approval_status), 'PENDING') != 'CANCELLED'
         ORDER BY sr.date DESC, sr.id DESC LIMIT 15`,
        [lotNo]
      ).catch(() => ({ rows: [] }));
      record.sales_returns = (srRes.rows || []).map((sr) => ({
        sales_return_id: sr.id,
        return_no: sr.return_no,
        date: sanitizeDate(sr.date),
        customer: sr.customer,
        qty: Number(sr.qty || 0),
        weight_kg: Number(sr.return_weight || 0),
        qc_status: sr.qc_status || 'Pending',
        stock_status: sr.stock_status || 'Hold'
      }));
    }

    if (originalSalesId && record.shipped_invoices.length === 0) {
      const origRes = await runner.query(
        `SELECT s.id, COALESCE(NULLIF(s.inv_no,''), 'SAL-' || CAST(s.s_no AS TEXT)) as inv_no, s.date, s.customer
         FROM sales s WHERE s.id = ? LIMIT 1`,
        [originalSalesId]
      ).catch(() => ({ rows: [] }));
      if (origRes.rows?.[0]) {
        record.shipped_invoices.push({
          sales_id: origRes.rows[0].id,
          inv_no: origRes.rows[0].inv_no,
          date: sanitizeDate(origRes.rows[0].date),
          customer: origRes.rows[0].customer,
          qty: Number(row?.invoice_qty || 0),
          weight_kg: 0
        });
      }
    }

    traceRecords.push(record);
  }

  return traceRecords;
}

module.exports = {
  sanitizeDate,
  round2,
  sanitizeEvidenceList,
  resolveBatchAndRmTraceability
};
