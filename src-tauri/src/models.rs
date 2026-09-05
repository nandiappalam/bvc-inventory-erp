use serde::{Serialize, Deserialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleInput {
    pub customer_id: i32,
    pub date: String,
    pub items: Vec<SaleItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleItem {
    pub item_id: i32,
    pub qty: f64,
    pub rate: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseInput {
    pub supplier_id: i32,
    pub date: String,
    pub items: Vec<PurchaseItem>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PurchaseItem {
    pub item_id: i32,
    pub qty: f64,
    pub rate: f64,
}
