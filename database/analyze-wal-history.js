const fs = require('fs');

function analyze(file) {
  const data = fs.readFileSync(file);

  const pageSize = data.readUInt32BE(8);
  const frameSize = 24 + pageSize;
  const frameCount = Math.floor((data.length - 32) / frameSize);

  console.log('\n====================================================');
  console.log(file);
  console.log('Frames:', frameCount);

  let commits = [];

  for (let i = 0; i < frameCount; i++) {
    const offset = 32 + i * frameSize;

    const pageNumber = data.readUInt32BE(offset);
    const dbSize = data.readUInt32BE(offset + 4);

    if (dbSize !== 0) {
      commits.push({
        frame: i + 1,
        page: pageNumber,
        dbSize
      });
    }
  }

  console.log('\nCOMMIT FRAMES:');
  console.table(commits);

  console.log('\nLAST 30 FRAMES:');

  const start = Math.max(0, frameCount - 30);

  for (let i = start; i < frameCount; i++) {
    const offset = 32 + i * frameSize;

    const pageNumber = data.readUInt32BE(offset);
    const dbSize = data.readUInt32BE(offset + 4);

    console.log(
      `Frame ${i + 1}: page=${pageNumber}, dbSize=${dbSize}`
    );
  }

  const pageCounts = {};

  for (let i = 0; i < frameCount; i++) {
    const offset = 32 + i * frameSize;
    const pageNumber = data.readUInt32BE(offset);

    pageCounts[pageNumber] = (pageCounts[pageNumber] || 0) + 1;
  }

  console.log('\nUNIQUE DATABASE PAGES IN WAL:');
  console.log(Object.keys(pageCounts).length);

  const sorted = Object.entries(pageCounts)
    .map(([page, count]) => ({
      page: Number(page),
      frames: count
    }))
    .sort((a, b) => a.page - b.page);

  console.table(sorted);
}

analyze('./database/company_2.db-wal');
analyze('./database/company_2.recovery_work.db-wal');
