const fs = require('fs');
const css = fs.readFileSync('extracted_styles.css', 'utf8');

const match = css.match(/\/\* ========== داخلہ جات ٹیب CSS ========== \*\/([\s\S]*?)(?=\/\* ========== حاضری ٹیب CSS ========== \*\/)/);
if (!match) {
    console.log("Could not find the Admission CSS block.");
    process.exit(1);
}

let admissionsCss = match[0];

// Replace basic hardcoded colors with CSS variables
admissionsCss = admissionsCss
    .replace(/background:\s*#fff/g, 'background: var(--card)')
    .replace(/background:\s*#f1f5f9/g, 'background: var(--bg)')
    .replace(/background:\s*#f8f9fa/g, 'background: var(--bg)')
    .replace(/background:\s*#fefcbf/g, 'background: var(--warning)')
    .replace(/border:\s*[\d\.]+px solid #e2e8f0/g, 'border: 1px solid var(--border)')
    .replace(/border-color:\s*#e2e8f0/g, 'border-color: var(--border)')
    .replace(/border:\s*[\d\.]+px solid #d0d8e4/g, 'border: 1px solid var(--border)')
    .replace(/border-color:\s*#d0d8e4/g, 'border-color: var(--border)')
    .replace(/background:\s*#e8edf3/g, 'background: var(--bg)')
    .replace(/background:\s*#dcfce7/g, 'background: var(--success)')
    .replace(/color:\s*#16a34a/g, 'color: #fff')
    .replace(/border-color:\s*#16a34a/g, 'border-color: var(--success)')
    .replace(/color:\s*#64748b/g, 'color: var(--muted)')
    .replace(/color:\s*#94a3b8/g, 'color: var(--muted)');

const darkModeCss = `

/* ========== DARK MODE WIZARD OVERRIDES ========== */
[data-theme="dark"] .wizard-step-circle {
    background: var(--bg);
    border-color: var(--border);
    color: var(--muted);
}
[data-theme="dark"] .wizard-step.active .wizard-step-circle {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--bg);
}
[data-theme="dark"] .wizard-step.done .wizard-step-circle {
    background: var(--success);
    border-color: var(--success);
    color: var(--bg);
}
[data-theme="dark"] .wizard-connector {
    background: var(--border);
}
[data-theme="dark"] .wizard-connector.done {
    background: var(--success);
}
[data-theme="dark"] .wizard-btn-prev {
    background: var(--bg);
    color: var(--accent);
    border-color: var(--border);
}
[data-theme="dark"] .wizard-btn-next {
    background: var(--accent) !important;
    color: var(--bg) !important;
}
[data-theme="dark"] .sub-tab-btn {
    background: var(--card);
    color: var(--muted);
    border-color: var(--border);
}
[data-theme="dark"] .sub-tab-btn.active {
    background: var(--accent) !important;
    color: var(--bg) !important;
    border-color: var(--accent) !important;
}
[data-theme="dark"] .admission-box {
    background: var(--card);
    border-color: var(--border);
}
[data-theme="dark"] .admission-box .section-title {
    color: var(--accent);
    border-color: var(--border);
}
[data-theme="dark"] .search-bar {
    background: var(--card);
    border-color: var(--border);
}
[data-theme="dark"] #printableAdmissionFormArea {
    background: var(--card);
    border-color: var(--border);
    color: var(--accent);
}
[data-theme="dark"] .wizard-step-label {
    color: var(--muted);
}
[data-theme="dark"] .wizard-step.active .wizard-step-label {
    color: var(--accent);
}
[data-theme="dark"] .wizard-step.done .wizard-step-label {
    color: var(--success);
}
[data-theme="dark"] .wizard-progress-wrap {
    background: transparent;
    border-color: var(--border);
}
`;

fs.writeFileSync('src/pages/Admissions.css', admissionsCss + darkModeCss);
console.log("Successfully generated Admissions.css");
