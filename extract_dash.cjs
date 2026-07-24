const fs=require('fs');
const cheerio=require('cheerio');
const html=fs.readFileSync('../edit.html', 'utf8');
const $=cheerio.load(html);
fs.writeFileSync('dashboard.html', $('#tab-dashboard').html() || '');
