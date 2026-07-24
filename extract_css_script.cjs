const fs=require('fs');
const cheerio=require('cheerio');
const html=fs.readFileSync('../edit.html', 'utf8');
const $=cheerio.load(html);
let css = '';
$('style').each((i, el) => {
    css += $(el).html() + '\n';
});
fs.writeFileSync('extracted_styles.css', css);
