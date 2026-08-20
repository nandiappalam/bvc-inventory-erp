# Godown Fields Addition - TODO

## Task
Add Mobile, Email, Web, and GST No input fields to the Godown create page.

## Steps
- [x] 1. Update `frontend/src/utils/masterConfig.js` - Add new fields to godown config
- [x] 2. Update `backend/routes/masters.js` - Add new fields to godown_master fields array
- [x] 3. Update `database/schema.sql` - Add new columns to godown_master table
- [x] 4. Update `backend/autoMigrate.js` - Add migration for new columns
- [x] 5. Verify GodownCreate.jsx and GodownDisplay.jsx work without changes


in Deduction purchase create page is need to add some input filed, Affect Cost of Goods: " Yes and No" option, Type: "Add and Less", Debit side adjust: "Supplier, A/c Head and None",  Account Head, Credit Side Adjust:"Supplier, A/c Head and None,Deductuion Type:"Add and Less", Deduction Calculation type:" Percentage and Amount" , Deduction Value, status.                                  1. in godown creation page is need to add some input field, Contact person, address, Phone(off), Area.
2. in Deduction purchase create page is need to add some input filed, Affect Cost of Goods: " Yes and No" option, Type: "Add and Less", Debit side adjust: "Supplier, A/c Head and None",  Account Head, Credit Side Adjust:"Supplier, A/c Head and None,Deductuion Type:"Add and Less", Deduction Calculation type:" Percentage and Amount" , Deduction Value, status.   .                                                                                           3.  in customer and supplier both  create page is need to modify based on this: Customer  or supplier name, print name , contact person, address, phone(res), phone(off), Mobile, Email, GST No, Area, Transport, Limit days, Limit Amount, Opening balance, balance type:" Dr and Cr" and status.                                                                                                                                     4. in ledger create page is need to modify based on this, Ledger Name, Print name, Alias Name, Group Under dropdown, opening balance, opening type:"Dr and Cr" and ledger Type:"supplier, Customer and general". remove area in the display table.                                                                                                                                                       5. In flour mill creation page is this input fields are need to implement, Flour Mill Name, Print Name, Contact Person, Address, Area, Phone(Res), Phone (Off), Mobile, TIN no, Wages/Kg, Opening balance, Opening Balance Type:"Dr and Cr" and status
6. in ledger group create page add Group under dropdown.