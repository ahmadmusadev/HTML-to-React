const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const htmlContent = fs.readFileSync(path.join(__dirname, '..', 'edit.html'), 'utf8');

// Use cheerio with lowerCaseAttributeNames set to false to prevent messing up camelCase SVGs if any
const $ = cheerio.load(htmlContent, { xmlMode: false, decodeEntities: false });

const tabs = [
    { id: 'tab-dashboard', name: 'Dashboard' },
    { id: 'tab-admissions', name: 'Admissions' },
    { id: 'tab-entry', name: 'Entry' },
    { id: 'tab-records', name: 'Records' },
    { id: 'tab-staff', name: 'Staff' },
    { id: 'tab-exams', name: 'Exams' },
    { id: 'tab-ai-listen', name: 'AiListen' },
    { id: 'tab-fees', name: 'Fees' },
    { id: 'tab-attendance', name: 'Attendance' }
];

const componentsDir = path.join(__dirname, 'src', 'pages');

function camelCaseStyle(styleStr) {
    if (!styleStr) return "{}";
    const styles = styleStr.split(';').filter(s => s.trim());
    const obj = {};
    styles.forEach(s => {
        const parts = s.split(':');
        if (parts.length >= 2) {
            let key = parts[0].trim();
            let value = parts.slice(1).join(':').trim();
            key = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            obj[key] = value;
        }
    });
    return JSON.stringify(obj);
}

tabs.forEach(tab => {
    const $tab = $(`#${tab.id}`);
    if ($tab.length > 0) {
        
        // Remove display:none from the main tab content wrapper if it exists, or just get its innerHTML
        // Actually, getting innerHTML is better since the Router handles visibility
        let html = $tab.html();
        
        // Convert class to className, for to htmlFor
        html = html.replace(/class=/g, 'className=');
        html = html.replace(/for=/g, 'htmlFor=');
        
        // Convert inline styles
        html = html.replace(/style="([^"]*)"/g, (match, styleString) => {
            return `style={${camelCaseStyle(styleString)}}`;
        });
        
        // Strip inline event handlers
        html = html.replace(/on[a-z]+="[^"]*"/gi, '');
        
        // Close self-closing tags
        const tagsToClose = ['input', 'img', 'br', 'hr', 'col'];
        tagsToClose.forEach(tag => {
            const regex = new RegExp(`<${tag}(?=\\s|/|>)([^>]*?)>`, 'gi');
            html = html.replace(regex, (match, attrs) => {
                if (match.endsWith('/>')) return match;
                return `<${tag}${attrs} />`;
            });
        });
        
        // Convert HTML comments to JSX comments
        html = html.replace(/<!--([\s\S]*?)-->/g, '{/* $1 */}');
        
        const fileContent = `import React from 'react';

export default function ${tab.name}() {
  return (
    <div className="tab-content">
      ${html}
    </div>
  );
}
`;
        fs.writeFileSync(path.join(componentsDir, `${tab.name}.jsx`), fileContent);
        console.log(`Generated ${tab.name}.jsx`);
    } else {
        console.log(`Tab ${tab.id} not found.`);
    }
});
