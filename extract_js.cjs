const fs=require('fs');
const cheerio=require('cheerio');
const html=fs.readFileSync('../edit.html', 'utf8');
const $=cheerio.load(html);
let js = '';
$('script').each((i, el) => {
    js += $(el).html() + '\n';
});
fs.writeFileSync('extracted_scripts.cjs', js);
