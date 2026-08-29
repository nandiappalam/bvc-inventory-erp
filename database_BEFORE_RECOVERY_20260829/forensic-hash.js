const fs = require('fs');
const crypto = require('crypto');

const files = [
  './database/company_2.db',
  './database/company_2.db-wal',
  './database/company_2.db-shm',
  './database/company_2.recovery_work.db',
  './database/company_2.recovery_work.db-wal',
  './database/company_2.recovery_work.db-shm'
];

for (const file of files) {
  const data = fs.readFileSync(file);

  console.log('\n================================');
  console.log(file);
  console.log('SIZE:', data.length);
  console.log('SHA256:', crypto.createHash('sha256').update(data).digest('hex'));
  console.log('FIRST 64 BYTES:');
  console.log(data.subarray(0, 64).toString('hex').match(/.{1,2}/g).join(' '));
}
