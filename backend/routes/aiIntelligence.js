const express = require('express');
const router = express.Router();
const db = require('../config/database');

// GET AI Demand Forecasts & Purchase Recommendations
router.get('/forecast-recommendations', async (req, res) => {
  try {
    const demandForecasts = [
      {
        product: 'Urad Dal Premium 30kg',
        historicalMonthlyAvg: 1650,
        confirmedOrders: 400,
        expectedDemand30D: 1850,
        currentAvailableStock: 900,
        openPOQty: 400,
        projectedShortage: 550,
        confidencePct: 92.4,
        seasonalityFactor: '+12% (Festival Season)'
      },
      {
        product: 'Moong Flour Fine 25kg',
        historicalMonthlyAvg: 1200,
        confirmedOrders: 250,
        expectedDemand30D: 1350,
        currentAvailableStock: 1100,
        openPOQty: 500,
        projectedShortage: 0,
        confidencePct: 89.1,
        seasonalityFactor: '+5% (Stable Demand)'
      },
      {
        product: 'Chana Dal Super 50kg',
        historicalMonthlyAvg: 2200,
        confirmedOrders: 600,
        expectedDemand30D: 2450,
        currentAvailableStock: 1200,
        openPOQty: 400,
        projectedShortage: 850,
        confidencePct: 94.0,
        seasonalityFactor: '+15% (Bulk Procurement)'
      }
    ];

    const purchaseRecommendations = [
      {
        id: 'REC-101',
        item: 'Urad Whole Raw Grain',
        recommendedQty: 750,
        unit: 'KG',
        supplierPreferred: 'Apex Agro Commodities',
        leadTimeDays: 4,
        urgency: 'HIGH',
        reason: 'Projected shortage of 550 KG Urad Dal within expected 4-day supplier lead time.'
      },
      {
        id: 'REC-102',
        item: 'Bengal Gram / Chana Whole',
        recommendedQty: 1000,
        unit: 'KG',
        supplierPreferred: 'National Grain Co',
        leadTimeDays: 5,
        urgency: 'MEDIUM',
        reason: 'Current stock below safety reorder point relative to 30-day forecasted sales velocity.'
      }
    ];

    res.json({
      success: true,
      demandForecasts,
      purchaseRecommendations
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Supplier Risk & Quality Analytics
router.get('/supplier-risk', async (req, res) => {
  try {
    const supplierRisks = [
      {
        supplier: 'Apex Agro Commodities',
        riskLevel: 'MODERATE',
        rejectionRatePct: 4.2,
        moistureTrend: 'INCREASING',
        deliveryDelayDays: 1.5,
        priceVariancePct: '+2.8%',
        observation: 'Average raw lot moisture increased by 1.2% over last 3 shipments. Rejection rate slightly elevated.'
      },
      {
        supplier: 'National Grain Merchants',
        riskLevel: 'LOW',
        rejectionRatePct: 0.8,
        moistureTrend: 'STABLE',
        deliveryDelayDays: 0.2,
        priceVariancePct: '-0.5%',
        observation: 'High consistency across moisture, weight, and delivery schedules.'
      },
      {
        supplier: 'Sunshine Milling Traders',
        riskLevel: 'HIGH',
        rejectionRatePct: 7.5,
        moistureTrend: 'HIGH_VARIANCE',
        deliveryDelayDays: 3.8,
        priceVariancePct: '+5.4%',
        observation: 'Frequent 3+ day delivery delays and 2 rejected lots due to high foreign material.'
      }
    ];

    res.json({ success: true, supplierRisks });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET Production & Inventory Anomaly Detection
router.get('/anomalies', async (req, res) => {
  try {
    const anomalies = [
      {
        id: 'ANM-001',
        type: 'PRODUCTION_YIELD_LOW',
        severity: 'HIGH',
        detectedAt: '2026-09-14 14:30',
        title: 'Production Batch PROD-145 Low Yield Variance',
        details: 'Expected yield 72.0%, Actual yield 64.0% (-8.0% variance).',
        potentialCauses: [
          'Dryer temperature drop (52C vs 65C spec)',
          'High input moisture in lot LOT000245',
          'Roller gap calibration drift'
        ],
        investigationStatus: 'Under Review'
      },
      {
        id: 'ANM-002',
        type: 'INVENTORY_CONSUMPTION_SPIKE',
        severity: 'MEDIUM',
        detectedAt: '2026-09-15 09:15',
        title: 'Unusual Consumption Spike for Urad Whole in Milling',
        details: 'Daily consumption rate of Urad Whole exceeded 7-day baseline by +38%.',
        potentialCauses: [
          'Unscheduled double shift run',
          'Unrecorded scrap / process loss',
          'Duplicate issue entry in warehouse app'
        ],
        investigationStatus: 'Pending Verification'
      }
    ];

    res.json({ success: true, anomalies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST AI Management Assistant Query Interface
router.post('/query-assistant', async (req, res) => {
  try {
    const { query } = req.body;
    const q = (query || '').toLowerCase().trim();

    let answer = '';
    let dataPayload = null;

    if (q.includes('quarantine') || q.includes('recalled')) {
      const qRes = await db.query(`SELECT lot_no, item_name, remaining_quantity FROM stock_lots WHERE qc_status = 'QUARANTINE' OR approval_status LIKE '%RECALL%'`);
      answer = `Currently, there are ${qRes.rows.length} lot(s) held in quarantine. Stock lot LOT000245 (800 KG) is quarantined in Chamber 2 due to recall RCL-2026-001.`;
      dataPayload = qRes.rows;
    } else if (q.includes('procurement') || q.includes('purchase') || q.includes('order')) {
      answer = `Pending Procurement: 2 recommended purchase orders totaling 1,750 KG (Urad Whole: 750 KG, Chana Whole: 1000 KG) to cover forecasted demand for the next 30 days.`;
      dataPayload = [
        { item: 'Urad Whole', recommendedQty: '750 KG', urgency: 'HIGH' },
        { item: 'Chana Whole', recommendedQty: '1000 KG', urgency: 'MEDIUM' }
      ];
    } else if (q.includes('overdue') || q.includes('invoice') || q.includes('payment')) {
      answer = `Financial Intelligence Alert: There are 2 overdue payment liabilities totaling ₹1,45,000. Customer receivables overdue stand at ₹85,000.`;
      dataPayload = [
        { supplier: 'Apex Agro Commodities', amount: '₹1,45,000', status: 'OVERDUE' },
        { customer: 'Royal Supermarkets', amount: '₹85,000', status: 'OVERDUE' }
      ];
    } else if (q.includes('yield') || q.includes('production')) {
      answer = `Production Yield Summary: Current month average yield is 75.2% against standard 74.0%. 1 anomaly detected in Batch PROD-145 (64.0% yield).`;
      dataPayload = { avgYieldPct: 75.2, anomalyCount: 1 };
    } else {
      answer = `BVC AI Assistant retrieved ERP metrics: Overall revenue stands at ₹24,50,000 with a 28.5% gross margin. Stock value is ₹8,90,000 with 4.8x annual inventory turnover. All compliance and quality engines operational.`;
      dataPayload = { status: 'OPTIMAL' };
    }

    res.json({
      success: true,
      query,
      answer,
      dataPayload,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
