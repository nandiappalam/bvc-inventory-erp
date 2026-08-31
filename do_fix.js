const fs = require('fs');
const p = 'frontend/src/components/master/SmartField.jsx';
let c = fs.readFileSync(p, 'utf8');

const bad = '        <div className="uniform-input readonly-field">{finalValue || \'-\'}<\/div>\n    );';
const good = '        <div className="uniform-input readonly-field">{finalValue || \'-\'}<\/div>\n      <\/div>\n    );';

if (c.includes(bad)) {
  c = c.replace(bad, good);
  fs.writeFileSync(p, c);
  console.log('FIXED');
} else {
  console.log('NOT FOUND');
}

