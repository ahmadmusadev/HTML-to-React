const fs=require('fs');
const html=fs.readFileSync('../edit.html', 'utf8');
const lines=html.split('\n');
lines.forEach((l, i) => {
  if (l.includes('کل طلباء') || l.includes('فی الوقت طلباء')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
