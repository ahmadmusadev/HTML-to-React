const fs = require('fs');
const path = require('path');

const cssPath = path.join(__dirname, 'src', 'index.css');
let cssContent = fs.readFileSync(cssPath, 'utf8');

// Replacements for light mode (:root)
cssContent = cssContent.replace(/--bg: #f0f4f8;/g, '--bg: #f5f5f5;');
cssContent = cssContent.replace(/--card: #ffffff;/g, '--card: #ffffff;'); // already white, keeping it
cssContent = cssContent.replace(/--accent: #0d3b66;/g, '--accent: #111111;');
cssContent = cssContent.replace(/--accent-light: hsl\(209, 70%, 31%\);/g, '--accent-light: #333333;');
cssContent = cssContent.replace(/--accent-2: #1a6b3c;/g, '--accent-2: #000000;');
cssContent = cssContent.replace(/--muted: #64748b;/g, '--muted: #737373;');
cssContent = cssContent.replace(/--border: #e2e8f0;/g, '--border: #e5e5e5;');
cssContent = cssContent.replace(/color: #1e293b;/g, 'color: #111111;');

// Replacing dark mode overrides [data-theme="dark"]
cssContent = cssContent.replace(/--bg: #0b1220;/g, '--bg: #0d0d0d;');
cssContent = cssContent.replace(/--card: #0f1724;/g, '--card: #1a1a1a;');
cssContent = cssContent.replace(/--accent: #91b8ff;/g, '--accent: #ffffff;');
cssContent = cssContent.replace(/--accent-light: #5fa0ff;/g, '--accent-light: #e5e5e5;');
cssContent = cssContent.replace(/--accent-2: #34d399;/g, '--accent-2: #ffffff;');
cssContent = cssContent.replace(/--muted: #9aa6b2;/g, '--muted: #a3a3a3;');
cssContent = cssContent.replace(/--border: #1f2a37;/g, '--border: #333333;');

// Tab navigation requested by user earlier
cssContent = cssContent.replace(/\[data-theme="dark"\] nav.tabs {\s*background: #1e293b;\s*}/g, '[data-theme="dark"] nav.tabs {\n    background: #0d0d0d;\n}');
cssContent = cssContent.replace(/\.tab-button\.active {\s*background: #2563eb;\s*color: #fff;\s*}/g, '.tab-button.active {\n    background: #111111;\n    color: #ffffff;\n}');
cssContent = cssContent.replace(/\[data-theme="dark"\] \.tab-button\.active {\s*background: #2563eb !important;\s*color: #fff !important;\s*}/g, '[data-theme="dark"] .tab-button.active {\n    background: #ffffff !important;\n    color: #000000 !important;\n}');

// Hover state for tab button
cssContent = cssContent.replace(/\.tab-button:hover \{\s*background: rgba\(13,59,102,0\.07\);\s*color: var\(--accent\);\s*\}/g, '.tab-button:hover { \n    background: rgba(0,0,0,0.05); \n    color: #000000; \n}');
// Dark mode tab button hover
cssContent = cssContent.replace(/\[data-theme="dark"\] \.tab-button:hover:not\(\.active\) \{\s*background: #222;\s*color: var\(--accent\);\s*\}/g, '[data-theme="dark"] .tab-button:hover:not(.active) {\n  background: rgba(255,255,255,0.08);\n  color: #ffffff;\n}');
cssContent = cssContent.replace(/\[data-theme="dark"\] \.tab-button:hover:not\(\.active\) \{\s*color: #ffffff !important;\s*\}/g, '[data-theme="dark"] .tab-button:hover:not(.active) {\n  color: #ffffff !important;\n}');

// Old single-theme-toggle dark mode background
cssContent = cssContent.replace(/\[data-theme="dark"\] \.single-theme-toggle \{\s*background: #1e293b;/g, '[data-theme="dark"] .single-theme-toggle {\n  background: #1a1a1a;');

// Some old dark mode professional overrides at the bottom
cssContent = cssContent.replace(/--bg: #121212 !important;/g, '--bg: #0d0d0d !important;');
cssContent = cssContent.replace(/--card: #1e1e1e !important;/g, '--card: #1a1a1a !important;');
cssContent = cssContent.replace(/--accent: #000000 !important;/g, '--accent: #ffffff !important;'); // Accent in dark mode should be white
cssContent = cssContent.replace(/--accent-light: #2a2a2a !important;/g, '--accent-light: #e5e5e5 !important;');
cssContent = cssContent.replace(/--accent-2: #ffffff !important;/g, '--accent-2: #ffffff !important;');
cssContent = cssContent.replace(/--muted: #a0a0a0 !important;/g, '--muted: #a3a3a3 !important;');
cssContent = cssContent.replace(/--border: #333333 !important;/g, '--border: #333333 !important;');

fs.writeFileSync(cssPath, cssContent);
console.log('Colors replaced successfully.');
