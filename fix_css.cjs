const fs = require('fs');
let css = fs.readFileSync('src/pages/Dashboard.css', 'utf8');

css = css.replace(/background:\s*#fff/g, 'background: var(--card)')
         .replace(/background:\s*linear-gradient\(145deg, #f0f7ff, #e8f2fc\)/g, 'background: var(--bg)')
         .replace(/border:\s*1px solid #d4e6f5/g, 'border: 1px solid var(--border)')
         .replace(/background:\s*#fbfcff/g, 'background: var(--card)')
         .replace(/background:\s*#eef2f6/g, 'background: var(--bg)')
         .replace(/background:\s*#e9eef5/g, 'background: var(--border)')
         .replace(/background:\s*linear-gradient\(90deg, #0d3b66, #2b76c1\)/g, 'background: var(--accent)');

const darkModeCss = `

/* Dark Mode Monochromatic Overrides */
[data-theme="dark"] .dashboard-card.success,
[data-theme="dark"] .dashboard-card.warning,
[data-theme="dark"] .dashboard-card.danger,
[data-theme="dark"] .dashboard-card.info {
  border-top-color: var(--border);
}

[data-theme="dark"] .dashboard-card.success .card-number,
[data-theme="dark"] .dashboard-card.warning .card-number,
[data-theme="dark"] .dashboard-card.danger .card-number,
[data-theme="dark"] .dashboard-card.info .card-number {
  color: var(--accent);
}

[data-theme="dark"] .dashboard-hero {
  background: var(--card);
  box-shadow: none;
  border: 1px solid var(--border);
}

[data-theme="dark"] .dashboard-hero p,
[data-theme="dark"] .dashboard-hero h2,
[data-theme="dark"] .dashboard-badge {
  color: var(--accent) !important;
}

[data-theme="dark"] .dashboard-card::after {
  background: rgba(255,255,255,0.02);
}
`;

css += darkModeCss;
fs.writeFileSync('src/pages/Dashboard.css', css);
