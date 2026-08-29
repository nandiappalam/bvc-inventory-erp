const fs = require('fs');

const walPath = './database/company_2.db-wal';

const buffer = fs.readFileSync(walPath);

const pageSize = buffer.readUInt32BE(8);
const frameSize = 24 + pageSize;
const frameCount = Math.floor((buffer.length - 32) / frameSize);

console.log('==============================================');
console.log('WAL PAGE CONTENT INSPECTION');
console.log('==============================================');

console.log('WAL:', walPath);
console.log('SIZE:', buffer.length);
console.log('PAGE SIZE:', pageSize);
console.log('FRAME COUNT:', frameCount);

const interestingPages = new Map();

for (let i = 0; i < frameCount; i++) {

  const offset = 32 + i * frameSize;

  const pageNumber = buffer.readUInt32BE(offset);
  const dbSize = buffer.readUInt32BE(offset + 4);

  const pageDataStart = offset + 24;
  const pageDataEnd = pageDataStart + pageSize;

  const pageData = buffer.subarray(pageDataStart, pageDataEnd);

  interestingPages.set(pageNumber, {
    frame: i + 1,
    dbSize,
    data: pageData
  });
}

console.log('\nUNIQUE PAGES:', interestingPages.size);

for (const [pageNumber, info] of interestingPages) {

  const data = info.data;

  const firstBytes = [...data.subarray(0, 32)]
    .map(x => x.toString(16).padStart(2, '0'))
    .join(' ');

  const ascii = [...data.subarray(0, 128)]
    .map(x => (x >= 32 && x <= 126) ? String.fromCharCode(x) : '.')
    .join('');

  console.log('\n----------------------------------------------');
  console.log(`PAGE ${pageNumber}`);
  console.log(`LAST FRAME: ${info.frame}`);
  console.log(`DB SIZE: ${info.dbSize}`);
  console.log('FIRST 32 BYTES:');
  console.log(firstBytes);
  console.log('ASCII PREVIEW:');
  console.log(ascii);
}

console.log('\n==============================================');
console.log('WAL PAGE INSPECTION COMPLETE');
console.log('==============================================');

