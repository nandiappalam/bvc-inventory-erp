const http = require('http');

const data = JSON.stringify({ vehicle_no: "TEST001" });
const opts = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/vehicle-movements',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(opts, (res) => {
  let d = '';
  res.on('data', (c) => { d += c; });
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Body:', d);
  });
});

req.on('error', (e) => { console.log('Error:', e.message); });
req.write(data);
req.end();
