const fs = require('fs');

function readWal(file) {
  const data = fs.readFileSync(file);

  console.log('\n================================================');
  console.log(file);
  console.log('SIZE:', data.length);

  if (data.length < 32) {
    console.log('WAL too small');
    return;
  }

  console.log('\nWAL HEADER');

  console.log('Magic:', data.readUInt32BE(0).toString(16));
  console.log('Version:', data.readUInt32BE(4).toString(16));
  console.log('Page Size:', data.readUInt32BE(8));
  console.log('Checkpoint Sequence:', data.readUInt32BE(12));

  console.log(
    'Salt 1:',
    data.readUInt32BE(16).toString(16).padStart(8, '0')
  );

  console.log(
    'Salt 2:',
    data.readUInt32BE(20).toString(16).padStart(8, '0')
  );

  console.log(
    'Checksum 1:',
    data.readUInt32BE(24).toString(16).padStart(8, '0')
  );

  console.log(
    'Checksum 2:',
    data.readUInt32BE(28).toString(16).padStart(8, '0')
  );

  const pageSize = data.readUInt32BE(8);

  const frameSize = 24 + pageSize;

  console.log('\nFRAME SIZE:', frameSize);

  const frameCount = Math.floor((data.length - 32) / frameSize);

  console.log('FRAME COUNT:', frameCount);

  const remainder = (data.length - 32) % frameSize;

  console.log('REMAINDER:', remainder);

  console.log('\nFIRST 20 FRAMES');

  for (let i = 0; i < Math.min(frameCount, 20); i++) {
    const offset = 32 + i * frameSize;

    const pageNumber = data.readUInt32BE(offset);
    const dbSizeAfterCommit = data.readUInt32BE(offset + 4);

    const salt1 = data.readUInt32BE(offset + 8);
    const salt2 = data.readUInt32BE(offset + 12);

    console.log(
      `Frame ${i + 1}: page=${pageNumber}, dbSize=${dbSizeAfterCommit}, salt1=${salt1.toString(16)}, salt2=${salt2.toString(16)}`
    );
  }
}

readWal('./database/company_2.db-wal');

readWal('./database/company_2.recovery_work.db-wal');
