const axios = require('axios');

async function testAPI() {
  console.log('Testing /api/companies endpoint...');
  
  try {
    // Try through localhost:3000 directly
    const response = await axios.get('http://localhost:3000/api/companies');
    console.log('Success! Response:', response.data);
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Backend server is NOT running on port 3000');
      console.log('   Please start the backend: node backend/server.js');
    } else if (error.response) {
      console.log('❌ Backend returned error:', error.response.status, error.response.data);
    } else {
      console.log('❌ Error:', error.message);
    }
  }
  
  // Also test through Vite proxy (port 5173)
  try {
    const response = await axios.get('http://localhost:5173/api/companies');
    console.log('\n✅ Via Vite proxy: Success!');
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('\n⚠️  Frontend Vite server not running on port 5173');
    } else if (error.response) {
      console.log('\n❌ Via Vite proxy - Backend error:', error.response.status);
    }
  }
  
  process.exit(0);
}

testAPI();
