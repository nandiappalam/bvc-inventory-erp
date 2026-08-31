const db = require('./config/database')

const seedMasterData = async () => {
  try {
    console.log('Starting master data seed process...')
    console.log('')
    
    // Get company ID
    const companies = await db.query('SELECT id FROM companies LIMIT 1')
    const companyId = companies.rows.length > 0 ? companies.rows[0].id : 1
    console.log('Using company ID:', companyId)
    
    // ==================== ITEM GROUPS ====================
    console.log('Seeding item groups...')
    const itemGroups = [
      { group_code: 'FLOUR', group_name: 'Flour', print_name: 'Flour', tax: 0 },
      { group_code: 'GRAINS', group_name: 'Grains', print_name: 'Grains', tax: 0 },
      { group_code: 'PAPAD', group_name: 'Papad', print_name: 'Papad', tax: 12 },
      { group_code: 'PACKING', group_name: 'Packing Material', print_name: 'Packing Material', tax: 18 },
      { group_code: 'WASTE', group_name: 'Waste/Byproduct', print_name: 'Waste/Byproduct', tax: 0 }
    ]
    
    for (const group of itemGroups) {
      try {
        await db.run(
          'INSERT INTO item_groups (group_code, group_name, print_name, tax) VALUES (?, ?, ?, ?)',
          [group.group_code, group.group_name, group.print_name, group.tax]
        )
        console.log(`  Added: ${group.group_name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${group.group_name}`)
        } else {
          console.log(`  Error: ${e.message}`)
        }
      }
    }
    
    // ==================== ITEMS ====================
    console.log('Seeding items...')
    const items = [
      { item_code: 'FLOUR001', item_name: 'Maida', print_name: 'Maida', item_group: 'Flour', tax: 0, hsn_code: '1101' },
      { item_code: 'FLOUR002', item_name: 'Atta', print_name: 'Atta', item_group: 'Flour', tax: 0, hsn_code: '1101' },
      { item_code: 'FLOUR003', item_name: 'Rava', print_name: 'Rava', item_group: 'Flour', tax: 0, hsn_code: '1101' },
      { item_code: 'FLOUR004', item_name: 'Besan', print_name: 'Besan', item_group: 'Flour', tax: 0, hsn_code: '1101' },
      { item_code: 'GRAINS001', item_name: 'Wheat', print_name: 'Wheat', item_group: 'Grains', tax: 0, hsn_code: '1001' },
      { item_code: 'GRAINS002', item_name: 'Rice', print_name: 'Rice', item_group: 'Grains', tax: 0, hsn_code: '1006' },
      { item_code: 'GRAINS003', item_name: 'Maize', print_name: 'Maize', item_group: 'Grains', tax: 0, hsn_code: '1005' },
      { item_code: 'PAPAD001', item_name: 'Papad Plain', print_name: 'Papad Plain', item_group: 'Papad', tax: 12, hsn_code: '190590' },
      { item_code: 'PAPAD002', item_name: 'Papad Masala', print_name: 'Papad Masala', item_group: 'Papad', tax: 12, hsn_code: '190590' },
      { item_code: 'PAPAD003', item_name: 'Papad Black Pepper', print_name: 'Papad Black Pepper', item_group: 'Papad', tax: 12, hsn_code: '190590' },
      { item_code: 'PACK001', item_name: 'Plastic Bag Small', print_name: 'Plastic Bag Small', item_group: 'Packing Material', tax: 18, hsn_code: '3923' },
      { item_code: 'PACK002', item_name: 'Plastic Bag Large', print_name: 'Plastic Bag Large', item_group: 'Packing Material', tax: 18, hsn_code: '3923' },
      { item_code: 'PACK003', item_name: 'Carton Box', print_name: 'Carton Box', item_group: 'Packing Material', tax: 18, hsn_code: '4819' }
    ]
    
    for (const item of items) {
      try {
        await db.run(
          'INSERT INTO item_master (item_code, item_name, print_name, item_group, tax, hsn_code, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [item.item_code, item.item_name, item.print_name, item.item_group, item.tax, item.hsn_code, 'Active']
        )
        console.log(`  Added: ${item.item_name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${item.item_name}`)
        } else {
          console.log(`  Error: ${e.message}`)
        }
      }
    }
    
    // ==================== AREAS ====================
    console.log('Seeding areas...')
    const areas = [
      { name: 'MG Road', print_name: 'M.G. Road' },
      { name: 'Station Road', print_name: 'Station Road' },
      { name: 'Civil Lines', print_name: 'Civil Lines' },
      { name: 'Market Road', print_name: 'Market Road' },
      { name: 'Industrial Area', print_name: 'Industrial Area' },
      { name: 'Gandhi Chowk', print_name: 'Gandhi Chowk' },
      { name: 'Nehru Road', print_name: 'Nehru Road' },
      { name: 'Subhash Nagar', print_name: 'Subhash Nagar' }
    ]
    
    for (const area of areas) {
      try {
        await db.run(
          'INSERT INTO area_master (name, print_name, status) VALUES (?, ?, ?)',
          [area.name, area.print_name, 'Active']
        )
        console.log(`  Added: ${area.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${area.name}`)
        }
      }
    }
    
    // ==================== CITIES ====================
    console.log('Seeding cities...')
    const cities = [
      { name: 'Mumbai', print_name: 'Mumbai' },
      { name: 'Delhi', print_name: 'Delhi' },
      { name: 'Pune', print_name: 'Pune' },
      { name: 'Ahmedabad', print_name: 'Ahmedabad' },
      { name: 'Surat', print_name: 'Surat' },
      { name: 'Bangalore', print_name: 'Bangalore' },
      { name: 'Hyderabad', print_name: 'Hyderabad' },
      { name: 'Chennai', print_name: 'Chennai' },
      { name: 'Kolkata', print_name: 'Kolkata' },
      { name: 'Jaipur', print_name: 'Jaipur' }
    ]
    
    for (const city of cities) {
      try {
        await db.run(
          'INSERT INTO city_master (name, print_name, status) VALUES (?, ?, ?)',
          [city.name, city.print_name, 'Active']
        )
        console.log(`  Added: ${city.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${city.name}`)
        }
      }
    }
    
    // ==================== TRANSPORT ====================
    console.log('Seeding transport...')
    const transports = [
      { name: 'Gujarat Transport', print_name: 'Gujarat Transport' },
      { name: 'Orange Transport', print_name: 'Orange Transport' },
      { name: 'VRL Logistics', print_name: 'VRL Logistics' },
      { name: 'Ashok Leyland Transport', print_name: 'Ashok Leyland Transport' },
      { name: 'Tata Motors Transport', print_name: 'Tata Motors Transport' },
      { name: 'Self Transport', print_name: 'Self Transport' }
    ]
    
    for (const t of transports) {
      try {
        await db.run(
          'INSERT INTO transport_master (name, print_name, status) VALUES (?, ?, ?)',
          [t.name, t.print_name, 'Active']
        )
        console.log(`  Added: ${t.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${t.name}`)
        }
      }
    }
    
    // ==================== P TRANS ====================
    console.log('Seeding p_trans...')
    const ptrans = [
      { name: 'FTL', print_name: 'Full Truck Load' },
      { name: 'LTL', print_name: 'Less Than Truck Load' },
      { name: 'Express', print_name: 'Express Delivery' }
    ]
    
    for (const pt of ptrans) {
      try {
        await db.run(
          'INSERT INTO ptrans_master (name, print_name, status) VALUES (?, ?, ?)',
          [pt.name, pt.print_name, 'Active']
        )
        console.log(`  Added: ${pt.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${pt.name}`)
        }
      }
    }
    
    // ==================== SUPPLIERS ====================
    console.log('Seeding suppliers...')
    const suppliers = [
      { name: 'Shakti Grain Suppliers', print_name: 'Shakti Grain Suppliers', contact_person: 'Rajesh Kumar', address1: '45 Market Road', gst_number: '27AAFPU1234A1Z5', mobile1: '9876543210', area: 'Market Road', opening_balance: 50000 },
      { name: 'Maharashtra Wheat Co', print_name: 'Maharashtra Wheat Co', contact_person: 'Suresh Patel', address1: '78 Station Road', gst_number: '27AABCM5678A1Z3', mobile1: '9876543211', area: 'Station Road', opening_balance: 75000 },
      { name: 'Gujarat Rice Mill', print_name: 'Gujarat Rice Mill', contact_person: 'Anil Shah', address1: '123 Industrial Area', gst_number: '24AAACG9012A1Z9', mobile1: '9876543212', area: 'Industrial Area', opening_balance: 100000 },
      { name: 'Premium Grains Pvt Ltd', print_name: 'Premium Grains Pvt Ltd', contact_person: 'Deepak Jain', address1: '56 MG Road', gst_number: '27AABCP3456A1Z7', mobile1: '9876543213', area: 'MG Road', opening_balance: 60000 },
      { name: 'Aone Food Products', print_name: 'Aone Food Products', contact_person: 'Mohan Reddy', address1: '89 Civil Lines', gst_number: '27AABCA7890A1Z1', mobile1: '9876543214', area: 'Civil Lines', opening_balance: 45000 }
    ]
    
    for (const sup of suppliers) {
      try {
        await db.run(
          'INSERT INTO supplier_master (name, print_name, contact_person, address1, gst_number, mobile1, area, opening_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [sup.name, sup.print_name, sup.contact_person, sup.address1, sup.gst_number, sup.mobile1, sup.area, sup.opening_balance, 'Active']
        )
        console.log(`  Added: ${sup.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${sup.name}`)
        }
      }
    }
    
    // ==================== CUSTOMERS ====================
    console.log('Seeding customers...')
    const customers = [
      { name: 'Big Basket Stores', print_name: 'Big Basket Stores', contact_person: 'Arun Sharma', address1: '100 MG Road, Mumbai', gst_number: '27AABCB1234A1Z5', mobile1: '9876543215', area: 'MG Road', opening_balance: 30000 },
      { name: 'Reliance Fresh', print_name: 'Reliance Fresh', contact_person: 'Vijay Kumar', address1: '200 Station Road, Pune', gst_number: '27AABCR5678A1Z3', mobile1: '9876543216', area: 'Station Road', opening_balance: 50000 },
      { name: 'DMart Supermart', print_name: 'DMart Supermart', contact_person: 'Rahul Mehta', address1: '300 Civil Lines, Ahmedabad', gst_number: '24AABCD9012A1Z9', mobile1: '9876543217', area: 'Civil Lines', opening_balance: 80000 },
      { name: 'Star Hypermarket', print_name: 'Star Hypermarket', contact_person: 'Sanjay Gupta', address1: '400 Market Road, Surat', gst_number: '24AABCS3456A1Z7', mobile1: '9876543218', area: 'Market Road', opening_balance: 60000 },
      { name: 'More Supermarket', print_name: 'More Supermarket', contact_person: 'Prakash Joshi', address1: '500 Industrial Area, Bangalore', gst_number: '29AABCM7890A1Z1', mobile1: '9876543219', area: 'Industrial Area', opening_balance: 40000 },
      { name: 'Heritage Fresh', print_name: 'Heritage Fresh', contact_person: 'Harish Nair', address1: '600 Gandhi Chowk, Chennai', gst_number: '33AABCH2345A1Z5', mobile1: '9876543220', area: 'Gandhi Chowk', opening_balance: 35000 },
      { name: 'Spencer\'s Retail', print_name: 'Spencer\'s Retail', contact_person: 'Karthik Raj', address1: '700 Nehru Road, Hyderabad', gst_number: '36AABCS6789A1Z3', mobile1: '9876543221', area: 'Nehru Road', opening_balance: 55000 }
    ]
    
    for (const cust of customers) {
      try {
        await db.run(
          'INSERT INTO customer_master (name, print_name, contact_person, address1, gst_number, mobile1, area, opening_balance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [cust.name, cust.print_name, cust.contact_person, cust.address1, cust.gst_number, cust.mobile1, cust.area, cust.opening_balance, 'Active']
        )
        console.log(`  Added: ${cust.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${cust.name}`)
        }
      }
    }
    
    // ==================== FLOUR MILLS ====================
    console.log('Seeding flour mills...')
    const flourMills = [
      { flourmill: 'Shakti Flour Mill', print_name: 'Shakti Flour Mill', contact_person: 'Mahesh Patel', address1: '25 Industrial Estate', gst_number: '24AABCF1234A1Z5', mobile1: '9876543222', wages_kg: 2.5 },
      { flourmill: 'Balaji Atta Company', print_name: 'Balaji Atta Company', contact_person: 'Rajendra Singh', address1: '36 Grain Market', gst_number: '27AABCU5678A1Z3', mobile1: '9876543223', wages_kg: 2.75 },
      { flourmill: 'Premium Flour Products', print_name: 'Premium Flour Products', contact_person: 'Vikram Kumar', address1: '48 Processing Zone', gst_number: '29AABCV9012A1Z9', mobile1: '9876543224', wages_kg: 3.0 }
    ]
    
    for (const fm of flourMills) {
      try {
        await db.run(
          'INSERT INTO flour_mill_master (flourmill, print_name, contact_person, address1, gst_number, mobile1, wages_kg, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [fm.flourmill, fm.print_name, fm.contact_person, fm.address1, fm.gst_number, fm.mobile1, fm.wages_kg, 'Active']
        )
        console.log(`  Added: ${fm.flourmill}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${fm.flourmill}`)
        }
      }
    }
    
    // ==================== PAPAD COMPANIES ====================
    console.log('Seeding papad companies...')
    const papadCompanies = [
      { name: 'Lijjat Papad', print_name: 'Lijjat Papad', contact_person: 'Kamlesh Bhai', address1: 'Mumbai', gst_number: '27AAACL1234A1Z5', mobile1: '9876543225', wages_kg: 1.5, opening_advance: 100000 },
      { name: 'Mohan Papad', print_name: 'Mohan Papad', contact_person: 'Mohan Bhai', address1: 'Surat', gst_number: '24AABCM5678A1Z3', mobile1: '9876543226', wages_kg: 1.75, opening_advance: 80000 },
      { name: 'Bharat Papad', print_name: 'Bharat Papad', contact_person: 'Bharat Bhai', address1: 'Ahmedabad', gst_number: '24AABCB9012A1Z9', mobile1: '9876543227', wages_kg: 1.6, opening_advance: 90000 },
      { name: 'Patel Papad', print_name: 'Patel Papad', contact_person: 'Patel Bhai', address1: 'Rajkot', gst_number: '24AABCP3456A1Z7', mobile1: '9876543228', wages_kg: 1.8, opening_advance: 75000 },
      { name: 'Shree Papad', print_name: 'Shree Papad', contact_person: 'Shree Bhai', address1: 'Baroda', gst_number: '24AABCS7890A1Z1', mobile1: '9876543229', wages_kg: 1.65, opening_advance: 85000 }
    ]
    
    for (const pc of papadCompanies) {
      try {
        await db.run(
          'INSERT INTO papad_company_master (name, print_name, contact_person, address1, gst_no, mobile1, wages_kg, opening_advance, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [pc.name, pc.print_name, pc.contact_person, pc.address1, pc.gst_number, pc.mobile1, pc.wages_kg, pc.opening_advance, 'Active']
        )
        console.log(`  Added: ${pc.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${pc.name}`)
        }
      }
    }
    
    // ==================== LEDGER GROUPS ====================
    console.log('Seeding ledger groups...')
    const ledgerGroups = [
      { name: 'Cash', printname: 'Cash', under: 'Cash' },
      { name: 'Bank Accounts', printname: 'Bank Accounts', under: 'Bank Accounts' },
      { name: 'Sundry Debtors', printname: 'Sundry Debtors', under: 'Sundry Debtors' },
      { name: 'Sundry Creditors', printname: 'Sundry Creditors', under: 'Sundry Creditors' },
      { name: 'Sales Accounts', printname: 'Sales Accounts', under: 'Sales Accounts' },
      { name: 'Purchase Accounts', printname: 'Purchase Accounts', under: 'Purchase Accounts' },
      { name: 'Direct Incomes', printname: 'Direct Incomes', under: 'Direct Incomes' },
      { name: 'Direct Expenses', printname: 'Direct Expenses', under: 'Direct Expenses' },
      { name: 'Indirect Incomes', printname: 'Indirect Incomes', under: 'Indirect Incomes' },
      { name: 'Indirect Expenses', printname: 'Indirect Expenses', under: 'Indirect Expenses' }
    ]
    
    for (const lg of ledgerGroups) {
      try {
        await db.run(
          'INSERT INTO ledgergroupmaster (name, printname, under) VALUES (?, ?, ?)',
          [lg.name, lg.printname, lg.under]
        )
        console.log(`  Added: ${lg.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${lg.name}`)
        }
      }
    }
    
    // ==================== LEDGERS ====================
    console.log('Seeding ledgers...')
    const ledgers = [
      { name: 'Cash', printname: 'Cash', under: 'Cash', openingbalance: 100000 },
      { name: 'Bank of Baroda', printname: 'Bank of Baroda', under: 'Bank Accounts', openingbalance: 500000 },
      { name: 'HDFC Bank', printname: 'HDFC Bank', under: 'Bank Accounts', openingbalance: 300000 },
      { name: 'Sales Account', printname: 'Sales Account', under: 'Sales Accounts', openingbalance: 0 },
      { name: 'Purchase Account', printname: 'Purchase Account', under: 'Purchase Accounts', openingbalance: 0 },
      { name: 'Input Tax', printname: 'Input Tax', under: 'Indirect Expenses', openingbalance: 0 },
      { name: 'Output Tax', printname: 'Output Tax', under: 'Indirect Incomes', openingbalance: 0 },
      { name: 'Discount Received', printname: 'Discount Received', under: 'Direct Incomes', openingbalance: 0 },
      { name: 'Discount Allowed', printname: 'Discount Allowed', under: 'Direct Expenses', openingbalance: 0 },
      { name: 'Rent Expense', printname: 'Rent Expense', under: 'Indirect Expenses', openingbalance: 0 },
      { name: 'Salary Expense', printname: 'Salary Expense', under: 'Indirect Expenses', openingbalance: 0 },
      { name: 'Interest Income', printname: 'Interest Income', under: 'Indirect Incomes', openingbalance: 0 }
    ]
    
    for (const led of ledgers) {
      try {
        await db.run(
          'INSERT INTO ledgermaster (name, printname, under, openingbalance, status) VALUES (?, ?, ?, ?, ?)',
          [led.name, led.printname, led.under, led.openingbalance, 'Active']
        )
        console.log(`  Added: ${led.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${led.name}`)
        }
      }
    }
    
    // ==================== DEDUCTION SALES ====================
    console.log('Seeding deduction sales...')
    const deductionSales = [
      { ded_code: 'DS001', ded_name: 'TCS on Sales', print_name: 'TCS on Sales', adjust_with_sales: 'Yes', account_head: 'Tax Expense', ded_type: 'Percentage', calc_type: 'After Tax', ded_value: 0.1 },
      { ded_code: 'DS002', ded_name: 'TDS on Sales', print_name: 'TDS on Sales', adjust_with_sales: 'Yes', account_head: 'Tax Expense', ded_type: 'Percentage', calc_type: 'Before Tax', ded_value: 2 },
      { ded_code: 'DS003', ded_name: 'Commission', print_name: 'Commission', adjust_with_sales: 'Yes', account_head: 'Commission Paid', ded_type: 'Percentage', calc_type: 'After Tax', ded_value: 5 },
      { ded_code: 'DS004', ded_name: 'Freight Recovery', print_name: 'Freight Recovery', adjust_with_sales: 'No', account_head: 'Transport Income', ded_type: 'Fixed', calc_type: 'Manual', ded_value: 0 }
    ]
    
    for (const ds of deductionSales) {
      try {
        await db.run(
          'INSERT INTO deduction_sales (ded_code, ded_name, print_name, adjust_with_sales, account_head, ded_type, calc_type, ded_value, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [ds.ded_code, ds.ded_name, ds.print_name, ds.adjust_with_sales, ds.account_head, ds.ded_type, ds.calc_type, ds.ded_value, 'Active']
        )
        console.log(`  Added: ${ds.ded_name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${ds.ded_name}`)
        }
      }
    }
    
    // ==================== DEDUCTION PURCHASE ====================
    console.log('Seeding deduction purchase...')
    const deductionPurchase = [
      { ded_code: 'DP001', ded_name: 'TCS on Purchase', print_name: 'TCS on Purchase', debit_adjust: 'Yes', account_head: 'Tax Expense', credit_adjust: 'No', ded_type: 'Percentage', calc_type: 'After Tax', ded_value: 0.1 },
      { ded_code: 'DP002', ded_name: 'TDS on Purchase', print_name: 'TDS on Purchase', debit_adjust: 'Yes', account_head: 'Tax Expense', credit_adjust: 'No', ded_type: 'Percentage', calc_type: 'Before Tax', ded_value: 2 },
      { ded_code: 'DP003', ded_name: 'Freight Deduction', print_name: 'Freight Deduction', debit_adjust: 'No', account_head: 'Transport Expense', credit_adjust: 'Yes', ded_type: 'Fixed', calc_type: 'Manual', ded_value: 0 },
      { ded_code: 'DP004', ded_name: 'Loading Deduction', print_name: 'Loading Deduction', debit_adjust: 'No', account_head: 'Loading Charges', credit_adjust: 'Yes', ded_type: 'Fixed', calc_type: 'Manual', ded_value: 0 }
    ]
    
    for (const dp of deductionPurchase) {
      try {
        await db.run(
          'INSERT INTO deduction_purchase (ded_code, ded_name, print_name, debit_adjust, account_head, credit_adjust, ded_type, calc_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [dp.ded_code, dp.ded_name, dp.print_name, dp.debit_adjust, dp.account_head, dp.credit_adjust, dp.ded_type, dp.calc_type, 'Active']
        )
        console.log(`  Added: ${dp.ded_name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${dp.ded_name}`)
        }
      }
    }
    
    // ==================== WEIGHT MASTER ====================
    console.log('Seeding weights...')
    const weights = [
      { name: '500 GM', printname: '500 GM', weight: 0.5 },
      { name: '1 KG', printname: '1 KG', weight: 1 },
      { name: '2 KG', printname: '2 KG', weight: 2 },
      { name: '5 KG', printname: '5 KG', weight: 5 },
      { name: '10 KG', printname: '10 KG', weight: 10 },
      { name: '20 KG', printname: '20 KG', weight: 20 },
      { name: '25 KG', printname: '25 KG', weight: 25 },
      { name: '50 KG', printname: '50 KG', weight: 50 }
    ]
    
    for (const w of weights) {
      try {
        await db.run(
          'INSERT INTO weightmaster (name, printname, weight) VALUES (?, ?, ?)',
          [w.name, w.printname, w.weight]
        )
        console.log(`  Added: ${w.name}`)
      } catch (e) {
        if (e.message.includes('UNIQUE constraint failed')) {
          console.log(`  Already exists: ${w.name}`)
        }
      }
    }
    
    console.log('')
    console.log('========================================')
    console.log('✅ Master data seeding completed!')
    console.log('========================================')
    console.log('')
    console.log('Summary:')
    console.log('- Item Groups: 5')
    console.log('- Items: 13')
    console.log('- Areas: 8')
    console.log('- Cities: 10')
    console.log('- Transport: 6')
    console.log('- P-Trans: 3')
    console.log('- Suppliers: 5')
    console.log('- Customers: 7')
    console.log('- Flour Mills: 3')
    console.log('- Papad Companies: 5')
    console.log('- Ledger Groups: 10')
    console.log('- Ledgers: 12')
    console.log('- Deduction Sales: 4')
    console.log('- Deduction Purchase: 4')
    console.log('- Weights: 8')
    console.log('')
    
    process.exit(0)
  } catch (error) {
    console.error('Seed error:', error)
    process.exit(1)
  }
}

seedMasterData()
