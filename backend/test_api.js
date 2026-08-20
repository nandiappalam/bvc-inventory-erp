const axios = require('axios')

const baseURL = 'http://localhost:3000/api/masters'

async function testAPI() {
  const endpoints = [
    'city_master',
    'area_master',
    'supplier_master',
    'customer_master',
    'consignee_group_master',
    'ptrans_master',
    'papad_company_master',
    'flour_mill_master',
    'weightmaster',
    'ledgermaster'
  ]

  console.log('Testing Master API Endpoints...\n')

  for (const endpoint of endpoints) {
    try {
      console.log(`Testing ${endpoint}:`)
      const response = await axios.get(`${baseURL}/${endpoint}`)
      console.log(`  ✓ GET ${endpoint}: ${response.status} - ${response.data.length} records`)

      // Test POST with sample data
      const sampleData = getSampleData(endpoint)
      if (sampleData) {
        try {
          const postResponse = await axios.post(`${baseURL}/${endpoint}`, sampleData)
          console.log(`  ✓ POST ${endpoint}: ${postResponse.status}`)

          // Test DELETE if POST succeeded
          if (postResponse.data.id) {
            const deleteResponse = await axios.delete(`${baseURL}/${endpoint}/${postResponse.data.id}`)
            console.log(`  ✓ DELETE ${endpoint}: ${deleteResponse.status}`)
          }
        } catch (postError) {
          console.log(`  ✗ POST ${endpoint}: ${postError.response?.status} - ${postError.response?.data?.message}`)
        }
      }

      console.log('')
    } catch (error) {
      console.log(`  ✗ GET ${endpoint}: ${error.response?.status} - ${error.response?.data?.message || error.message}`)
      console.log('')
    }
  }
}

function getSampleData(endpoint) {
  const samples = {
    city_master: { name: 'Test City', print_name: 'Test City Print', status: 'Active' },
    area_master: { name: 'Test Area', print_name: 'Test Area Print', status: 'Active' },
    supplier_master: { name: 'Test Supplier', print_name: 'Test Supplier Print', contact_person: 'John Doe', address1: '123 Test St', phone_off: '1234567890', mobile1: '9876543210', area: 'Test Area', opening_balance: 1000 },
    customer_master: { name: 'Test Customer', print_name: 'Test Customer Print', contact_person: 'Jane Doe', address1: '456 Test Ave', phone_off: '0987654321', mobile1: '1234567890', area: 'Test Area', opening_balance: 500 },
    consignee_group_master: { name: 'Test Consignee', print_name: 'Test Consignee Print', contact_person: 'Bob Smith', address: '789 Test Blvd', area: 'Test Area', phone_res: '1112223333', mobile: '4445556666', tin_no: 'TIN123', status: 'Active' },
    ptrans_master: { name: 'Test PTrans', print_name: 'Test PTrans Print', status: 'Active' },
    papad_company_master: { name: 'Test Papad Company', print_name: 'Test Papad Print', contact_person: 'Alice Johnson', address1: '321 Test Rd', area: 'Test Area', phone_off: '7778889999', mobile1: '0001112222', opening_balance: 2000, opening_advance: 500 },
    flour_mill_master: { flourmill: 'Test Flour Mill', print_name: 'Test Mill Print', contact_person: 'Charlie Brown', address1: '654 Test Ln', area: 'Test Area', phone_off: '3334445555', mobile1: '6667778888', wages_kg: 10, opening_balance: 1500 },
    weightmaster: { name: 'Test Weight', printname: 'Test Weight Print', weight: 100 },
    ledgermaster: { name: 'Test Ledger', printname: 'Test Ledger Print', under: 'Assets', openingbalance: 1000, area: 'Test Area', credit: 0, debit: 1000 }
  }

  return samples[endpoint]
}

testAPI().catch(console.error)
