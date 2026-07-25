



/* ========== THEME TOGGLE ========== */
function initTheme() {
    const savedTheme = localStorage.getItem('hifz-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

    if (savedTheme) {
        setTheme(savedTheme, false);
    } else if (prefersDark) {
        setTheme('dark', false);
    } else {
        setTheme('light', false);
    }
}

function setTheme(theme, save = true) {
    const html = document.documentElement;
    const lightBtn = document.getElementById('lightBtn');
    const darkBtn = document.getElementById('darkBtn');

    if (theme === 'dark') {
        html.setAttribute('data-theme', 'dark');
        if (lightBtn) lightBtn.classList.remove('active');
        if (darkBtn) darkBtn.classList.add('active');
    } else {
        html.removeAttribute('data-theme');
        if (lightBtn) lightBtn.classList.add('active');
        if (darkBtn) darkBtn.classList.remove('active');
    }

    if (save) {
        localStorage.setItem('hifz-theme', theme);
    }

    // Update chart colors if charts exist
    updateChartColors();
}

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
}

function updateChartColors() {
    // This will be called after charts are rendered
    // Charts will pick up new CSS variable values automatically
    if (typeof renderCharts === 'function') {
        renderCharts();
    }
}

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!localStorage.getItem('hifz-theme')) {
        setTheme(e.matches ? 'dark' : 'light', false);
    }
});

// Initialize theme on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTheme);
} else {
    initTheme();
}


/* ========== ADMISSIONS LOGIC ========== */
function toggleMobileMenu() {
    document.getElementById('mainTabs').classList.toggle('show');
}

function generateNewAdmissionId() {
    let maxId = 0;
    if (storedData && storedData.records) {
        storedData.records.forEach(r => {
            if (r.admRegNo && !isNaN(r.admRegNo)) {
                maxId = Math.max(maxId, parseInt(r.admRegNo, 10));
            }
        });
    }
    const nextId = maxId + 1;
    document.getElementById('admRegNo').value = nextId.toString().padStart(2, '0');
}

function formatBForm(input) {
    let val = input.value.replace(/\D/g, ''); 
    if (val.length > 13) val = val.substring(0, 13);
    let formatted = val;
    if (val.length > 5 && val.length <= 12) {
        formatted = val.substring(0, 5) + '-' + val.substring(5);
    } else if (val.length > 12) {
        formatted = val.substring(0, 5) + '-' + val.substring(5, 12) + '-' + val.substring(12, 13);
    }
    input.value = formatted;
}

function formatPhoneNumber(input) {
    let val = input.value.replace(/\D/g, '');
    if (val.length > 11) val = val.substring(0, 11);
    let formatted = val;
    if (val.length > 4) {
        formatted = val.substring(0, 4) + '-' + val.substring(4);
    }
    input.value = formatted;
}

function toggleAdmissionForm() {
    const val = document.getElementById('admissionTypeSelect').value;
    document.getElementById('newAdmissionFormContainer').style.display = (val === 'new') ? 'block' : 'none';
    
    // Handle Search / All Container
    const searchContainer = document.getElementById('searchStudentsContainer');
    if (val === 'search' || val === 'all' || val === 'withdrawn_list') {
        searchContainer.style.display = 'block';
    } else {
        searchContainer.style.display = 'none';
    }
    
    // Handle Withdraw Container
    document.getElementById('withdrawStudentContainer').style.display = (val === 'withdraw') ? 'block' : 'none';

    // Handle Classes Container
    document.getElementById('classesContainer').style.display = (val === 'classes') ? 'block' : 'none';

    // Handle Printable Form Container
    const printFormEl = document.getElementById('printFormContainer');
    if (printFormEl) printFormEl.style.display = (val === 'printform') ? 'block' : 'none';
    
    if (val === 'withdraw') {
        document.getElementById('withdrawSearchId').value = '';
        document.getElementById('withdrawDetailsArea').style.display = 'none';
    } else if (val === 'new') {
        generateNewAdmissionId();
        populateClassSelects();
        if(!document.getElementById('admDate').value){
            document.getElementById('admDate').value = new Date().toISOString().split('T')[0];
            calculateAge();
        }
    } else if (val === 'all') {
        document.getElementById('searchAdmId').value = '';
        document.getElementById('searchAdmName').value = '';
        document.getElementById('searchStudentsTitle').innerText = 'تمام طلباء (All Students)';
        document.getElementById('admissionSearchBox').style.display = 'none';
        searchAdmissions();
    } else if (val === 'search') {
        document.getElementById('searchStudentsTitle').innerText = 'طالب علم تلاش کریں (Search Student)';
        document.getElementById('admissionSearchBox').style.display = 'flex';
        clearAdmissionSearch();
    } else if (val === 'withdrawn_list') {
        document.getElementById('searchStudentsTitle').innerText = 'خارج شدہ طلباء (Withdrawn Students)';
        document.getElementById('admissionSearchBox').style.display = 'none';
        listWithdrawnStudents();
    } else if (val === 'classes') {
        renderClassCards();
    }
}

function clearAdmissionSearch() {
    document.getElementById('searchAdmId').value = '';
    document.getElementById('searchAdmName').value = '';
    document.getElementById('searchAdmissionsResultsArea').innerHTML = '';
}

function getRegistrationSortValue(regNo) {
    const raw = String(regNo || '').trim();
    const numeric = raw.match(/\d+/);
    if (numeric) return parseInt(numeric[0], 10);
    return Number.MAX_SAFE_INTEGER;
}

function compareByRegistrationNumber(a, b) {
    const diff = getRegistrationSortValue(a.admRegNo) - getRegistrationSortValue(b.admRegNo);
    if (diff !== 0) return diff;
    return String(a.admRegNo || '').localeCompare(String(b.admRegNo || ''), 'en', { numeric: true, sensitivity: 'base' });
}

function searchAdmissions() {
    const idQuery   = document.getElementById('searchAdmId').value.trim();
    const nameQuery = document.getElementById('searchAdmName').value.trim().toLowerCase();
    const resultsArea = document.getElementById('searchAdmissionsResultsArea');

    const records = storedData.records || [];
    const filtered = records.filter(r => {
        if (!r.isAdmissionProfile) return false;
        let matchId   = idQuery   ? (r.admRegNo && r.admRegNo.includes(idQuery)) : true;
        let matchName = nameQuery ? (r.name && r.name.toLowerCase().includes(nameQuery)) : true;
        return matchId && matchName;
    });
    filtered.sort(compareByRegistrationNumber);

    if (!filtered.length) {
        resultsArea.innerHTML = '<div class="empty-dashboard-state">کوئی طالب علم نہیں ملا</div>';
        return;
    }

    resultsArea.innerHTML = `
      <div style="overflow-x:auto; margin-top:16px;">
        <table style="width:100%; border-collapse:collapse; font-size:0.88rem; table-layout:fixed;">
          <colgroup>
            <col style="width:75px;">
            <col style="width:175px;">
            <col style="width:165px;">
            <col style="width:140px;">
            <col style="width:100px;">
            <col style="width:95px;">
            <col style="width:75px;">
            <col style="width:75px;">
          </colgroup>
          <thead>
            <tr style="background:var(--accent); color:#fff; text-align:center;">
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">رجسٹریشن نمبر</th>
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">نام</th>
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">ولدیت</th>
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">فون / واٹس ایپ</th>
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">تاریخ پیدائش</th>
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">تاریخ داخلہ</th>
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">حیثیت</th>
              <th style="padding:10px 8px; border:1px solid rgba(255,255,255,0.2);">پروفائل</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.map((r, i) => `
            <tr style="background:${i%2===0?'#fff':'#f8fafc'}; transition:background 0.15s;"
                onmouseover="this.style.background='#eef4ff'"
                onmouseout="this.style.background='${i%2===0?'#fff':'#f8fafc'}'">
              <td style="padding:9px 8px; border:1px solid var(--border); text-align:center; font-weight:700; color:var(--accent); font-size:0.82rem;">${r.admRegNo||'—'}</td>
              <td style="padding:9px 8px; border:1px solid var(--border); font-weight:700; text-align:right; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.name||'—'}</td>
              <td style="padding:9px 8px; border:1px solid var(--border); text-align:right; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${r.admFatherName||'—'}</td>
              <td style="padding:9px 8px; border:1px solid var(--border); text-align:center; font-size:0.8rem;">
                <div>${r.contactPhone1||r.admPhone||'—'}</div>
                <div style="color:var(--accent-2); margin-top:2px;">${r.contactWhatsapp1||r.admWhatsapp||'—'}</div>
              </td>
              <td style="padding:9px 8px; border:1px solid var(--border); text-align:center; font-size:0.8rem;">${r.admDOB||r.admDobFull||'—'}</td>
              <td style="padding:9px 8px; border:1px solid var(--border); text-align:center; font-size:0.8rem;">${r.admDate||'—'}</td>
              <td style="padding:9px 8px; border:1px solid var(--border); text-align:center;">
                ${r.isWithdrawn
                  ? `<span style="background:var(--danger);color:#fff;padding:3px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">خارج</span>`
                  : `<span style="background:#2e7d32;color:#fff;padding:3px 8px;border-radius:20px;font-size:0.75rem;font-weight:700;">فعال</span>`}
              </td>
              <td style="padding:7px 8px; border:1px solid var(--border); text-align:center;">
                <button onclick="openStudentProfile('${r.admRegNo}')"
                  style="background:var(--accent); color:#fff; border:none; padding:5px 10px; border-radius:7px; cursor:pointer; font-size:0.78rem; font-weight:700; white-space:nowrap;">
                  پروفائل
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
}


let currentWithdrawalIndex = -1;

function loadStudentForWithdrawal() {
    const searchId = document.getElementById('withdrawSearchId').value.trim();
    if (!searchId) {
        alert("براہ کرم رجسٹریشن نمبر درج کریں۔");
        return;
    }

    const records = storedData.records || [];
    currentWithdrawalIndex = records.findIndex(r => r.isAdmissionProfile && r.admRegNo === searchId);

    if (currentWithdrawalIndex === -1) {
        alert("اس رجسٹریشن نمبر سے کوئی طالب علم نہیں ملا۔");
        document.getElementById('withdrawDetailsArea').style.display = 'none';
        return;
    }

    const student = records[currentWithdrawalIndex];
    
    if (student.isWithdrawn) {
        alert(`یہ طالب علم پہلے ہی ${student.withdrawDate} کو خارج کیا جا چکا ہے۔\nوجہ: ${student.withdrawReason}`);
        document.getElementById('withdrawDetailsArea').style.display = 'none';
        return;
    }

    document.getElementById('withdrawDispName').value = student.name || '';
    document.getElementById('withdrawDispFather').value = student.admFatherName || '';
    document.getElementById('withdrawDispAdmDate').value = student.admDate || '';
    
    document.getElementById('withdrawDateInput').value = new Date().toISOString().split('T')[0];
    document.getElementById('withdrawReasonInput').value = '';

    document.getElementById('withdrawDetailsArea').style.display = 'block';
}

function processWithdrawal() {
    if (currentWithdrawalIndex === -1) return;

    const withdrawDate = document.getElementById('withdrawDateInput').value;
    const withdrawReason = document.getElementById('withdrawReasonInput').value.trim();

    if (!withdrawDate || !withdrawReason) {
        alert("براہ کرم تاریخ اخراج اور وجہ اخراج دونوں درج کریں۔");
        return;
    }

    if (!confirm("کیا آپ واقعی اس طالب علم کا اخراج محفوظ کرنا چاہتے ہیں؟ یہ عمل ناقابل واپسی ہے۔")) {
        return;
    }

    storedData.records[currentWithdrawalIndex].isWithdrawn = true;
    storedData.records[currentWithdrawalIndex].withdrawDate = withdrawDate;
    storedData.records[currentWithdrawalIndex].withdrawReason = withdrawReason;

    saveToLocal();
    alert("طالب علم کا ریکارڈ کامیابی سے خارج کر دیا گیا ہے۔");
    
    document.getElementById('withdrawSearchId').value = '';
    document.getElementById('withdrawDetailsArea').style.display = 'none';
}

function listWithdrawnStudents() {
    const resultsArea = document.getElementById('searchAdmissionsResultsArea');
    const records = storedData.records || [];
    const withdrawnRecords = records.filter(r => r.isAdmissionProfile && r.isWithdrawn);
    withdrawnRecords.sort((a, b) => new Date(b.withdrawDate) - new Date(a.withdrawDate));

    if (!withdrawnRecords.length) {
        resultsArea.innerHTML = '<div class="empty-dashboard-state">کوئی خارج شدہ طالب علم نہیں ہے</div>';
        return;
    }

    resultsArea.innerHTML = `
      <div style="overflow-x:auto; margin-top:16px;">
        <table style="width:100%; border-collapse:collapse; font-size:0.88rem; table-layout:fixed;">
          <colgroup>
            <col style="width:75px;">
            <col style="width:155px;">
            <col style="width:145px;">
            <col style="width:130px;">
            <col style="width:95px;">
            <col style="width:90px;">
            <col style="width:90px;">
            <col style="width:150px;">
            <col style="width:75px;">
          </colgroup>
          <thead>
            <tr style="background:var(--danger); color:#fff; text-align:center;">
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">رجسٹریشن نمبر</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">نام</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">ولدیت</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">فون / واٹس ایپ</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">تاریخ پیدائش</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">تاریخ داخلہ</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">تاریخ اخراج</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">وجہ اخراج</th>
              <th style="padding:10px 12px; border:1px solid rgba(255,255,255,0.2);">پروفائل</th>
            </tr>
          </thead>
          <tbody>
            ${withdrawnRecords.map((r, i) => `
            <tr style="background:${i%2===0?'#fff':'#fff5f5'};"
                onmouseover="this.style.background='#fee2e2'"
                onmouseout="this.style.background='${i%2===0?'#fff':'#fff5f5'}'">
              <td style="padding:10px 12px; border:1px solid var(--border); text-align:center; font-weight:700; color:var(--danger);">${r.admRegNo||'—'}</td>
              <td style="padding:10px 12px; border:1px solid var(--border); font-weight:700; text-align:right;">${r.name||'—'}</td>
              <td style="padding:10px 12px; border:1px solid var(--border); text-align:right; color:var(--muted);">${r.admFatherName||'—'}</td>
              <td style="padding:10px 12px; border:1px solid var(--border); text-align:center; font-size:0.82rem;">
                <div>${r.contactPhone1||r.admPhone||'—'}</div>
                <div style="color:var(--accent-2); margin-top:2px;">${r.contactWhatsapp1||r.admWhatsapp||'—'}</div>
              </td>
              <td style="padding:10px 12px; border:1px solid var(--border); text-align:center; font-size:0.83rem;">${r.admDOB||'—'}</td>
              <td style="padding:10px 12px; border:1px solid var(--border); text-align:center; font-size:0.83rem;">${r.admDate||'—'}</td>
              <td style="padding:10px 12px; border:1px solid var(--border); text-align:center; color:var(--danger); font-weight:700; font-size:0.83rem;">${r.withdrawDate||'—'}</td>
              <td style="padding:10px 12px; border:1px solid var(--border); text-align:right; font-size:0.82rem; max-width:200px;">${r.withdrawReason||'—'}</td>
              <td style="padding:8px 12px; border:1px solid var(--border); text-align:center;">
                <button onclick="openStudentProfile('${r.admRegNo}')"
                  style="background:var(--accent); color:#fff; border:none; padding:6px 14px; border-radius:7px; cursor:pointer; font-size:0.82rem; font-weight:700;">
                  پروفائل
                </button>
              </td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
}


function calculateAge() {
    const dVal = parseInt(document.getElementById('admDobDay').value, 10);
    const mVal = parseInt(document.getElementById('admDobMonth').value, 10);
    const yVal = parseInt(document.getElementById('admDobYear').value, 10);
    const admVal = document.getElementById('admDate').value;
    const ageField = document.getElementById('admAge');

    if (!dVal || !mVal || !yVal || !admVal || isNaN(dVal) || isNaN(mVal) || isNaN(yVal)) {
        ageField.value = '';
        return;
    }

    if (mVal < 1 || mVal > 12 || dVal < 1 || dVal > 31 || yVal < 1900) {
         ageField.value = 'غلط تاریخ';
         return;
    }

    const dob = new Date(yVal, mVal - 1, dVal);
    if (dob.getDate() !== dVal || dob.getMonth() !== (mVal - 1)) {
         ageField.value = 'غلط تاریخ';
         return;
    }

    const adm = new Date(admVal);

    if (adm < dob) {
        ageField.value = 'غلط تاریخ';
        return;
    }

    let years = adm.getFullYear() - dob.getFullYear();
    let months = adm.getMonth() - dob.getMonth();
    let days = adm.getDate() - dob.getDate();

    if (days < 0) {
        months--;
        const prevMonth = new Date(adm.getFullYear(), adm.getMonth(), 0);
        days += prevMonth.getDate();
    }
    
    if (months < 0) {
        years--;
        months += 12;
    }

    let ageStr = [];
    if (years > 0) ageStr.push(`${years} سال`);
    if (months > 0) ageStr.push(`${months} ماہ`);
    if (days > 0) ageStr.push(`${days} دن`);

    ageField.value = ageStr.length > 0 ? ageStr.join('، ') : '0 دن';
}

function addPhoneRow() {
    const container = document.getElementById('phoneNumbersArea');
    const row = document.createElement('div');
    row.className = 'grid-row phone-entry';
    row.style = 'align-items: center; margin-top: 10px; grid-template-columns: 1fr 1.5fr 1.5fr 1fr;';
    row.innerHTML = `
        <div><input type="text" class="phone-name" placeholder="نام"></div>
        <div><input type="text" class="phone-num" oninput="formatPhoneNumber(this)" placeholder="0300-1234567" maxlength="12"></div>
         <div><input type="text" class="whatsapp-num" oninput="formatPhoneNumber(this)" placeholder="0300-1234567" maxlength="12"></div>
        <div style="display: flex; gap: 10px; align-items: center;">
           <div style="flex-grow: 1;"><input type="text" class="phone-rel" placeholder="رشتہ"></div>
           <button onclick="this.parentElement.parentElement.remove()" style="background: #ef5350; padding: 10px; height: 44px; margin-bottom: 0px; border-radius: var(--radius); color: white; border: none; cursor: pointer;" title="حذف کریں">X</button>
        </div>
    `;
    container.appendChild(row);
}

function toggleGuardianSection() {
    const isFatherGuardian = document.querySelector('input[name="isFatherGuardian"]:checked').value;
    const guardianContainer = document.getElementById('guardianSectionContainer');
    
    if (isFatherGuardian === 'yes') {
        guardianContainer.style.display = 'none';
        
        // Optionally clear Guardian data when hidden
        document.getElementById('guardianName').value = '';
        document.getElementById('guardianRel').value = '';
        document.getElementById('guardianCnic').value = '';
        document.getElementById('guardianEdu').value = '';
        document.getElementById('guardianOcc').value = '';
        document.getElementById('guardianIncome').value = '';
        document.getElementById('guardianMobile').value = '';
        document.getElementById('guardianWhatsapp').value = '';

    } else {
        guardianContainer.style.display = 'block';
    }
}

function saveAdmission() {
    const admRegNo = document.getElementById('admRegNo').value;
    const name = document.getElementById('admName').value.trim();
    if(!name || !admRegNo) {
        alert("براہ کرم طالب علم کا نام درج کریں۔");
        return;
    }
    
    const profile = {
        isAdmissionProfile: true,
        admRegNo: admRegNo,
        name: name,
        admClass: document.getElementById('admClass').value,
        admFatherName: document.getElementById('admFatherName').value.trim(),
        admDobFull: `${document.getElementById('admDobYear').value}-${document.getElementById('admDobMonth').value}-${document.getElementById('admDobDay').value}`,
        admAge: document.getElementById('admAge').value,
        admBForm: document.getElementById('admBForm').value,
        admGender: document.getElementById('admGender').value,
        admAddress: document.getElementById('admAddress').value,
        admDate: document.getElementById('admDate').value,
        
        // Father
        fatherName: document.getElementById('fatherName').value,
        fatherCnic: document.getElementById('fatherCnic').value,
        fatherEdu: document.getElementById('fatherEdu').value,
        fatherOcc: document.getElementById('fatherOcc').value,
        fatherMobile: document.getElementById('fatherMobile').value,
        fatherWhatsapp: document.getElementById('fatherWhatsapp').value,
        fatherEmail: document.getElementById('fatherEmail').value,
        fatherIncome: document.getElementById('fatherIncome').value,
        isFatherGuardian: document.querySelector('input[name="isFatherGuardian"]:checked').value,
        
        // Mother
        motherName: document.getElementById('motherName').value,
        motherCnic: document.getElementById('motherCnic').value,
        motherEdu: document.getElementById('motherEdu').value,
        motherOcc: document.getElementById('motherOcc').value,
        motherMobile: document.getElementById('motherMobile').value,
        motherWhatsapp: document.getElementById('motherWhatsapp').value,
        motherIncome: document.getElementById('motherIncome').value,
        
        // Guardian
        guardianName: document.getElementById('guardianName').value,
        guardianRel: document.getElementById('guardianRel').value,
        guardianCnic: document.getElementById('guardianCnic').value,
        guardianEdu: document.getElementById('guardianEdu').value,
        guardianOcc: document.getElementById('guardianOcc').value,
        guardianIncome: document.getElementById('guardianIncome').value,
        guardianMobile: document.getElementById('guardianMobile').value,
        guardianWhatsapp: document.getElementById('guardianWhatsapp').value,

        ts: new Date().toISOString()
    };
    
    if (window.editingStudentId) {
        // Update Existing
        if (typeof db !== "undefined" && window.editingStudentId !== admRegNo) {
             db.collection("students").doc(window.editingStudentId).update(profile)
             .then(() => {
                 alert("ریکارڈ کامیابی سے اپ ڈیٹ ہو گیا۔");
                 window.editingStudentId = null;
                 toggleAdmissionForm();
             })
             .catch(e => alert("فائر بیس میں اپ ڈیٹ کرنے میں مسئلہ پیش آیا: " + e));
        } else {
             // Local Storage update fallback
             const idx = storedData.records.findIndex(r => r.id === window.editingStudentId || r.admRegNo === window.editingStudentId);
             if(idx !== -1) {
                 storedData.records[idx] = Object.assign(storedData.records[idx], profile);
                 saveToLocal();
                 alert("ریکارڈ مقامی طور پر اپ ڈیٹ ہو گیا۔");
             }
             window.editingStudentId = null;
             toggleAdmissionForm();
             if(typeof searchAdmissions === "function") searchAdmissions();
        }
    } else {
        // Minimal save functionality to populate lookup area
        storedData.records.push(profile);
        saveToLocal();
        
        if (typeof db !== "undefined") {
             db.collection("students").add(profile)
             .then(() => {
                  alert("داخلہ کامیابی سے کلاؤڈ پر بھی محفوظ ہو گیا۔");
                  toggleAdmissionForm();
             })
             .catch(e => {
                  alert("کلاؤڈ میں محفوظ کرنے میں مسئلہ آیا، لیکن مقامی طور پر محفوظ ہو گیا ہے۔");
                  toggleAdmissionForm();
             });
        } else {
             alert("داخلہ محفوظ ہوچکا ہے۔");
             toggleAdmissionForm();
        }
    }
}

/* ========== CONFIGURATIONS ========== */
const PAGES_PER_JUZ = 20;
const PAGES_PER_PAO = 5;

// Hifz Targets
const yearTargets = {
  1: [30,29,28], 2: [27,26,25,24,23,22],
  3: [21,20,19,18,17,16,15,14,13], 4: [12,11,10,9,8,7,6,5,4,3,2,1]
};

const scoreThresholds = [
  { pct:100, score:100 }, { pct:75, score:75 }, { pct:50, score:50 }, { pct:25, score:25 }
];

/* ========== HOLIDAY LOGIC (2025-2026) ========== */
const specialHolidays = [
    // NEW: April 1 to April 5, 2025 (Previous year's Eid/Break continuation)
    ...getDateRange("2025-04-01", "2025-04-05"), 
    // Summer Break: June 6 to July 1
    ...getDateRange("2025-06-06", "2025-07-01"),
    // Ashura/Extra
    "2025-07-05", "2025-07-06",
    // Independence Day
    "2025-08-14",
    // Defence Day
    "2025-09-06",
    // Kashmir Day
    "2026-02-05",
    // Eid ul Fitr Break: March 17 to March 25
    ...getDateRange("2026-03-17", "2026-03-25")
];

function getDateRange(start, end) {
    let arr = [];
    let dt = new Date(start);
    dt.setMinutes(dt.getMinutes() + dt.getTimezoneOffset()); 
    let endDt = new Date(end);
    endDt.setMinutes(endDt.getMinutes() + endDt.getTimezoneOffset());
    
    while (dt <= endDt) {
        arr.push(new Date(dt).toISOString().split('T')[0]);
        dt.setDate(dt.getDate() + 1);
    }
    return arr;
}

function calculateWorkingDays(year, monthIndex) {
    let date = new Date(year, monthIndex, 1);
    date.setMinutes(date.getMinutes() + date.getTimezoneOffset());
    
    let days = 0;
    
    while (date.getMonth() === monthIndex) {
        let dateString = date.toISOString().split('T')[0];
        let dayOfWeek = date.getDay(); // 0 = Sunday
        
        if (dayOfWeek !== 0 && !specialHolidays.includes(dateString)) {
            days++;
        }
        date.setDate(date.getDate() + 1);
    }
    return days;
}

/* ========== DATA STORE & UTILITIES ========== */
let storedData = { records: [], studentName: '', startDate: '', classes: [], monthlyAttendance: {}, staffAttendance: {}, dailyAttendance: {}, staffProfiles: [], staffAttendanceFlow: {}, staffIdCounter: 1001 };

function saveToLocal(){
  try{ localStorage.setItem('hf_records_v1', JSON.stringify(storedData)); }
  catch(e){ console.error(e); }
}

function loadFromLocal(){
  try{
    const raw = localStorage.getItem('hf_records_v1');
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.records) storedData = parsed;
      else storedData = { records: [], studentName: '', startDate: '', classes: [], monthlyAttendance: {}, staffAttendance: {}, dailyAttendance: {}, staffProfiles: [], staffAttendanceFlow: {}, staffIdCounter: 1001 };
      
      storedData.studentName = storedData.studentName || '';
      storedData.startDate = storedData.startDate || '';
      storedData.classes = storedData.classes || [];
      storedData.monthlyAttendance = storedData.monthlyAttendance || {};
      storedData.staffAttendance = storedData.staffAttendance || {};
      storedData.dailyAttendance = storedData.dailyAttendance || {};
      storedData.staffProfiles = storedData.staffProfiles || [];
      storedData.staffAttendanceFlow = storedData.staffAttendanceFlow || {};
      storedData.staffIdCounter = Number(storedData.staffIdCounter || 1001);
    }
  }catch(e){ storedData = { records: [], studentName: '', startDate: '', classes: [], monthlyAttendance: {}, staffAttendance: {}, dailyAttendance: {}, staffProfiles: [], staffAttendanceFlow: {}, staffIdCounter: 1001 }; }

  normalizeStaffProfiles();
  
  // Seed default classes if none exist
  if (storedData.classes.length === 0) {
    storedData.classes = [
      { id: 'cls-1', name: 'حفظِ قرآن — ناظرہ',     teacher: 'مولانا عبدالرحمن' },
      { id: 'cls-2', name: 'حفظِ قرآن — سال اول',    teacher: 'مولانا محمد اسحاق' },
      { id: 'cls-3', name: 'حفظِ قرآن — سال دوم',    teacher: 'مولانا یوسف' },
      { id: 'cls-4', name: 'حفظِ قرآن — سال سوم',    teacher: 'مولانا ابراہیم' },
      { id: 'cls-5', name: 'حفظِ قرآن — سال چہارم',  teacher: 'مولانا عبداللہ' },
    ];
    saveToLocal();
  }
}

function normalizeStaffProfiles() {
    if (!Array.isArray(storedData.staffProfiles)) storedData.staffProfiles = [];
    let maxId = 1000;
    storedData.staffProfiles = storedData.staffProfiles.map(profile => {
        const normalized = { ...profile };
        let code = Number(normalized.staffCode);
        if (!Number.isFinite(code) || code < 1001) {
            code = 0;
        }
        maxId = Math.max(maxId, code);
        normalized.staffCode = code;
        normalized.shiftStart = normalized.shiftStart || '06:50';
        normalized.shiftEnd = normalized.shiftEnd || '14:45';
        return normalized;
    });

    let nextCode = 1001;
    storedData.staffProfiles.forEach(profile => {
        if (!profile.staffCode || profile.staffCode < 1001) {
            while (storedData.staffProfiles.some(p => p !== profile && Number(p.staffCode) === nextCode)) nextCode++;
            profile.staffCode = nextCode++;
            maxId = Math.max(maxId, profile.staffCode);
        }
    });

    storedData.staffIdCounter = Math.max(Number(storedData.staffIdCounter || 1001), maxId + 1, 1001);
}

/* ========== INITIALIZATION & CORE LOGIC ========== */
window.addEventListener('DOMContentLoaded', ()=>{
  loadFromLocal();
  
  // Set initial student info if available
  document.getElementById('studentName').value = storedData.studentName;
  document.getElementById('startDate').value = storedData.startDate;
  
  document.getElementById('studentName').addEventListener('input', updateInputAndSave);
  document.getElementById('startDate').addEventListener('change', updateInputAndSave);

  onStartChange();
  populateYearSelect();
  
  if(!document.getElementById('selectYear').value) document.getElementById('selectYear').value = '1';
  if(!document.getElementById('selectHalfYear').value) document.getElementById('selectHalfYear').value = '1';
  
  // Ensure all class dropdowns (including attendance) are ready on first load.
  populateClassSelects();
  populateStaffClassOptions();
  
  // Initial render for the entry tab
  renderAllInputs();
  // Initial render for the records tab
  renderAll();
  renderStaffList();
  buildTargetsArea(); // This only needs to run once
});

function updateInputAndSave() {
  storedData.studentName = document.getElementById('studentName').value.trim();
  storedData.startDate = document.getElementById('startDate').value;
  saveToLocal();
  onStartChange();
}

function onStartChange(){
  const sd = document.getElementById('startDate').value;
  if(!sd) { document.getElementById('expectedEnd').value=''; return; }
  const d = new Date(sd);
  d.setFullYear(d.getFullYear() + 4);
  document.getElementById('expectedEnd').value = d.toISOString().split('T')[0];
}

/* ========== CLASS MANAGEMENT ========== */

function getStudentsInClass(classId) {
    return (storedData.records || []).filter(r => r.isAdmissionProfile && r.admClass === classId);
}

function populateClassSelects() {
    const selects = document.querySelectorAll('#admClass, .transfer-class-select, #studentAttClass');
    selects.forEach(sel => {
        const current = sel.value;
        sel.innerHTML = '<option value="">کلاس منتخب کریں...</option>';
        (storedData.classes || []).forEach(cls => {
            const opt = document.createElement('option');
            opt.value = cls.id;
            opt.textContent = cls.name;
            if (cls.id === current) opt.selected = true;
            sel.appendChild(opt);
        });
    });
}

function renderClassCards() {
    const area = document.getElementById('classCardsArea');
    if (!area) return;
    const classes = storedData.classes || [];
    if (classes.length === 0) {
        area.innerHTML = '<p style="text-align:center; color:var(--muted);">کوئی کلاس موجود نہیں۔ نیچے بٹن سے شامل کریں۔</p>';
        return;
    }
    area.innerHTML = classes.map(cls => {
        const students = getStudentsInClass(cls.id);
        return `
        <div class="class-card" id="card-${cls.id}">
            <div class="class-card-header">
                <div>
                    <span class="class-name-display">${cls.name}</span>
                    <span class="class-badge">${students.length} طالب علم</span>
                </div>
                <div class="class-teacher-display">استاد: ${cls.teacher}</div>
            </div>
            <div class="class-card-edit" id="edit-${cls.id}" style="display:none;">
                <div class="grid-row" style="margin-top:10px;">
                    <div><label>کلاس کا نام</label><input type="text" id="editName-${cls.id}" value="${cls.name}"></div>
                    <div><label>استاد کا نام</label><input type="text" id="editTeacher-${cls.id}" value="${cls.teacher}"></div>
                </div>
                <div style="display:flex; gap:10px; margin-top:10px; justify-content:flex-end;">
                    <button onclick="saveClass('${cls.id}')" style="background:#2e7d32; padding:8px 20px;">محفوظ کریں</button>
                    <button onclick="cancelEditClass('${cls.id}')" style="background:var(--muted); padding:8px 20px;">منسوخ</button>
                    <button onclick="deleteClass('${cls.id}')" style="background:var(--danger); padding:8px 20px;">حذف کریں</button>
                </div>
            </div>
            <div class="class-card-students" id="students-${cls.id}" style="display:none;">
                <div class="table-responsive" style="margin-top:10px;">
                <table>
                    <thead><tr><th>ID</th><th>نام</th><th>والد</th><th>کلاس تبدیل کریں</th></tr></thead>
                    <tbody>
                    ${students.length === 0
                        ? '<tr><td colspan="4" style="text-align:center;color:#999;">اس کلاس میں کوئی طالب علم نہیں</td></tr>'
                        : students.map(s => `<tr>
                            <td>${s.admRegNo || '-'}</td>
                            <td><strong>${s.name || '-'}</strong></td>
                            <td>${s.admFatherName || '-'}</td>
                            <td>
                                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <select class="transfer-class-select" id="transfer-sel-${s.admRegNo}" style="width:auto; min-width:150px; font-size:0.85rem; padding:6px 8px; border:1.5px solid var(--accent-light); border-radius:6px;">
                                    ${(storedData.classes||[]).map(c => `<option value="${c.id}" ${c.id === cls.id ? 'selected' : ''}>${c.name}</option>`).join('')}
                                </select>
                                <button onclick="transferStudentClass('${s.admRegNo}')" style="padding:6px 14px; font-size:0.8rem; background:linear-gradient(135deg,var(--accent),var(--accent-light)); border-radius:6px; font-weight:700;">منتقل کریں</button>
                                </div>
                            </td>
                        </tr>`).join('')
                    }
                    </tbody>
                </table>
                </div>
            </div>
            <div class="class-card-actions">
                <button onclick="toggleEditClass('${cls.id}')" style="background:var(--accent); padding:7px 16px; font-size:0.85rem;">ترمیم</button>
                <button onclick="toggleClassStudents('${cls.id}')" style="background:#607d8b; padding:7px 16px; font-size:0.85rem;">طلباء دیکھیں / تبادلہ کریں</button>
            </div>
        </div>`;
    }).join('');
}

function toggleEditClass(id) {
    const editDiv = document.getElementById(`edit-${id}`);
    if (editDiv) editDiv.style.display = editDiv.style.display === 'none' ? 'block' : 'none';
}

function cancelEditClass(id) {
    const editDiv = document.getElementById(`edit-${id}`);
    if (editDiv) editDiv.style.display = 'none';
}

function toggleClassStudents(id) {
    const div = document.getElementById(`students-${id}`);
    if (div) div.style.display = div.style.display === 'none' ? 'block' : 'none';
}

function saveClass(id) {
    const name = document.getElementById(`editName-${id}`).value.trim();
    const teacher = document.getElementById(`editTeacher-${id}`).value.trim();
    if (!name) { alert('کلاس کا نام ضرور درج کریں۔'); return; }
    const cls = (storedData.classes || []).find(c => c.id === id);
    if (cls) {
        cls.name = name;
        cls.teacher = teacher;
        saveToLocal();
        renderClassCards();
        populateClassSelects();
        populateStaffClassOptions();
    }
}

function deleteClass(id) {
    const cls = (storedData.classes || []).find(c => c.id === id);
    if (!cls) return;
    if (!confirm(`کیا آپ کلاس "${cls.name}" کو حذف کرنا چاہتے ہیں؟`)) return;
    storedData.classes = storedData.classes.filter(c => c.id !== id);
    saveToLocal();
    renderClassCards();
    populateClassSelects();
    populateStaffClassOptions();
}

function addClass() {
    const newId = 'cls-' + Date.now();
    storedData.classes = storedData.classes || [];
    storedData.classes.push({ id: newId, name: 'نئی کلاس', teacher: '' });
    saveToLocal();
    renderClassCards();
    populateClassSelects();
    populateStaffClassOptions();
    // Auto-open edit for the new card
    setTimeout(() => toggleEditClass(newId), 50);
}

function transferStudentClass(regNo) {
    const sel = document.getElementById(`transfer-sel-${regNo}`);
    if (!sel) return;
    const newClassId = sel.value;
    if (!newClassId) { alert('براہ کرم ایک کلاس منتخب کریں۔'); return; }
    const student = (storedData.records || []).find(r => r.isAdmissionProfile && r.admRegNo === regNo);
    if (!student) { alert('طالب علم نہیں ملا۔'); return; }
    const targetCls = (storedData.classes || []).find(c => c.id === newClassId);
    if (student.admClass === newClassId) { alert('طالب علم پہلے سے اسی کلاس میں ہے۔'); return; }
    if (confirm(`"${student.name}" کو "${targetCls ? targetCls.name : newClassId}" میں منتقل کریں؟`)) {
        student.admClass = newClassId;
        saveToLocal();
        renderClassCards();
    }
}

/* ========== TAB LOGIC ========== */
function showTab(tabId){
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });

    document.getElementById(`tab-${tabId}`).style.display = 'block';
    document.querySelector(`.tab-button[onclick="showTab('${tabId}')"]`).classList.add('active');
    
    // Auto hide menu on mobile after selection
    const tabsMenu = document.getElementById('mainTabs');
    if(window.innerWidth <= 768 && tabsMenu && tabsMenu.classList.contains('show')) {
         tabsMenu.classList.remove('show');
    }
    
    // Populate dashboard when dashboard tab is selected
    if (tabId === 'dashboard') {
        populateDashboard();
    }
    
    // Ensure records are refreshed when switching to the records tab
    if (tabId === 'records') {
        renderAll();
        document.getElementById('studentSearch').value = '';
    }

    if (tabId === 'staff') {
        populateStaffClassOptions();
        renderStaffList();
    }
}

/* ========== ENTRY SECTION TOGGLE ========== */
function toggleEntrySection() {
    const val = document.getElementById('entryTypeSelect')?.value || '';
    pickEntryView(val === 'hifz' ? 'hifz' : val === 'monthly' ? 'monthly' : '', null);
}

function pickEntryView(view, btn) {
  // بٹن active state
  document.querySelectorAll('#tab-entry .adm-type-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // تمام sections چھپائیں
  ['hifz','monthly','classreport','studentreport','instituteresult'].forEach(id => {
    const el = document.getElementById('entrySection-' + id);
    if (el) el.style.display = 'none';
  });

  // متعلقہ section دکھائیں
  const target = document.getElementById('entrySection-' + view);
  if (target) target.style.display = 'block';

  // کلاس dropdown بھریں
  if (view === 'classreport') populateCrClassSelect();
  if (view === 'monthly') { mePopulateClasses(); meRenderHistory(); }
}

/* ===== کلاس رپورٹ dropdown ===== */
function populateCrClassSelect() {
  const sel = document.getElementById('crClassSelect');
  if (!sel) return;
  sel.innerHTML = '<option value="">کلاس منتخب کریں...</option>' +
    (storedData.classes||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/* ===== کلاس کی انفرادی رپورٹ ===== */
function renderClassReport() {
  const clsId = document.getElementById('crClassSelect').value;
  const month = document.getElementById('crMonth').value;
  const year  = document.getElementById('crYear').value;
  const area  = document.getElementById('classReportArea');
  if (!clsId) { alert('کلاس منتخب کریں'); return; }

  const cls   = (storedData.classes||[]).find(c => c.id === clsId);
  const exam  = (storedData.monthlyExams||[]).find(r => r.classId === clsId && r.month === month && r.year == year);

  if (!exam) {
    area.innerHTML = `<div class="empty-dashboard-state">${cls?.name||''} — ${month} ${year} کا کوئی ریکارڈ موجود نہیں</div>`;
    return;
  }

  const avg = exam.students.reduce((s,r)=>s+(r.pct||0),0)/exam.students.length;
  const gd  = meGrade(avg);

  const rows = exam.students.map((s,i) => {
    const sg = meGrade(s.pct||0);
    return `<tr>
      <td style="text-align:center;">${i+1}</td>
      <td style="text-align:center;font-size:0.78rem;color:var(--muted);">${s.regNo||'-'}</td>
      <td style="text-align:right;font-weight:700;padding-right:10px;">${s.name||'-'}</td>
      ${ME_COLS.filter(c=>!c.sub&&c.max).map(c=>`<td style="text-align:center;">${s[c.key]??0}/${c.max}</td>`).join('')}
      <td style="text-align:center;">${s.para||'—'}</td>
      <td style="text-align:center;">${s.tarkoo||'—'}</td>
      <td style="text-align:center;font-weight:700;">${s.total}</td>
      <td style="text-align:center;font-weight:700;color:${sg.cls.includes('total-a')?'#15803d':sg.cls.includes('total-b')?'#1d4ed8':sg.cls.includes('total-c')?'#d97706':'#dc2626'}">${s.pct}% (${s.grade})</td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.4rem; font-weight:800; color:var(--accent);">ماہانہ جائزہ رپورٹ</div>
        <div style="font-size:1rem; color:var(--muted);">${exam.className} — ${month} ${year}</div>
        <div style="font-size:0.9rem; color:var(--accent-2); margin-top:4px;">اوسط: ${avg.toFixed(1)}% (${gd.g}) | طلباء: ${exam.students.length}</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
          <thead>
            <tr style="background:var(--accent); color:#fff;">
              <th style="padding:8px;">نمبر</th>
              <th style="padding:8px;">ID</th>
              <th style="padding:8px;">نام</th>
              ${ME_COLS.filter(c=>!c.sub&&c.max).map(c=>`<th style="padding:8px;">${c.label}</th>`).join('')}
              <th style="padding:8px;">پارہ</th>
              <th style="padding:8px;">ترکو</th>
              <th style="padding:8px;">کل</th>
              <th style="padding:8px;">فیصد</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function printClassReport() {
  const clsId = document.getElementById('crClassSelect').value;
  const month = document.getElementById('crMonth').value;
  const year  = document.getElementById('crYear').value;
  if (!clsId) { alert('پہلے رپورٹ دیکھیں'); return; }
  const area = document.getElementById('classReportArea');
  const print = document.getElementById('classReportPrintArea');
  if (!area.innerHTML.trim()) { renderClassReport(); }
  print.innerHTML = area.innerHTML;
  print.style.display = 'block';
  setTimeout(() => { window.print(); }, 100);
}

/* ===== طالب علم کی انفرادی رپورٹ ===== */
function renderStudentReport() {
  const id   = document.getElementById('srStudentId').value.trim();
  const area = document.getElementById('studentReportArea');
  if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }

  const student = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo === id);
  if (!student) { area.innerHTML = '<div class="empty-dashboard-state">کوئی طالب علم نہیں ملا</div>'; return; }

  const exams = (storedData.monthlyExams||[]).filter(exam =>
    exam.students && exam.students.some(s => s.regNo === id)
  ).sort((a,b) => a.year - b.year || 0);

  if (!exams.length) {
    area.innerHTML = `<div class="empty-dashboard-state">${student.name} کا کوئی جائزہ ریکارڈ موجود نہیں</div>`;
    return;
  }

  const rows = exams.map(exam => {
    const s  = exam.students.find(s => s.regNo === id);
    const sg = meGrade(s?.pct||0);
    return `<tr>
      <td style="text-align:center;">${exam.month} ${exam.year}</td>
      <td style="text-align:right;padding-right:10px;">${exam.className}</td>
      ${ME_COLS.filter(c=>!c.sub&&c.max).map(c=>`<td style="text-align:center;">${s?.[c.key]??0}/${c.max}</td>`).join('')}
      <td style="text-align:center;">${s?.para||'—'}</td>
      <td style="text-align:center;">${s?.tarkoo||'—'}</td>
      <td style="text-align:center;font-weight:700;">${s?.total??0}</td>
      <td style="text-align:center;font-weight:700;color:${sg.cls.includes('total-a')?'#15803d':sg.cls.includes('total-b')?'#1d4ed8':sg.cls.includes('total-c')?'#d97706':'#dc2626'}">${s?.pct??0}% (${s?.grade||'—'})</td>
    </tr>`;
  }).join('');

  const avgAll = exams.reduce((s,e) => { const st=e.students.find(x=>x.regNo===id); return s+(st?.pct||0); },0) / exams.length;

  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.4rem; font-weight:800; color:var(--accent);">انفرادی رپورٹ</div>
        <div style="font-size:1.1rem; font-weight:700;">${student.name}</div>
        <div style="font-size:0.9rem; color:var(--muted);">والد: ${student.admFatherName||'—'} | ID: ${id}</div>
        <div style="font-size:0.9rem; color:var(--accent-2); margin-top:4px;">مجموعی اوسط: ${avgAll.toFixed(1)}% (${meGrade(avgAll).g})</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
          <thead>
            <tr style="background:var(--accent); color:#fff;">
              <th style="padding:8px;">مہینہ</th>
              <th style="padding:8px;">کلاس</th>
              ${ME_COLS.filter(c=>!c.sub&&c.max).map(c=>`<th style="padding:8px;">${c.label}</th>`).join('')}
              <th style="padding:8px;">پارہ</th>
              <th style="padding:8px;">ترکو</th>
              <th style="padding:8px;">کل</th>
              <th style="padding:8px;">فیصد</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="text-align:center; margin-top:14px;">
        <button onclick="printStudentReport()" style="background:var(--accent-2); color:#fff; border:none; padding:10px 28px; border-radius:8px; cursor:pointer; font-weight:700;">پرنٹ کریں</button>
      </div>
    </div>`;
}

function printStudentReport() {
  const area  = document.getElementById('studentReportArea');
  const print = document.getElementById('studentReportPrintArea');
  print.innerHTML = area.innerHTML;
  print.style.display = 'block';
  setTimeout(() => { window.print(); }, 100);
}

/* ===== نتیجہ ماہانہ جائزہ — پورا ادارہ ===== */
function renderInstituteResult() {
  const month = document.getElementById('irMonth').value;
  const year  = document.getElementById('irYear').value;
  const area  = document.getElementById('instituteResultArea');

  const exams = (storedData.monthlyExams||[]).filter(r => r.month === month && r.year == year);

  if (!exams.length) {
    area.innerHTML = `<div class="empty-dashboard-state">${month} ${year} کا کوئی ریکارڈ موجود نہیں</div>`;
    return;
  }

  const totalStudents = exams.reduce((s,e) => s+e.students.length, 0);
  const overallAvg    = exams.reduce((s,e) => s+e.students.reduce((ss,st)=>ss+(st.pct||0),0), 0) / totalStudents;

  const classRows = exams.map(exam => {
    const avg   = exam.students.reduce((s,r)=>s+(r.pct||0),0)/exam.students.length;
    const gd    = meGrade(avg);
    const best  = exam.students.reduce((a,b)=>(a.pct||0)>=(b.pct||0)?a:b, exam.students[0]);
    return `<tr>
      <td style="text-align:right;font-weight:700;padding:10px 14px;">${exam.className}</td>
      <td style="text-align:center;padding:10px;">${exam.students.length}</td>
      <td style="text-align:center;padding:10px;font-weight:700;color:${gd.cls.includes('total-a')?'#15803d':gd.cls.includes('total-b')?'#1d4ed8':gd.cls.includes('total-c')?'#d97706':'#dc2626'}">${avg.toFixed(1)}%</td>
      <td style="text-align:center;padding:10px;font-weight:700;">${gd.g}</td>
      <td style="text-align:right;padding:10px;">${best?.name||'—'} (${best?.pct||0}%)</td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.5rem; font-weight:800; color:var(--accent);">نتیجہ ماہانہ جائزہ</div>
        <div style="font-size:1rem; color:var(--muted);">${month} ${year} — پورا ادارہ</div>
      </div>

      <!-- خلاصہ کارڈز -->
      <div style="display:flex; gap:14px; flex-wrap:wrap; margin-bottom:20px;">
        <div style="flex:1; min-width:140px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px; text-align:center;">
          <div style="font-size:0.85rem; color:#15803d;">کل کلاسز</div>
          <div style="font-size:2rem; font-weight:800; color:#15803d;">${exams.length}</div>
        </div>
        <div style="flex:1; min-width:140px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:10px; padding:14px; text-align:center;">
          <div style="font-size:0.85rem; color:#1d4ed8;">کل طلباء</div>
          <div style="font-size:2rem; font-weight:800; color:#1d4ed8;">${totalStudents}</div>
        </div>
        <div style="flex:1; min-width:140px; background:#fefce8; border:1px solid #fde68a; border-radius:10px; padding:14px; text-align:center;">
          <div style="font-size:0.85rem; color:#b45309;">مجموعی اوسط</div>
          <div style="font-size:2rem; font-weight:800; color:#b45309;">${overallAvg.toFixed(1)}%</div>
          <div style="font-size:0.9rem; font-weight:700; color:#b45309;">${meGrade(overallAvg).g}</div>
        </div>
      </div>

      <!-- کلاس وار خلاصہ -->
      <h4 style="color:var(--accent); margin:0 0 10px 0;">کلاس وار نتیجہ</h4>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
          <thead>
            <tr style="background:var(--accent); color:#fff;">
              <th style="padding:10px 14px;">کلاس</th>
              <th style="padding:10px;">طلباء</th>
              <th style="padding:10px;">اوسط</th>
              <th style="padding:10px;">گریڈ</th>
              <th style="padding:10px;">نمایاں طالب علم</th>
            </tr>
          </thead>
          <tbody>${classRows}</tbody>
        </table>
      </div>
    </div>`;
}

function printInstituteResult() {
  const area  = document.getElementById('instituteResultArea');
  const print = document.getElementById('instituteResultPrintArea');
  if (!area.innerHTML.trim()) { renderInstituteResult(); }
  print.innerHTML = area.innerHTML;
  print.style.display = 'block';
  setTimeout(() => { window.print(); }, 100);
}



/* ========== ATTENDANCE LOGIC ========== */
function toggleAttendanceView() {
    const val = document.getElementById('attendanceTypeSelect').value;
    document.getElementById('studentAttendanceContainer').style.display = (val === 'student') ? 'block' : 'none';
    document.getElementById('staffAttendanceContainer').style.display = (val === 'staff') ? 'block' : 'none';
    
    if (val === 'student') {
        // Keep class list in sync with latest saved classes.
        populateClassSelects();
        const today = new Date().toISOString().split('T')[0];
        if (!document.getElementById('studentAttDate').value) {
            document.getElementById('studentAttDate').value = today;
        }
        loadStudentAttendance();
    } else if (val === 'staff') {
        const flow = storedData.staffAttendanceFlow || {};
        const today = new Date().toISOString().split('T')[0];
        if (flow.pendingDate && flow.checkInSaved && !flow.checkOutSaved) {
            document.getElementById('staffAttDate').value = flow.pendingDate;
            document.getElementById('staffAttendanceSession').value = 'checkout';
        } else {
            if (!document.getElementById('staffAttDate').value) {
                document.getElementById('staffAttDate').value = today;
            }
            if (!document.getElementById('staffAttendanceSession').value) {
                document.getElementById('staffAttendanceSession').value = 'checkin';
            }
        }
        loadStaffAttendance();
    }
}

function clearAttendanceHistoryView() {
    const area = document.getElementById('attendanceHistoryArea');
    if (area) area.innerHTML = '';
}

function showAttendanceHistory() {
    const type = document.getElementById('attendanceTypeSelect').value;
    const area = document.getElementById('attendanceHistoryArea');
    if (!area) return;

    if (type === 'student') {
        const daily = storedData.dailyAttendance || {};
        const rows = [];
        Object.keys(daily).forEach(classId => {
            const dateMap = daily[classId] || {};
            Object.keys(dateMap).forEach(date => {
                const entries = dateMap[date] || {};
                const regNos = Object.keys(entries);
                let present = 0, absent = 0, leave = 0;
                regNos.forEach(reg => {
                    const status = entries[reg]?.status || 'present';
                    if (status === 'present') present++;
                    else if (status === 'absent') absent++;
                    else if (status === 'leave') leave++;
                });
                const cls = (storedData.classes || []).find(c => c.id === classId);
                rows.push({
                    date,
                    className: cls ? (cls.name || cls.className || classId) : classId,
                    total: regNos.length,
                    present,
                    absent,
                    leave
                });
            });
        });

        rows.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (rows.length === 0) {
            area.innerHTML = '<div class="empty-dashboard-state">طلباء کی کوئی محفوظ حاضری موجود نہیں۔</div>';
            return;
        }

        area.innerHTML = `
            <div class="table-responsive" style="margin-top:10px;">
                <table>
                    <thead>
                        <tr>
                            <th>تاریخ</th>
                            <th>کلاس</th>
                            <th>کل طلباء</th>
                            <th>حاضر</th>
                            <th>غیر حاضر</th>
                            <th>رخصت</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr>
                                <td>${r.date}</td>
                                <td>${r.className}</td>
                                <td>${r.total}</td>
                                <td style="color:#2e7d32; font-weight:bold;">${r.present}</td>
                                <td style="color:#c62828; font-weight:bold;">${r.absent}</td>
                                <td style="color:#ef6c00; font-weight:bold;">${r.leave}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
        return;
    }

    const staff = storedData.staffAttendance || {};
    const detailedRows = [];
    Object.keys(staff).forEach(date => {
        const dateEntries = staff[date] || {};
        Object.keys(dateEntries).forEach(teacherKey => {
            const rec = dateEntries[teacherKey] || {};
            detailedRows.push({
                date,
                teacherId: rec.teacherId || teacherKey,
                teacherName: rec.teacherName || teacherKey,
                status: rec.status || 'present',
                checkIn: rec.checkIn || '-',
                checkOut: rec.checkOut || '-',
                lateMinutes: Number(rec.lateMinutes || 0),
                earlyLeaveMinutes: Number(rec.earlyLeaveMinutes || 0)
            });
        });
    });
    detailedRows.sort((a, b) => new Date(b.date) - new Date(a.date) || a.teacherName.localeCompare(b.teacherName, 'ur'));

    if (detailedRows.length === 0) {
        area.innerHTML = '<div class="empty-dashboard-state">عملے کی کوئی محفوظ حاضری موجود نہیں۔</div>';
        return;
    }

    const monthlyMap = {};
    detailedRows.forEach(r => {
        const month = r.date.slice(0, 7);
        const key = `${month}|${r.teacherId}`;
        if (!monthlyMap[key]) {
            monthlyMap[key] = {
                month,
                teacherId: r.teacherId,
                teacherName: r.teacherName,
                present: 0,
                absent: 0,
                leave: 0,
                totalLateMinutes: 0,
                totalEarlyLeaveMinutes: 0
            };
        }
        if (r.status === 'present') monthlyMap[key].present++;
        else if (r.status === 'absent') monthlyMap[key].absent++;
        else if (r.status === 'leave') monthlyMap[key].leave++;
        monthlyMap[key].totalLateMinutes += r.lateMinutes;
        monthlyMap[key].totalEarlyLeaveMinutes += r.earlyLeaveMinutes;
    });
    const monthlyRows = Object.values(monthlyMap).sort((a, b) => b.month.localeCompare(a.month) || Number(a.teacherId) - Number(b.teacherId));

    area.innerHTML = `
        <div class="table-responsive" style="margin-top:10px;">
            <table>
                <thead>
                    <tr>
                        <th>تاریخ</th>
                        <th>ٹیچر ID</th>
                        <th>نام استاد</th>
                        <th>حیثیت</th>
                        <th>آمد</th>
                        <th>روانگی</th>
                        <th>دیر (منٹ)</th>
                        <th>جلد روانگی (منٹ)</th>
                    </tr>
                </thead>
                <tbody>
                    ${detailedRows.map(r => `
                        <tr>
                            <td>${r.date}</td>
                            <td>${r.teacherId}</td>
                            <td>${r.teacherName}</td>
                            <td>${r.status}</td>
                            <td>${r.checkIn}</td>
                            <td>${r.checkOut}</td>
                            <td style="color:${r.lateMinutes > 0 ? '#c62828' : '#2e7d32'}; font-weight:bold;">${r.lateMinutes}</td>
                            <td style="color:${r.earlyLeaveMinutes > 0 ? '#f57c00' : '#2e7d32'}; font-weight:bold;">${r.earlyLeaveMinutes}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        <h3 style="margin:18px 0 10px 0; color:var(--accent);">ماہانہ تنخواہ کیلکولیشن خلاصہ</h3>
        <div class="table-responsive" style="margin-top:10px;">
            <table>
                <thead>
                    <tr>
                        <th>ماہ</th>
                        <th>ٹیچر ID</th>
                        <th>نام استاد</th>
                        <th>حاضر دن</th>
                        <th>غیر حاضر</th>
                        <th>رخصت</th>
                        <th>کل دیر (منٹ)</th>
                        <th>کل جلد روانگی (منٹ)</th>
                    </tr>
                </thead>
                <tbody>
                    ${monthlyRows.map(r => `
                        <tr>
                            <td>${r.month}</td>
                            <td>${r.teacherId}</td>
                            <td>${r.teacherName}</td>
                            <td>${r.present}</td>
                            <td>${r.absent}</td>
                            <td>${r.leave}</td>
                            <td>${r.totalLateMinutes}</td>
                            <td>${r.totalEarlyLeaveMinutes}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function loadStudentAttendance() {
    const date = document.getElementById('studentAttDate').value;
    const classId = document.getElementById('studentAttClass').value;
    const listArea = document.getElementById('studentAttendanceListArea');
    const btnContainer = document.getElementById('saveStudentAttBtnContainer');
    
    if (!date || !classId) {
        listArea.innerHTML = '<p style="text-align:center; color:var(--muted);">تاریخ اور کلاس منتخب کریں۔</p>';
        btnContainer.style.display = 'none';
        return;
    }
    
    const students = getStudentsInClass(classId);
    if (students.length === 0) {
        listArea.innerHTML = '<p style="text-align:center; color:var(--muted);">اس کلاس میں کوئی طالب علم موجود نہیں۔</p>';
        btnContainer.style.display = 'none';
        return;
    }
    
    const savedAtt = (storedData.dailyAttendance[classId] && storedData.dailyAttendance[classId][date]) || {};
    
    let html = '<div class="table-responsive" style="margin-top:20px;"><table><thead><tr><th>ID</th><th>نام طالب علم</th><th>حاضری کی حیثیت</th><th>ریمارکس (اگر کوئی ہوں)</th></tr></thead><tbody>';
    
    students.forEach(s => {
        const status = savedAtt[s.admRegNo]?.status || 'present';
        const remarks = savedAtt[s.admRegNo]?.remarks || '';
        
        html += `<tr>
            <td>${s.admRegNo}</td>
            <td><strong>${s.name}</strong><br><span style="font-size:0.8rem; color:#666;">${s.admFatherName}</span></td>
            <td>
                <select id="att-status-${s.admRegNo}" style="width: auto; min-width: 150px; padding: 5px;">
                    <option value="present" ${status === 'present' ? 'selected' : ''}>حاضر (Present)</option>
                    <option value="absent" ${status === 'absent' ? 'selected' : ''}>غیر حاضر (Absent)</option>
                    <option value="leave" ${status === 'leave' ? 'selected' : ''}>رخصت (Leave)</option>
                </select>
            </td>
            <td><input type="text" id="att-remarks-${s.admRegNo}" value="${remarks}" placeholder="ریمارکس..." style="width:100%; padding: 5px;"></td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    listArea.innerHTML = html;
    btnContainer.style.display = 'block';
}

function saveStudentAttendance() {
    const date = document.getElementById('studentAttDate').value;
    const classId = document.getElementById('studentAttClass').value;
    
    if (!date || !classId) return;
    
    const students = getStudentsInClass(classId);
    let attRecord = {};
    
    students.forEach(s => {
        const status = document.getElementById(`att-status-${s.admRegNo}`).value;
        const remarks = document.getElementById(`att-remarks-${s.admRegNo}`).value.trim();
        attRecord[s.admRegNo] = { status, remarks };
    });
    
    if (!storedData.dailyAttendance) storedData.dailyAttendance = {};
    if (!storedData.dailyAttendance[classId]) storedData.dailyAttendance[classId] = {};
    storedData.dailyAttendance[classId][date] = attRecord;
    
    saveToLocal();
    showAttendanceHistory();
    alert("حاضری کامیابی سے محفوظ ہو گئی۔");
}

function getUniqueTeachers() {
    const teachers = new Set();
    (storedData.staffProfiles || []).forEach(s => {
        if (s.name) teachers.add(s.name.trim());
    });
    (storedData.classes || []).forEach(c => {
        if (c.teacher) teachers.add(c.teacher.trim());
    });
    return Array.from(teachers);
}

function getStaffForAttendance() {
    if ((storedData.staffProfiles || []).length > 0) {
        return [...storedData.staffProfiles]
            .sort((a, b) => Number(a.staffCode || 0) - Number(b.staffCode || 0))
            .map(s => ({
                teacherId: String(s.staffCode),
                name: s.name || '-',
                shiftStart: s.shiftStart || '06:50',
                shiftEnd: s.shiftEnd || '14:45'
            }));
    }
    return getUniqueTeachers().map((name, idx) => ({
        teacherId: String(1001 + idx),
        name,
        shiftStart: '06:50',
        shiftEnd: '14:45'
    }));
}

function getMinutesDifference(actualTime, expectedTime) {
    if (!actualTime || !expectedTime) return 0;
    const [aH, aM] = actualTime.split(':').map(Number);
    const [eH, eM] = expectedTime.split(':').map(Number);
    if ([aH, aM, eH, eM].some(n => Number.isNaN(n))) return 0;
    return (aH * 60 + aM) - (eH * 60 + eM);
}

function populateStaffClassOptions() {
    const select = document.getElementById('staffClass');
    if (!select) return;
    const classes = storedData.classes || [];
    select.innerHTML = '<option value="">کلاس منتخب کریں...</option>' + classes.map(cls => `<option value="${cls.id}">${cls.name || cls.className || cls.id}</option>`).join('');
}

function clearStaffForm() {
    ['staffName', 'staffFatherName', 'staffCnic', 'staffPhone', 'staffWhatsapp', 'staffAddress', 'staffQualification', 'staffExperience', 'staffReference', 'staffNotes']
        .forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
    const classEl = document.getElementById('staffClass');
    if (classEl) classEl.value = '';
    const residenceEl = document.getElementById('staffResidenceStatus');
    if (residenceEl) residenceEl.value = 'ذاتی مکان';
    const joiningEl = document.getElementById('staffJoiningDate');
    if (joiningEl) joiningEl.value = '';
    const shiftStartEl = document.getElementById('staffShiftStart');
    if (shiftStartEl) shiftStartEl.value = '06:50';
    const shiftEndEl = document.getElementById('staffShiftEnd');
    if (shiftEndEl) shiftEndEl.value = '14:45';
}

function saveStaffProfile() {
    const name = document.getElementById('staffName').value.trim();
    const fatherName = document.getElementById('staffFatherName').value.trim();
    const cnic = document.getElementById('staffCnic').value.trim();
    const assignedClass = document.getElementById('staffClass').value;
    const phone = document.getElementById('staffPhone').value.trim();
    const whatsapp = document.getElementById('staffWhatsapp').value.trim();
    const residenceStatus = document.getElementById('staffResidenceStatus').value;
    const address = document.getElementById('staffAddress').value.trim();
    const qualification = document.getElementById('staffQualification').value.trim();
    const joiningDate = document.getElementById('staffJoiningDate').value;
    const shiftStart = document.getElementById('staffShiftStart').value || '06:50';
    const shiftEnd = document.getElementById('staffShiftEnd').value || '14:45';
    const experience = document.getElementById('staffExperience').value.trim();
    const reference = document.getElementById('staffReference').value.trim();
    const notes = document.getElementById('staffNotes').value.trim();

    if (!name || !fatherName || !phone) {
        alert('براہ کرم نام، والد کا نام اور فون نمبر لازمی درج کریں۔');
        return;
    }

    const classObj = (storedData.classes || []).find(c => c.id === assignedClass);
    const profile = {
        id: `staff-${Date.now()}`,
        staffCode: Number(storedData.staffIdCounter || 1001),
        name,
        fatherName,
        cnic,
        phone,
        whatsapp,
        assignedClass,
        assignedClassName: classObj ? (classObj.name || classObj.className || classObj.id) : '',
        residenceStatus,
        address,
        qualification,
        joiningDate,
        shiftStart,
        shiftEnd,
        experience,
        reference,
        notes,
        createdAt: new Date().toISOString()
    };

    if (!storedData.staffProfiles) storedData.staffProfiles = [];
    storedData.staffProfiles.push(profile);
    storedData.staffIdCounter = Number(profile.staffCode) + 1;

    if (classObj) classObj.teacher = name;

    saveToLocal();
    populateClassSelects();
    renderClassCards();
    renderStaffList();
    clearStaffForm();
    alert('اسٹاف پروفائل کامیابی سے محفوظ ہو گیا۔');
}

function renderStaffList() {
    const area = document.getElementById('staffListArea');
    if (!area) return;
    const query = (document.getElementById('staffSearch')?.value || '').trim().toLowerCase();
    const list = [...(storedData.staffProfiles || [])].sort((a, b) => Number(a.staffCode || 0) - Number(b.staffCode || 0));
    const filtered = list.filter(s => {
        if (!query) return true;
        return `${s.name || ''} ${s.fatherName || ''} ${s.assignedClassName || ''}`.toLowerCase().includes(query);
    });

    if (filtered.length === 0) {
        area.innerHTML = '<div class="empty-dashboard-state">ابھی تک کوئی اسٹاف پروفائل موجود نہیں۔</div>';
        return;
    }

    // اوتار رنگ — نام کے پہلے حرف سے
    const avatarColors = [
      '#0d3b66','#185086','#1a6b3c','#7c3aed','#db2777',
      '#d97706','#0891b2','#dc2626','#059669','#9333ea'
    ];
    function getAvatarColor(name) {
      const code = (name || 'A').charCodeAt(0);
      return avatarColors[code % avatarColors.length];
    }
    function firstChar(name) {
      const n = (name || '؟').trim();
      return n.charAt(0).toUpperCase();
    }

    area.innerHTML = filtered.map((s, idx) => {
      const color = getAvatarColor(s.name);
      const initial = firstChar(s.name);
      const code = s.staffCode || (1000 + idx + 1);

      return `
        <div class="staff-card-new">

          <!-- اوپر دائیں — ترمیم / حذف -->
          <div class="staff-card-actions">
            <button class="staff-action-btn staff-edit-btn" style="width:auto; padding:0 8px;"
              onclick="editStaffProfile('${code}')" title="ترمیم">ترمیم</button>
            <button class="staff-action-btn staff-delete-btn" style="width:auto; padding:0 8px;"
              onclick="deleteStaffProfile('${code}')" title="حذف">حذف</button>
          </div>

          <!-- اوتار + نام -->
          <div class="staff-card-top">
            <div class="staff-avatar" style="background:${color};">${initial}</div>
            <div>
              <div class="staff-card-name">${s.name || '-'}</div>
              <span class="staff-card-id">ID: ${code}</span>
              <div class="staff-card-father">والد: ${s.fatherName || '-'}</div>
            </div>
          </div>

          <!-- تفصیلات گرڈ -->
          <div class="staff-details-grid">
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">تفویض کردہ کلاس</span>
                <span class="staff-detail-val">${s.assignedClassName || 'تفویض نہیں'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">فون نمبر</span>
                <span class="staff-detail-val">${s.phone || '-'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">واٹس ایپ</span>
                <span class="staff-detail-val">${s.whatsapp || '-'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">شناختی کارڈ</span>
                <span class="staff-detail-val">${s.cnic || '-'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">تعلیمی قابلیت</span>
                <span class="staff-detail-val">${s.qualification || '-'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">تقرری</span>
                <span class="staff-detail-val">${s.joiningDate || '-'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">ڈیوٹی اوقات</span>
                <span class="staff-detail-val">${s.shiftStart || '06:50'} — ${s.shiftEnd || '14:45'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">رہائش</span>
                <span class="staff-detail-val">${s.residenceStatus || '-'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">پتہ</span>
                <span class="staff-detail-val">${s.address || '-'}</span>
              </div>
            </div>
            <div class="staff-detail-item">
              <span class="staff-detail-icon"></span>
              <div>
                <span class="staff-detail-label">سابقہ تجربہ</span>
                <span class="staff-detail-val">${s.experience || '-'}</span>
              </div>
            </div>
          </div>
          ${s.notes ? `<div class="staff-card-notes">${s.notes}</div>` : ''}
        </div>
      `;
    }).join('');
}

function isStudentCompleted(profile, progressRecords) {
    const statusText = [
        profile?.status,
        profile?.admStatus,
        profile?.completionStatus,
        profile?.studentStatus
    ].filter(Boolean).join(' ').toLowerCase();

    if (profile?.isCompleted || profile?.completed || profile?.isHafiz) return true;
    if (/(hafiz|complete|completed|graduate|graduated|فارغ|حافظ|مکمل)/i.test(statusText)) return true;

    return progressRecords.some(record => {
        const joined = Object.values(record || {}).join(' ').toLowerCase();
        return /(hafiz|complete|completed|فارغ|حافظ|مکمل)/i.test(joined);
    });
}

/* ========== DASHBOARD METRICS ========== */
function populateDashboard() {
    // Set current date
    const today = new Date();
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('dashboardDate').textContent = today.toLocaleDateString('ur-PK', dateOptions);

    // Live clock
    function updateClock() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
        const el = document.getElementById('dashboardTime');
        if (el) el.textContent = timeStr;
    }
    updateClock();
    if (!window._dashClockInterval) {
        window._dashClockInterval = setInterval(updateClock, 1000);
    }
    
    const records = storedData.records || [];
    const admissionProfiles = records.filter(r => r.isAdmissionProfile);
    const activeAdmissions = admissionProfiles.filter(r => !r.isWithdrawn);
    const withdrawnAdmissions = admissionProfiles.filter(r => r.isWithdrawn);
    const progressRecords = records.filter(r => !r.isAdmissionProfile);

    // Calculate metrics
    const totalStudents = activeAdmissions.length;
    const withdrawnStudents = withdrawnAdmissions.length;
    const totalAdmitted = admissionProfiles.length;
    const staffCount = getUniqueTeachers().length;
    const completedStudents = admissionProfiles.filter(profile => {
        const relatedRecords = progressRecords.filter(record =>
            record.studentId === profile.admRegNo ||
            record.studentName === profile.name ||
            record.name === profile.name
        );
        return isStudentCompleted(profile, relatedRecords);
    }).length;
    const learningRecordsCount = progressRecords.length;
    const classCount = (storedData.classes || []).length;
    const activeRate = totalAdmitted > 0 ? ((totalStudents / totalAdmitted) * 100).toFixed(1) : '0.0';
    const completionRate = totalAdmitted > 0 ? ((completedStudents / totalAdmitted) * 100).toFixed(1) : '0.0';

    const studentsByClass = (storedData.classes || []).map(cls => {
        const count = activeAdmissions.filter(student => student.admClass === cls.id).length;
        return {
            id: cls.id,
            name: cls.className || 'بلا نام کلاس',
            teacher: cls.teacher || 'استاد درج نہیں',
            count
        };
    }).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ur'));

    const recentAdmissions = [...admissionProfiles]
        .sort((a, b) => new Date(b.admDate || 0) - new Date(a.admDate || 0) || compareByRegistrationNumber(a, b))
        .slice(0, 5);
    
    // Create dashboard HTML
    let dashboardHTML = `
        <div class="dashboard-card success">
            <div class="dashboard-icon"></div>
            <div class="card-label">فی الوقت طلباء</div>
            <div class="card-number">${totalStudents}</div>
            <div class="card-description">فعال اور داخل شدہ</div>
        </div>
        
        <div class="dashboard-card warning">
            <div class="dashboard-icon"></div>
            <div class="card-label">تکمیل شدہ</div>
            <div class="card-number">${completedStudents}</div>
            <div class="card-description">حافظ / مکمل شدہ طلباء</div>
        </div>
        
        <div class="dashboard-card danger">
            <div class="dashboard-icon"></div>
            <div class="card-label">خارج شدہ</div>
            <div class="card-number">${withdrawnStudents}</div>
            <div class="card-description">نکالے گئے طلباء</div>
        </div>
        
        <div class="dashboard-card info">
            <div class="dashboard-icon"></div>
            <div class="card-label">عملہ</div>
            <div class="card-number">${staffCount}</div>
            <div class="card-description">اساتذہ / درسگاہ</div>
        </div>
    `;
    
    document.getElementById('dashboardMetrics').innerHTML = dashboardHTML;
    
    const totalRecordsCount = records.length;
    
    let statsHTML = `
        <div class="mini-stat">
            <div class="mini-stat-label">کل داخلے</div>
            <div class="mini-stat-value">${totalAdmitted}</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-label">فعال شرح</div>
            <div class="mini-stat-value">${activeRate}%</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-label">کلاسز</div>
            <div class="mini-stat-value">${classCount}</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-label">کل ریکارڈز</div>
            <div class="mini-stat-value">${totalRecordsCount}</div>
        </div>
    `;
    
    document.getElementById('detailedStats').innerHTML = statsHTML;

    document.getElementById('dashboardHighlights').innerHTML = `
        <div class="mini-stat">
            <div class="mini-stat-label">تکمیل کی شرح</div>
            <div class="mini-stat-value">${completionRate}%</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-label">تعلیمی اندراجات</div>
            <div class="mini-stat-value">${learningRecordsCount}</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-label">فعال کلاسز</div>
            <div class="mini-stat-value">${studentsByClass.filter(c => c.count > 0).length}</div>
        </div>
        <div class="mini-stat">
            <div class="mini-stat-label">اوسط طلباء فی کلاس</div>
            <div class="mini-stat-value">${classCount > 0 ? (totalStudents / classCount).toFixed(1) : '0.0'}</div>
        </div>
    `;

    const classOverviewEl = document.getElementById('dashboardClassOverview');
    if (studentsByClass.length === 0) {
        classOverviewEl.innerHTML = '<div class="empty-dashboard-state">ابھی تک کوئی کلاس درج نہیں کی گئی۔</div>';
    } else {
        const highestClassStrength = Math.max(...studentsByClass.map(c => c.count), 1);
        classOverviewEl.innerHTML = `
            <div class="progress-list">
                ${studentsByClass.map(cls => `
                    <div>
                        <div class="progress-item-header">
                            <div>${cls.name}<br><span style="font-size:0.82rem; color:var(--muted);">${cls.teacher}</span></div>
                            <strong>${cls.count} طلباء</strong>
                        </div>
                        <div class="progress-track">
                            <div class="progress-fill" style="width:${(cls.count / highestClassStrength) * 100}%"></div>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    const recentAdmissionsEl = document.getElementById('dashboardRecentAdmissions');
    if (recentAdmissions.length === 0) {
        recentAdmissionsEl.innerHTML = '<div class="empty-dashboard-state">ابھی تک کوئی داخلہ محفوظ نہیں ہوا۔</div>';
    } else {
        recentAdmissionsEl.innerHTML = `
            <div class="dashboard-list">
                ${recentAdmissions.map(student => `
                    <div class="dashboard-list-item">
                        <div class="dashboard-list-text">
                            <strong>${student.name || '-'}</strong>
                            <small>${student.admFatherName || '-'} | داخلہ: ${student.admDate || '-'}</small>
                        </div>
                        <div class="dashboard-pill">Reg # ${student.admRegNo || '-'}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }
}

function loadStaffAttendance() {
    const date = document.getElementById('staffAttDate').value;
    const listArea = document.getElementById('staffAttendanceListArea');
    const btnContainer = document.getElementById('saveStaffAttBtnContainer');
    const session = document.getElementById('staffAttendanceSession').value;
    const lockInfo = document.getElementById('staffAttendanceLockInfo');
    const lock = storedData.staffAttendanceFlow || {};
    const lockedDate = lock.pendingDate || '';
    const hasPending = lock.checkInSaved && !lock.checkOutSaved && !!lockedDate;
    
    if (!date) {
        listArea.innerHTML = '<p style="text-align:center; color:var(--muted);">پہلے تاریخ منتخب کریں۔</p>';
        btnContainer.style.display = 'none';
        if (lockInfo) lockInfo.style.display = 'none';
        return;
    }

    if (hasPending && date !== lockedDate) {
        document.getElementById('staffAttDate').value = lockedDate;
        if (lockInfo) {
            lockInfo.style.display = 'block';
            lockInfo.textContent = `پہلے ${lockedDate} کی چیک آؤٹ مکمل کریں، پھر نئی تاریخ منتخب کریں۔`;
        }
        return loadStaffAttendance();
    }
    
    const staffMembers = getStaffForAttendance();
    if (staffMembers.length === 0) {
         listArea.innerHTML = '<p style="text-align:center; color:var(--muted);">سسٹم میں کوئی استاد موجود نہیں ہے۔ کلاسز والے حصے میں جا کر کلاس اور استاد شامل کریں۔</p>';
         btnContainer.style.display = 'none';
         if (lockInfo) lockInfo.style.display = 'none';
         return;
    }
    
    const savedAtt = storedData.staffAttendance[date] || {};
    
    let html = '<div class="table-responsive" style="margin-top:20px;"><table><thead><tr><th>ٹیچر ID</th><th>نام استاد</th><th>معیاری وقت</th><th>حیثیت</th><th>آمد کا وقت (Check-in)</th><th>روانگی کا وقت (Check-out)</th><th>ریمارکس</th></tr></thead><tbody>';
    
    staffMembers.forEach((staff, i) => {
        const id = 'staff_' + i;
        const record = savedAtt[staff.teacherId] || savedAtt[staff.name] || { status: 'present', checkIn: '', checkOut: '', remarks: '', lateMinutes: 0, earlyLeaveMinutes: 0 };
        
        const displayCheckIn = record.checkIn || staff.shiftStart;
        const displayCheckOut = record.checkOut || staff.shiftEnd;
        
        html += `<tr>
            <td data-teacher-id="${staff.teacherId}" data-teacher-name="${staff.name}"><strong>${staff.teacherId}</strong></td>
            <td><strong>${staff.name}</strong></td>
            <td><span style="font-size:0.85rem; color:#555;">${staff.shiftStart} تا ${staff.shiftEnd}</span></td>
            <td>
                <select id="staff-status-${id}" style="width: auto; min-width: 120px; padding: 5px;" onchange="toggleStaffTimes('${id}')">
                    <option value="present" ${record.status === 'present' ? 'selected' : ''}>حاضر (Present)</option>
                    <option value="absent" ${record.status === 'absent' ? 'selected' : ''}>غیر حاضر (Absent)</option>
                    <option value="leave" ${record.status === 'leave' ? 'selected' : ''}>رخصت (Leave)</option>
                </select>
            </td>
            <td><input type="time" id="staff-in-${id}" value="${displayCheckIn}" data-default-in="${staff.shiftStart}" ${record.status !== 'present' || session === 'checkout' ? 'disabled' : ''}></td>
            <td><input type="time" id="staff-out-${id}" value="${displayCheckOut}" data-default-out="${staff.shiftEnd}" ${record.status !== 'present' || session === 'checkin' ? 'disabled' : ''}></td>
            <td><input type="text" id="staff-remarks-${id}" value="${record.remarks}" placeholder="ریمارکس..." style="width:100%; padding: 5px;"></td>
        </tr>`;
    });
    
    html += '</tbody></table></div>';
    listArea.innerHTML = html;
    btnContainer.style.display = 'block';

    const checkInBtn = document.getElementById('saveStaffCheckInBtn');
    const checkOutBtn = document.getElementById('saveStaffCheckOutBtn');
    if (checkInBtn) checkInBtn.style.display = session === 'checkin' ? 'inline-block' : 'none';
    if (checkOutBtn) checkOutBtn.style.display = session === 'checkout' ? 'inline-block' : 'none';

    if (lockInfo) {
        if (hasPending) {
            lockInfo.style.display = 'block';
            lockInfo.textContent = `اس وقت ${lockedDate} کی حاضری زیرِ تکمیل ہے۔ پہلے چیک آؤٹ مکمل کریں۔`;
        } else {
            lockInfo.style.display = 'none';
            lockInfo.textContent = '';
        }
    }
}

function toggleStaffTimes(id) {
    const status = document.getElementById(`staff-status-${id}`).value;
    const session = document.getElementById('staffAttendanceSession').value;
    const disable = (status !== 'present');
    const inInput = document.getElementById(`staff-in-${id}`);
    const outInput = document.getElementById(`staff-out-${id}`);
    
    inInput.disabled = disable || session === 'checkout';
    outInput.disabled = disable || session === 'checkin';
    
    if (disable) {
        inInput.value = '';
        outInput.value = '';
    } else {
        if (!inInput.value) inInput.value = inInput.getAttribute('data-default-in') || '';
        if (!outInput.value) outInput.value = outInput.getAttribute('data-default-out') || '';
    }
}

function collectStaffAttendanceRows() {
    const listArea = document.getElementById('staffAttendanceListArea');
    return listArea.querySelectorAll('tbody tr');
}

function normalizeStaffAttendanceDateData(date) {
    if (!storedData.staffAttendance) storedData.staffAttendance = {};
    if (!storedData.staffAttendance[date]) storedData.staffAttendance[date] = {};
    const dateMap = storedData.staffAttendance[date];
    Object.keys(dateMap).forEach(key => {
        const rec = dateMap[key];
        if (!rec || typeof rec !== 'object') return;
        if (!rec.teacherId && rec.teacherName) {
            const profile = (storedData.staffProfiles || []).find(s => s.name === rec.teacherName);
            if (profile) {
                rec.teacherId = String(profile.staffCode);
            } else {
                const digits = String(key).replace(/\D/g, '');
                rec.teacherId = digits ? digits : '1001';
            }
        }
        if (!rec.teacherName) rec.teacherName = key;
        if (!Number.isFinite(Number(rec.lateMinutes))) rec.lateMinutes = 0;
        if (!Number.isFinite(Number(rec.earlyLeaveMinutes))) rec.earlyLeaveMinutes = 0;
    });
}

function saveStaffAttendanceCheckIn() {
    const date = document.getElementById('staffAttDate').value;
    if (!date) return;
    const rows = collectStaffAttendanceRows();
    normalizeStaffAttendanceDateData(date);
    let attRecord = storedData.staffAttendance[date] || {};

    rows.forEach((row, i) => {
        const id = 'staff_' + i;
        const identityCell = row.querySelector('td[data-teacher-id]');
        const teacherId = identityCell.getAttribute('data-teacher-id');
        const teacherName = identityCell.getAttribute('data-teacher-name');
        const status = document.getElementById(`staff-status-${id}`).value;
        const prev = attRecord[teacherId] || attRecord[teacherName] || { status: 'present', checkIn: '', checkOut: '', remarks: '', lateMinutes: 0, earlyLeaveMinutes: 0 };
        const checkIn = document.getElementById(`staff-in-${id}`).disabled ? prev.checkIn : document.getElementById(`staff-in-${id}`).value;
        const remarks = document.getElementById(`staff-remarks-${id}`).value.trim();
        const profile = (storedData.staffProfiles || []).find(s => String(s.staffCode) === String(teacherId) || s.name === teacherName);
        const lateMinutes = (status === 'present' && checkIn) ? Math.max(getMinutesDifference(checkIn, profile?.shiftStart || '06:50'), 0) : 0;
        attRecord[teacherId] = {
            teacherId,
            teacherName,
            status,
            checkIn,
            checkOut: prev.checkOut || '',
            lateMinutes,
            earlyLeaveMinutes: Number(prev.earlyLeaveMinutes || 0),
            remarks
        };
    });

    if (!storedData.staffAttendance) storedData.staffAttendance = {};
    storedData.staffAttendance[date] = attRecord;
    storedData.staffAttendanceFlow = {
        pendingDate: date,
        checkInSaved: true,
        checkOutSaved: false
    };

    saveToLocal();
    showAttendanceHistory();
    alert("چیک اِن حاضری کامیابی سے محفوظ ہو گئی۔ اب دن کے اختتام پر اسی تاریخ میں چیک آؤٹ درج کریں۔");
}

function saveStaffAttendanceCheckOut() {
    const date = document.getElementById('staffAttDate').value;
    if (!date) return;
    const flow = storedData.staffAttendanceFlow || {};
    if (flow.pendingDate && flow.pendingDate !== date && flow.checkInSaved && !flow.checkOutSaved) {
        alert(`پہلے ${flow.pendingDate} کی چیک آؤٹ مکمل کریں۔`);
        document.getElementById('staffAttDate').value = flow.pendingDate;
        loadStaffAttendance();
        return;
    }

    const rows = collectStaffAttendanceRows();
    normalizeStaffAttendanceDateData(date);
    let attRecord = storedData.staffAttendance[date] || {};

    rows.forEach((row, i) => {
        const id = 'staff_' + i;
        const identityCell = row.querySelector('td[data-teacher-id]');
        const teacherId = identityCell.getAttribute('data-teacher-id');
        const teacherName = identityCell.getAttribute('data-teacher-name');
        const prev = attRecord[teacherId] || attRecord[teacherName] || { status: 'present', checkIn: '', checkOut: '', remarks: '', lateMinutes: 0, earlyLeaveMinutes: 0 };
        const status = document.getElementById(`staff-status-${id}`).value;
        const checkOut = document.getElementById(`staff-out-${id}`).disabled ? prev.checkOut : document.getElementById(`staff-out-${id}`).value;
        const remarks = document.getElementById(`staff-remarks-${id}`).value.trim();
        const profile = (storedData.staffProfiles || []).find(s => String(s.staffCode) === String(teacherId) || s.name === teacherName);
        const lateMinutes = (status === 'present' && (prev.checkIn || '')) ? Math.max(getMinutesDifference(prev.checkIn || '', profile?.shiftStart || '06:50'), 0) : 0;
        const earlyLeaveMinutes = (status === 'present' && checkOut) ? Math.max(getMinutesDifference(profile?.shiftEnd || '14:45', checkOut), 0) : 0;
        attRecord[teacherId] = {
            teacherId,
            teacherName,
            status,
            checkIn: prev.checkIn || '',
            checkOut,
            lateMinutes,
            earlyLeaveMinutes,
            remarks
        };
    });

    if (!storedData.staffAttendance) storedData.staffAttendance = {};
    storedData.staffAttendance[date] = attRecord;
    storedData.staffAttendanceFlow = {
        pendingDate: '',
        checkInSaved: true,
        checkOutSaved: true,
        completedDate: date
    };

    saveToLocal();
    showAttendanceHistory();
    alert("چیک آؤٹ کامیابی سے محفوظ ہو گیا۔ اس تاریخ کی عملے کی حاضری مکمل ہو گئی۔");
}

function saveStaffAttendance() {
    // Backward compatibility (if old button reference exists somewhere)
    const session = document.getElementById('staffAttendanceSession')?.value || 'checkin';
    if (session === 'checkout') saveStaffAttendanceCheckOut();
    else saveStaffAttendanceCheckIn();
}

/* ========== UI GENERATION (Entry Tab) ========== */
function populateYearSelect(){
  const sel = document.getElementById('selectYear');
  sel.innerHTML = '';
  for(let i=1;i<=4;i++){
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `سال ${i} (${yearTargets[i].length} پارے)`;
    sel.appendChild(opt);
  }
  sel.addEventListener('change', renderAllInputs);
  document.getElementById('selectHalfYear').addEventListener('change', renderAllInputs);
}

function renderAllInputs() {
    const halfYear = document.getElementById('selectHalfYear').value; // 1 or 2
    
    let monthsConfig = [];
    
    if (halfYear === '1') {
        monthsConfig = [
            { name: 'اپریل', mIdx: 3, y: 2025 }, { name: 'مئی', mIdx: 4, y: 2025 },
            { name: 'جون', mIdx: 5, y: 2025 }, { name: 'جولائی', mIdx: 6, y: 2025 },
            { name: 'اگست', mIdx: 7, y: 2025 }, { name: 'ستمبر', mIdx: 8, y: 2025 }
        ];
    } else {
        monthsConfig = [
            { name: 'اکتوبر', mIdx: 9, y: 2025 }, { name: 'نومبر', mIdx: 10, y: 2025 },
            { name: 'دسمبر', mIdx: 11, y: 2025 }, { name: 'جنوری', mIdx: 0, y: 2026 },
            { name: 'فروری', mIdx: 1, y: 2026 }, { name: 'مارچ', mIdx: 2, y: 2026 }
        ];
    }

    // --- Render Academic Inputs ---
    const academicDiv = document.getElementById('monthlyInputArea');
    academicDiv.innerHTML = '';
    const yearVal = Number(document.getElementById('selectYear').value);
    const totalJuz = yearTargets[yearVal].length;
    const totalPagesOfYear = totalJuz * PAGES_PER_JUZ;
    document.getElementById('halfYearTarget').value = `${totalPagesOfYear / 2}`;

    monthsConfig.forEach((m) => {
        const div = document.createElement('div');
        div.innerHTML = `
          <label>${m.name} (${m.y})</label>
          <input type="number" min="0" class="month-pages" data-month="${m.name}" placeholder="0" oninput="updateAcademicCalc()">
        `;
        academicDiv.appendChild(div);
    });

    // --- Render Attendance Inputs ---
    const attendDiv = document.getElementById('attendanceInputArea');
    
    // Clear rows, but keep the header if it exists
    const header = attendDiv.querySelector('.attendance-header').outerHTML;
    attendDiv.innerHTML = header;

    monthsConfig.forEach((m, index) => {
        const workingDays = calculateWorkingDays(m.y, m.mIdx);
        
        const row = document.createElement('div');
        row.className = 'attendance-row';
        row.setAttribute('data-index', index);
        row.innerHTML = `
            <div>${m.name} ${m.y}</div>
            
            <div>
                <input type="number" min="0" value="${workingDays}" class="working-days" 
                       data-calc-days="${workingDays}" oninput="updateMonthlyAttendance(${index})" style="width:90px; text-align:center;">
                <label style="font-size:0.75rem; text-align:center;">(ایامِ کار)</label>
            </div>
            
            <div>
                <input type="number" min="0" value="0" class="absent-days" 
                       oninput="updateMonthlyAttendance(${index})" style="width:90px; text-align:center;">
                <label style="font-size:0.75rem; text-align:center;">(غیر حاضری)</label>
            </div>
            
            <div>
                <input type="number" min="0" value="0" class="leave-days" 
                       oninput="updateMonthlyAttendance(${index})" style="width:90px; text-align:center;">
                <label style="font-size:0.75rem; text-align:center;">(رخصت)</label>
            </div>
            
            <div class="result-cell">
                <span class="present-days-display">0</span>
                <span style="font-size:0.7rem; color:#555;"> ایام</span>
                <br>
                (<span class="monthly-pct-display">0.00%</span>)
            </div>
        `;
        attendDiv.appendChild(row);
    });

    // Initial calculation for newly rendered rows
    monthsConfig.forEach((m, index) => updateMonthlyAttendance(index));
    updateAcademicCalc();
    updateAttendanceCalc();
}

function buildTargetsArea(){
  const el = document.getElementById('targetsArea');
  let html = `<h3>پارہ تقسیم — سالانہ حقائق پارے</h3><div class="table-responsive"><table><thead><tr><th>سال</th><th>پارے</th><th>کل پارے</th><th>سالانہ کل صفحات</th><th>ششماہی ہدف صفحات</th></tr></thead><tbody>`;
  for(let y=1;y<=4;y++){
    const arr = yearTargets[y];
    const total = arr.length * PAGES_PER_JUZ;
    html += `<tr><td>سال ${y}</td><td style="font-size:0.9rem">${arr.join(', ')}</td><td>${arr.length}</td><td>${total}</td><td>${total/2}</td></tr>`;
  }
  html += `</tbody></table></div>`;
  el.innerHTML = html;
}

/* ========== CALCULATIONS ========== */
function updateAcademicCalc(){
  const year = Number(document.getElementById('selectYear').value || 1);
  let totalPages = 0;
  document.querySelectorAll('.month-pages').forEach(inp => totalPages += Number(inp.value || 0));

  const totalJuz = yearTargets[year].length;
  const standardTargetHalf = (totalJuz * PAGES_PER_JUZ) / 2;
  
  // Calculate proportional target based on present days
  const totalWorking = Number(document.getElementById('totalWorkingDaysField').value || 0);
  const totalPresent = Number(document.getElementById('totalPresentDaysField').value || 0);
  
  let targetHalf = standardTargetHalf;
  if(totalWorking > 0){
      targetHalf = standardTargetHalf * (totalPresent / totalWorking);
  }

  const pct = targetHalf > 0 ? (totalPages / targetHalf) * 100 : 0;
  
  let score = 0;
  for(const t of scoreThresholds) { if(pct >= t.pct){ score=t.score; break; } }

  document.getElementById('halfYearTarget').value = targetHalf.toFixed(1);
  document.getElementById('totalPagesField').value = totalPages;
  document.getElementById('percentField').value = pct.toFixed(2) + '%';
  document.getElementById('scoreField').value = score;
}

function updateMonthlyAttendance(index){
    const row = document.querySelector(`.attendance-row[data-index="${index}"]`);
    if(!row) return;

    const workingDays = Number(row.querySelector('.working-days').value || 0);
    const absentDays = Number(row.querySelector('.absent-days').value || 0);
    const leaveDays = Number(row.querySelector('.leave-days').value || 0);

    let totalPresent = workingDays - (absentDays + leaveDays);
    if (totalPresent < 0) { totalPresent = 0; }

    const pct = workingDays ? (totalPresent / workingDays) * 100 : 0;

    row.querySelector('.present-days-display').textContent = totalPresent;
    row.querySelector('.monthly-pct-display').textContent = pct.toFixed(2) + '%';
    
    updateAttendanceCalc();
}

function updateAttendanceCalc(){
    let totalWorking = 0;
    let totalPresent = 0;
    let totalAbsentLeave = 0;
    
    document.querySelectorAll('.attendance-row').forEach(row => {
        const working = Number(row.querySelector('.working-days').value || 0);
        const absent = Number(row.querySelector('.absent-days').value || 0);
        const leave = Number(row.querySelector('.leave-days').value || 0);
        const present = working - (absent + leave);

        totalWorking += working;
        totalAbsentLeave += (absent + leave);
        totalPresent += Math.max(0, present);
    });
    
    const halfYearPct = totalWorking ? (totalPresent / totalWorking) * 100 : 0;

    document.getElementById('totalWorkingDaysField').value = totalWorking;
    document.getElementById('totalAbsentLeaveField').value = totalAbsentLeave;
    document.getElementById('totalPresentDaysField').value = totalPresent;
    document.getElementById('attendancePercentField').value = halfYearPct.toFixed(2) + '%';
    
    // Update academic calculations since target now depends on attendance
    updateAcademicCalc();
}

/* ========== SAVE RECORD LOGIC ========== */
function saveRecord(){
  const name = document.getElementById('studentName').value.trim();
  const start = document.getElementById('startDate').value;

  if(!name || !start){ alert('براہِ کرم بچے کا نام اور آغازِ تاریخ درج کریں۔'); return; }

  const year = Number(document.getElementById('selectYear').value);
  const halfYear = Number(document.getElementById('selectHalfYear').value);

  // 1. Academic Data
  let totalPages = 0;
  let monthlyAcademicDetails = {};
  document.querySelectorAll('.month-pages').forEach(inp => {
    const val = Number(inp.value || 0);
    totalPages += val;
    monthlyAcademicDetails[inp.getAttribute('data-month')] = val;
  });

  // 2. Attendance Data
  let totalWorking = 0;
  let totalPresent = 0;
  let totalAbsent = 0;
  let totalLeave = 0;
  let monthlyAttendanceDetails = {};
  
  document.querySelectorAll('.attendance-row').forEach(row => {
      const monthName = row.querySelector('div:first-child').textContent.trim();
      const working = Number(row.querySelector('.working-days').value || 0);
      const absent = Number(row.querySelector('.absent-days').value || 0);
      const leave = Number(row.querySelector('.leave-days').value || 0);
      const present = Math.max(0, working - (absent + leave));
      
      totalWorking += working;
      totalAbsent += absent;
      totalLeave += leave;
      totalPresent += present;
      
      monthlyAttendanceDetails[monthName] = { working, absent, leave, present };
  });

  if(totalPages === 0 && totalPresent === 0) {
    alert('براہِ کرم کوئی تعلیمی یا حاضری کا ریکارڈ درج کریں۔');
    return;
  }

  // Calc metrics
  const pao = +(totalPages / PAGES_PER_PAO).toFixed(2);
  const juz = +(totalPages / PAGES_PER_JUZ).toFixed(2);
  
  const standardTargetHalf = (yearTargets[year].length * PAGES_PER_JUZ) / 2;
  let proportionalTarget = standardTargetHalf;
  if(totalWorking > 0){
      proportionalTarget = standardTargetHalf * (totalPresent / totalWorking);
  }
  
  const eduPct = proportionalTarget > 0 ? +( (totalPages / proportionalTarget) * 100 ).toFixed(2) : 0;
  
  let score = 0;
  for(const t of scoreThresholds) { if(eduPct >= t.pct){ score=t.score; break; } }
  const attPct = totalWorking ? +( (totalPresent / totalWorking) * 100 ).toFixed(2) : 0;

  const rec = {
    name, start, year, halfYear, pages: totalPages, pao, juz, pct: eduPct, score,
    monthlyAcademicDetails: monthlyAcademicDetails,
    attendance: { working: totalWorking, present: totalPresent, absent: totalAbsent, leave: totalLeave, pct: attPct, monthlyDetails: monthlyAttendanceDetails },
    ts: new Date().toISOString()
  };

  const existingIndex = storedData.records.findIndex(r => r.year === year && r.halfYear === halfYear && r.name === name);

  if (existingIndex > -1) {
    if (confirm(`سال ${year} ششماہی ${halfYear} کا ریکارڈ موجود ہے۔ کیا آپ تبدیل کرنا چاہتے ہیں؟`)) {
      storedData.records[existingIndex] = rec;
    } else { return; }
  } else {
    storedData.records.push(rec);
  }
  
  storedData.studentName = name;
  storedData.startDate = start;
  saveToLocal();
  
  // Clear inputs and re-render
  document.querySelectorAll('.month-pages').forEach(i => i.value = '');
  document.querySelectorAll('.absent-days').forEach(i => i.value = '0');
  document.querySelectorAll('.leave-days').forEach(i => i.value = '0');
  renderAllInputs(); // Resets attendance fields and recalculates
  
  // Optionally switch to records tab after saving
  showTab('records');
}

/* ========== RENDER RECORDS TAB ========== */
function renderAll(){
    filterRecords(); // Initial render uses the filter function with empty search
    renderSummary();
}

function filterRecords(){
    const el = document.getElementById('recordsArea');
    const records = storedData.records.sort((a,b) => b.ts.localeCompare(a.ts)); // Sort by newest first
    const searchTerm = document.getElementById('studentSearch').value.trim().toLowerCase();
    
    // Filter records based on search term (name match)
    const filteredRecords = records.filter(r => r.name.toLowerCase().includes(searchTerm));
    
    if(filteredRecords.length === 0){
        el.innerHTML = `<div style="text-align:center; color:#666; padding:20px;">${searchTerm ? `"${searchTerm}" کے نام سے کوئی ریکارڈ نہیں ملا۔` : 'کوئی محفوظ شدہ ریکارڈ موجود نہیں۔'}</div>`;
        return;
    }
    
    let html = `<div class="table-responsive"><table><thead><tr>
      <th>نام</th><th>سال/ششماہی</th>
      <th>صفحات/پاؤ/پارہ</th>
      <th>تعلیمی %</th>
      <th>حاضری (A+L/W)</th>
      <th>حاضری %</th>
      <th style="min-width:180px;">ماہانہ تفصیل (خواندگی)</th>
      <th>وقت</th><th>عمل</th>
    </tr></thead><tbody>`;
    
    filteredRecords.forEach((r, i) => {
        const monthlyText = Object.keys(r.monthlyAcademicDetails || {}).map(m => `${r.monthlyAcademicDetails[m]}`).join(' / ');
        
        const d = new Date(r.ts);
        const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });
        
        // Attendance details
        const attWork = r.attendance ? r.attendance.working : '-';
        const attAbsent = r.attendance ? r.attendance.absent : 0;
        const attLeave = r.attendance ? r.attendance.leave : 0;
        const attTotalOff = attAbsent + attLeave;
        const attPct = r.attendance ? r.attendance.pct + '%' : '-';

        // We use the index of the original storedData.records for deletion
        const originalIndex = storedData.records.findIndex(orig => orig.ts === r.ts && orig.name === r.name); 

        html += `<tr>
          <td>${r.name}</td>
          <td>سال ${r.year}<br><span style="font-size:0.8rem">ششماہی ${r.halfYear}</span></td>
          <td><b>${r.pages}</b> <span style="font-size:0.8rem">(${r.pao} پاؤ / ${r.juz} پارہ)</span></td>
          <td style="font-weight:bold; color:${r.pct>=75?'var(--accent)':'var(--danger)'}">${r.pct}%</td>
          <td>${attTotalOff} / ${attWork}</td>
          <td style="font-weight:bold;">${attPct}</td>
          <td style="font-size:0.8rem; direction:ltr; text-align:right;">${monthlyText}</td>
          <td style="font-size:0.75rem;">${timeStr}<br>${dateStr}</td>
          <td><button onclick="deleteRecord(${originalIndex})" style="padding:5px 10px; font-size:0.8rem; background:var(--danger);">حذف</button></td>
        </tr>`;
    });
    html += `</tbody></table></div>`;
    el.innerHTML = html;
}

function deleteRecord(idx){
  if(!confirm('حذف کریں؟')) return;
  storedData.records.splice(idx,1);
  saveToLocal();
  renderAll(); // Re-render table and summary
}

function renderSummary(){
    const el = document.getElementById('summaryArea');
    const records = storedData.records;
    if(records.length === 0){ el.innerHTML=''; return; }
    
    // --- Annual Summary Calculation ---
    const annualData = records.reduce((acc, r) => {
        if(!acc[r.name]) acc[r.name] = {};
        
        const key = r.year; 
        if(!acc[r.name][key]) {
            acc[r.name][key] = { totalPages: 0, totalWorking: 0, totalPresent: 0, totalAbsent: 0, totalLeave: 0, count: 0 };
        }
        
        acc[r.name][key].totalPages += r.pages;
        if(r.attendance){
            acc[r.name][key].totalWorking += r.attendance.working;
            acc[r.name][key].totalPresent += r.attendance.present;
            acc[r.name][key].totalAbsent += r.attendance.absent;
            acc[r.name][key].totalLeave += r.attendance.leave;
            acc[r.name][key].count += 1;
        }
        return acc;
    }, {});
    
    let html = `<div class="card result"><h2>سالانہ حاضری کا خلاصہ</h2><div class="table-responsive summary-table"><table><thead><tr>
        <th>نام</th>
        <th>سال</th>
        <th>ششماہی کی تعداد</th>
        <th>کل ایام کار</th>
        <th>کل غیر حاضری + رخصت</th>
        <th>کل حاضر ایام</th>
        <th>سالانہ حاضری %</th>
    </tr></thead><tbody>`;
    
    Object.keys(annualData).sort().forEach(name => {
        Object.keys(annualData[name]).sort().forEach(year => {
            const data = annualData[name][year];
            if (data.count === 0) return;

            const title = data.count === 2 ? `سال ${year} (مکمل)` : `سال ${year} (نامکمل)`;
            const attPct = data.totalWorking ? ((data.totalPresent / data.totalWorking) * 100).toFixed(2) : 0;
            const rowStyle = data.count === 2 ? 'font-weight:bold; background:#f0f9f2;' : 'background:#fff;';

            html += `<tr style="${rowStyle}">
                <td>${name}</td>
                <td>${title}</td>
                <td>${data.count}</td>
                <td>${data.totalWorking}</td>
                <td>${data.totalAbsent + data.totalLeave}</td>
                <td>${data.totalPresent}</td>
                <td style="font-weight:bold; color:${attPct >= 80 ? 'var(--accent)' : 'var(--danger)'}">${attPct}%</td>
            </tr>`;
        });
    });
    
    html += `</tbody></table></div></div>`;
    el.innerHTML = html;
}

/* ========== FEES LOGIC ========== */
let currentFeeStudentIndex = -1;

function toggleFeeView() {
    const val = document.getElementById('feeActionSelect').value;
    if (val === 'record') {
        document.getElementById('feeRecordPaymentContainer').style.display = 'block';
        document.getElementById('feeAnalyticsContainer').style.display = 'none';
        
        // Reset Search
        document.getElementById('feeSearchId').value = '';
        document.getElementById('feePaymentDetailsArea').style.display = 'none';
        currentFeeStudentIndex = -1;
    } else {
        document.getElementById('feeRecordPaymentContainer').style.display = 'none';
        document.getElementById('feeAnalyticsContainer').style.display = 'block';
        renderFeeAnalytics();
    }
}

function loadStudentForFee() {
    const searchId = document.getElementById('feeSearchId').value.trim();
    if (!searchId) {
        alert("براہ کرم رجسٹریشن نمبر درج کریں۔");
        return;
    }

    const records = storedData.records || [];
    currentFeeStudentIndex = records.findIndex(r => r.isAdmissionProfile && r.admRegNo === searchId);

    if (currentFeeStudentIndex === -1) {
        alert("اس رجسٹریشن نمبر سے کوئی طالب علم نہیں ملا۔");
        document.getElementById('feePaymentDetailsArea').style.display = 'none';
        return;
    }

    const student = records[currentFeeStudentIndex];
    document.getElementById('feeDispName').textContent = student.name || '';
    document.getElementById('feeDispFather').value = student.admFatherName || '';
    
    // Set default month to current
    const now = new Date();
    const currentMonth = now.toISOString().substring(0, 7);
    document.getElementById('feeMonthInput').value = currentMonth;
    
    document.getElementById('feeAmountInput').value = '';
    document.getElementById('feeArrearsInput').value = '0';
    document.getElementById('feeMethodSelect').value = 'Cash';

    document.getElementById('feePaymentDetailsArea').style.display = 'block';
}

function processFeePayment() {
    if (currentFeeStudentIndex === -1) return;

    const student = storedData.records[currentFeeStudentIndex];
    const feeMonth = document.getElementById('feeMonthInput').value;
    const feeAmount = parseInt(document.getElementById('feeAmountInput').value, 10);
    const feeArrears = parseInt(document.getElementById('feeArrearsInput').value, 10) || 0;
    const feeMethod = document.getElementById('feeMethodSelect').value;

    if (!feeMonth || isNaN(feeAmount) || feeAmount <= 0) {
        alert("براہ کرم ادائیگی کا مہینہ اور درست فیس کی رقم درج کریں۔");
        return;
    }

    const totalPaid = feeAmount + feeArrears;
    const now = new Date();
    const timestampStr = now.toLocaleString('en-PK', { hour12: true });
    
    // Generate Invoice ID: yymmddid-rand
    const datePrefix = now.toISOString().slice(2, 10).replace(/-/g, '');
    const randSuffix = Math.floor(Math.random() * 900 + 100);
    const invoiceId = `${datePrefix}${student.admRegNo}-${randSuffix}`;

    // 1. Save to Database
    const feeRecord = {
        isFeeRecord: true,
        invoiceId: invoiceId,
        studentId: student.admRegNo,
        studentName: student.name,
        studentFather: student.admFatherName,
        feeMonth: feeMonth,
        feeAmount: feeAmount,
        feeArrears: feeArrears,
        totalPaid: totalPaid,
        feeMethod: feeMethod,
        timestamp: now.toISOString()
    };
    
    storedData.records.push(feeRecord);
    saveToLocal();

    // 2. Populate English Print Receipt
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    const formattedDate = now.toLocaleDateString('en-US', options);
    
    // Convert YYYY-MM to readable Month Year
    const monthDateObj = new Date(feeMonth + "-01");
    const readableFeeMonth = monthDateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    document.getElementById('receiptStudentId').innerText = student.admRegNo;
    document.getElementById('receiptInvoice').innerText = invoiceId;
    document.getElementById('receiptDate').innerText = formattedDate;
    
    document.getElementById('receiptName').innerText = (student.name||'').toUpperCase();
    document.getElementById('receiptFather').innerText = (student.admFatherName||'').toUpperCase();
    
    document.getElementById('receiptFeeMonth').innerText = readableFeeMonth.toUpperCase();
    document.getElementById('receiptFeeAmount').innerText = feeAmount.toLocaleString();
    document.getElementById('receiptArrears').innerText = feeArrears.toLocaleString();
    document.getElementById('receiptTotal').innerText = totalPaid.toLocaleString();
    
    document.getElementById('receiptMethod').innerText = feeMethod;
    document.getElementById('receiptTimestamp').innerText = timestampStr;

    // 3. Trigger Print
    alert("Record Saved! Please wait for the print dialog...");
    window.print();
    
    // 4. Simulate SMS Alert
    setTimeout(() => {
        alert(`🔔 [SYSTEM ALERT]\nA digital payment receipt for Rs. ${totalPaid} has been sent successfully to the parent's WhatsApp/SMS via system gateway.`);
        
        // Reset form
        document.getElementById('feeSearchId').value = '';
        document.getElementById('feePaymentDetailsArea').style.display = 'none';
        currentFeeStudentIndex = -1;
    }, 1500);
}

function renderFeeAnalytics() {
    const records = storedData.records || [];
    const feeRecords = records.filter(r => r.isFeeRecord).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    let totalCol = 0;
    let totalArr = 0;

    // method بیج رنگ
    const methodColor = {
      'Cash':          { bg:'#f0fdf4', color:'#15803d', border:'#bbf7d0' },
      'Bank Transfer': { bg:'#eff6ff', color:'#1d4ed8', border:'#bfdbfe' },
      'Online':        { bg:'#fdf4ff', color:'#9333ea', border:'#e9d5ff' },
    };

    if (feeRecords.length === 0) {
        document.getElementById('totalCollectionDisplay').innerText = '0';
        document.getElementById('totalArrearsDisplay').innerText   = '0';
        document.getElementById('allFeesListArea').innerHTML =
          '<div class="empty-dashboard-state">ابھی تک کوئی فیس ریکارڈ موجود نہیں۔</div>';
        return;
    }

    feeRecords.forEach(f => {
        totalCol += (f.totalPaid   || 0);
        totalArr += (f.feeArrears || 0);
    });

    // اعداد کو Rs. سے الگ رکھیں
    document.getElementById('totalCollectionDisplay').innerText = totalCol.toLocaleString();
    document.getElementById('totalArrearsDisplay').innerText   = totalArr.toLocaleString();

    let rows = feeRecords.map(f => {
        const dp = new Date(f.timestamp);
        const dateStr = dp.toLocaleDateString('ur-PK');
        const timeStr = dp.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        const mc = methodColor[f.feeMethod] || { bg:'#f8fafc', color:'#475569', border:'#e2e8f0' };
        const paid   = (f.totalPaid   || 0).toLocaleString();
        const arrears= (f.feeArrears  || 0);

        return `<tr>
          <td>
            <span style="font-size:0.78rem; color:var(--muted);">${f.invoiceId || '—'}</span>
          </td>
          <td>
            <div style="font-size:0.88rem; font-weight:600;">${dateStr}</div>
            <div style="font-size:0.76rem; color:var(--muted);">${timeStr}</div>
          </td>
          <td>
            <div style="font-weight:700; font-size:0.95rem;">${f.studentName || '—'}</div>
            <div style="font-size:0.76rem; color:var(--muted);">ID: ${f.studentId || '—'}</div>
          </td>
          <td>
            <span style="background:#eef4ff; color:var(--accent); border-radius:6px;
              padding:3px 10px; font-size:0.82rem; font-weight:600;">${f.feeMonth || '—'}</span>
          </td>
          <td>
            <div style="display:flex; align-items:baseline; gap:4px; justify-content:center;">
              <span style="font-size:0.75rem; color:#16a34a; font-weight:700;">Rs.</span>
              <span style="font-size:1.1rem; font-weight:800; color:#15803d;">${paid}</span>
            </div>
            ${arrears > 0 ? `<div style="font-size:0.75rem; color:var(--danger); text-align:center; margin-top:2px;">
              بقایا: Rs. ${arrears.toLocaleString()}</div>` : ''}
          </td>
          <td>
            <span style="background:${mc.bg}; color:${mc.color};
              border:1px solid ${mc.border}; border-radius:999px;
              padding:4px 12px; font-size:0.8rem; font-weight:700;
              white-space:nowrap;">${f.feeMethod || '—'}</span>
          </td>
        </tr>`;
    }).join('');

    const html = `
      <div class="table-responsive">
        <table>
          <thead>
            <tr>
              <th>Invoice</th>
              <th>تاریخ و وقت</th>
              <th>طالب علم</th>
              <th>مہینہ</th>
              <th style="text-align:center;">مبلغ</th>
              <th>طریقہ</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    document.getElementById('allFeesListArea').innerHTML = html;
}

/* ========== AI RECITATION / اے آئی استاد ========== */
let aiListening = false;
let recognition = null;
let finalRecitedText = '';
let currentTargetAyah = '';
let currentSurah = 1;
let currentAyah = 1;

// ===== آیت لانے کا فنکشن (Quran.com API) =====
async function loadTargetAyah() {
    const surah = document.getElementById('aiSurahSelect').value;
    const ayah  = document.getElementById('aiAyahInput').value;
    currentSurah = parseInt(surah);
    currentAyah  = parseInt(ayah);

    const statusEl = document.getElementById('ayahLoadStatus');
    const boxEl    = document.getElementById('targetAyahBox');
    statusEl.textContent = 'لوڈ ہو رہا ہے...';
    boxEl.innerHTML = '<span style="color:#aaa; font-size:1rem;">آیت لوڈ ہو رہی ہے...</span>';

    try {
        const res  = await fetch(`https://api.alquran.cloud/v1/ayah/${surah}:${ayah}/ar.uthmani`);
        const data = await res.json();
        if (data.code === 200) {
            currentTargetAyah = data.data.text;
            boxEl.textContent = currentTargetAyah;
            statusEl.textContent = 'آیت تیار ہے';
            updateReferenceAudio();
        } else {
            statusEl.textContent = '❌ آیت نہیں ملی — نمبر چیک کریں';
        }
    } catch(e) {
        statusEl.textContent = '❌ انٹرنیٹ کنکشن چیک کریں';
    }
}

function onAiSurahChange() { loadTargetAyah(); }
function onAiAyahChange()  {
    clearTimeout(window._ayahDebounce);
    window._ayahDebounce = setTimeout(loadTargetAyah, 600);
}

function updateReferenceAudio() {
    const s = String(currentSurah).padStart(3,'0');
    const a = String(currentAyah).padStart(3,'0');
    const url = `https://verses.quran.com/Alafasy/mp3/${s}${a}.mp3`;
    document.getElementById('referenceAudio').src = url;
    document.getElementById('qariAudio').src = url;
}

function playReferenceAudio() {
    const audio = document.getElementById('referenceAudio');
    if (!audio.src || audio.src === window.location.href) {
        updateReferenceAudio();
    }
    audio.play().catch(()=>{});
}

// ===== مائیک فنکشن =====
function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('آپ کا براؤزر مائیک سپورٹ نہیں کرتا۔ براہ کرم Chrome استعمال کریں۔');
        return;
    }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SR();
    recognition.lang = 'ar-SA';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = function() {
        aiListening = true;
        finalRecitedText = '';
        document.getElementById('micBtn').classList.add('listening');
        document.getElementById('micStatusText').textContent = 'تلاوت سنی جا رہی ہے... (رکنے کے لیے دوبارہ دبائیں)';
        document.getElementById('micStatusText').style.color = '#d32f2f';
        document.getElementById('transcriptOutput').innerHTML = '<span style="color:#aaa;">تلاوت شروع کریں...</span>';
        document.getElementById('aiAnalysisPanel').style.display = 'none';
        document.getElementById('analyseBtn').style.display = 'none';
    };

    recognition.onresult = function(event) {
        let interim = '';
        finalRecitedText = '';
        for (let i = 0; i < event.results.length; i++) {
            if (event.results[i].isFinal) {
                finalRecitedText += event.results[i][0].transcript + ' ';
            } else {
                interim += event.results[i][0].transcript;
            }
        }
        const box = document.getElementById('transcriptOutput');
        box.innerHTML =
            `<span style="color:#1b5e20; font-weight:600;">${finalRecitedText}</span>` +
            (interim ? `<span style="color:#888; font-style:italic;">${interim}</span>` : '');
    };

    recognition.onerror = function(ev) {
        if (ev.error === 'no-speech') return;
        stopAiListeningState();
        document.getElementById('micStatusText').textContent = 'مائیک میں مسئلہ: ' + ev.error + ' — دوبارہ کوشش کریں';
    };

    recognition.onend = function() {
        if (aiListening) {
            recognition.start(); // auto-restart
        } else {
            stopAiListeningState();
            if (finalRecitedText.trim().length > 0) {
                document.getElementById('analyseBtn').style.display = 'inline-block';
            }
        }
    };
}

function stopAiListeningState() {
    aiListening = false;
    document.getElementById('micBtn').classList.remove('listening');
    document.getElementById('micStatusText').textContent = 'تلاوت مکمل — اب "غلطیاں چیک کریں" دبائیں';
    document.getElementById('micStatusText').style.color = '#2e7d32';
}

function toggleAiListening() {
    if (!recognition) initSpeechRecognition();
    if (!recognition) return;

    if (aiListening) {
        aiListening = false;
        recognition.stop();
    } else {
        if (!currentTargetAyah) {
            loadTargetAyah().then(() => recognition.start());
        } else {
            recognition.start();
        }
    }
}

// ===== الفاظ کا موازنہ (Word Comparison) =====
function normalizeArabic(text) {
    return text
        .replace(/[\u064B-\u065F\u0670]/g, '')  // harakat ہٹائیں
        .replace(/أ|إ|آ/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/\s+/g, ' ')
        .trim();
}

function levenshtein(a, b) {
    const m = a.length, n = b.length;
    const dp = Array.from({length: m+1}, (_,i) => Array.from({length: n+1}, (_,j) => i===0?j:j===0?i:0));
    for (let i=1;i<=m;i++) for(let j=1;j<=n;j++)
        dp[i][j] = a[i-1]===b[j-1] ? dp[i-1][j-1] : 1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    return dp[m][n];
}

function compareWords(targetWords, recitedWords) {
    const results = [];
    const maxLen = Math.max(targetWords.length, recitedWords.length);
    for (let i = 0; i < maxLen; i++) {
        const tw = targetWords[i] || null;
        const rw = recitedWords[i] || null;
        if (!tw) {
            results.push({ target: null, recited: rw, status: 'extra' });
            continue;
        }
        if (!rw) {
            results.push({ target: tw, recited: null, status: 'missing' });
            continue;
        }
        const nt = normalizeArabic(tw);
        const nr = normalizeArabic(rw);
        if (nt === nr) {
            results.push({ target: tw, recited: rw, status: 'correct' });
        } else {
            const dist = levenshtein(nt, nr);
            const ratio = dist / Math.max(nt.length, nr.length);
            results.push({ target: tw, recited: rw, status: ratio < 0.4 ? 'close' : 'wrong' });
        }
    }
    return results;
}

// ===== Claude AI سے تبصرہ =====
async function getAiFeedback(targetAyah, recitedText, compareResults) {
    const wrongWords = compareResults.filter(r => r.status === 'wrong').map(r => `"${r.recited || '?'}" بجائے "${r.target || '?'}"`)
    const missingWords = compareResults.filter(r => r.status === 'missing').map(r => `"${r.target}"`)
    const correctCount = compareResults.filter(r => r.status === 'correct').length;
    const totalWords = compareResults.filter(r => r.target).length;

    const prompt = `آپ ایک قرآن کے ماہر استاد ہیں جو بچوں کو تجوید سکھاتے ہیں۔ آپ نے ایک طالب علم کی تلاوت سنی۔

آیت: "${targetAyah}"
طالب علم نے پڑھا: "${recitedText}"
درست الفاظ: ${correctCount} / ${totalWords}
${wrongWords.length > 0 ? `غلط الفاظ: ${wrongWords.join(' ، ')}` : ''}
${missingWords.length > 0 ? `بھولے ہوئے الفاظ: ${missingWords.join(' ، ')}` : ''}

براہ کرم اردو میں ایک مختصر مگر پرجوش تبصرہ دیں جیسے ایک اصل استاد دیتا ہے۔ پہلے حوصلہ افزائی کریں، پھر غلطیاں بتائیں، آخر میں مشورہ دیں۔ تجوید کے اصول بھی ذکر کریں اگر متعلقہ ہوں۔ جواب 100-150 الفاظ میں رکھیں۔`;

    try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: 'claude-sonnet-4-6',
                max_tokens: 1000,
                messages: [{ role: 'user', content: prompt }]
            })
        });
        const data = await res.json();
        if (data.content && data.content[0]) return data.content[0].text;
        return null;
    } catch(e) {
        return null;
    }
}

// ===== مرکزی تجزیہ فنکشن =====
async function analyseRecitation() {
    const recited = finalRecitedText.trim();
    if (!recited) {
        alert('پہلے تلاوت کریں اور پھر چیک کریں۔');
        return;
    }
    if (!currentTargetAyah) {
        alert('پہلے آیت لوڈ کریں۔');
        return;
    }

    // پینل کھولیں، لوڈنگ دکھائیں
    const panel = document.getElementById('aiAnalysisPanel');
    panel.style.display = 'block';
    panel.classList.remove('error-mode');
    document.getElementById('aiLoadingState').style.display = 'block';
    document.getElementById('aiResultState').style.display = 'none';
    panel.scrollIntoView({ behavior: 'smooth' });

    // الفاظ موازنہ
    const targetWords  = currentTargetAyah.trim().split(/\s+/);
    const recitedWords = recited.trim().split(/\s+/);
    const compareRes   = compareWords(targetWords, recitedWords);

    const correctCount = compareRes.filter(r => r.status === 'correct').length;
    const totalTarget  = compareRes.filter(r => r.target).length;
    const score = Math.round((correctCount / totalTarget) * 100);

    // ===== سکور بار =====
    const scoreColor = score >= 80 ? '#2e7d32' : score >= 50 ? '#f57f17' : '#c62828';
    const scoreEmoji = score >= 80 ? 'ماشاءاللہ!' : score >= 50 ? 'کوشش جاری رکھیں' : 'مزید مشق کریں';
    document.getElementById('scoreArea').innerHTML = `
        <div style="text-align:center; padding:12px; background:${scoreColor}15; border-radius:10px; border:2px solid ${scoreColor}40;">
            <div style="font-size:1.8rem; font-weight:800; color:${scoreColor};">${score}%</div>
            <div style="color:${scoreColor}; font-size:1.1rem; font-weight:600;">${scoreEmoji}</div>
            <div style="background:#e0e0e0; border-radius:20px; height:10px; margin-top:10px; overflow:hidden;">
                <div style="background:${scoreColor}; height:100%; width:${score}%; border-radius:20px; transition:width 1s;"></div>
            </div>
        </div>`;

    // ===== لفظ بہ لفظ جائزہ =====
    const wordHtml = compareRes.map(r => {
        if (r.status === 'correct') return `<span style="color:#2e7d32; background:#e8f5e9; padding:3px 6px; border-radius:5px; margin:3px; display:inline-block;">${r.target}</span>`;
        if (r.status === 'missing') return `<span style="color:#c62828; background:#ffebee; padding:3px 6px; border-radius:5px; margin:3px; display:inline-block; text-decoration:line-through; opacity:0.7;" title="بھول گئے">${r.target}</span>`;
        if (r.status === 'close')   return `<span style="color:#f57f17; background:#fff8e1; padding:3px 6px; border-radius:5px; margin:3px; display:inline-block; border-bottom:2px solid #f57f17;" title="آپ نے پڑھا: ${r.recited}">${r.target}</span>`;
        return `<span style="color:#c62828; background:#ffebee; padding:3px 6px; border-radius:5px; margin:3px; display:inline-block; border-bottom:2px dashed #c62828; font-weight:700;" title="آپ نے پڑھا: ${r.recited}">${r.target}</span>`;
    }).join(' ');
    document.getElementById('wordCompareArea').innerHTML = wordHtml || '<span style="color:#888;">الفاظ کا موازنہ نہیں ہو سکا</span>';

    // ===== Claude AI فیڈ بیک =====
    document.getElementById('aiFeedbackArea').innerHTML = '<span style="color:#888;">استاد کا تبصرہ آ رہا ہے...</span>';
    const aiFeedback = await getAiFeedback(currentTargetAyah, recited, compareRes);
    document.getElementById('aiFeedbackArea').innerHTML = aiFeedback
        ? aiFeedback.replace(/\n/g, '<br>')
        : (score >= 80
            ? 'ماشاءاللہ! آپ کی تلاوت بہت اچھی ہے۔ اللہ تعالیٰ آپ کو مزید برکت دے۔'
            : '⚠️ کچھ الفاظ درست نہیں ہوئے۔ پہلے آیت ذہن میں پکی کریں، پھر دوبارہ سنائیں۔');

    // آڈیو سیٹ کریں
    const s = String(currentSurah).padStart(3,'0');
    const a = String(currentAyah).padStart(3,'0');
    document.getElementById('qariAudio').src = `https://verses.quran.com/Alafasy/mp3/${s}${a}.mp3`;

    if (score < 80) panel.classList.add('error-mode');

    document.getElementById('aiLoadingState').style.display = 'none';
    document.getElementById('aiResultState').style.display = 'block';
}

// ===== ری سیٹ =====
function resetAiSession() {
    finalRecitedText = '';
    document.getElementById('transcriptOutput').innerHTML = '<span style="color:#bbb; font-size:1rem;">یہاں آپ کی تلاوت ظاہر ہوگی...</span>';
    document.getElementById('aiAnalysisPanel').style.display = 'none';
    document.getElementById('analyseBtn').style.display = 'none';
    document.getElementById('micStatusText').textContent = 'تلاوت شروع کرنے کے لیے مائیک دبائیں';
    document.getElementById('micStatusText').style.color = '#666';
}

// پرانے simulate functions (پیچھے کی مطابقت کے لیے)
function simulateAnalysisGood() {}
function simulateAnalysisError() {}

/* ========== امتحانات ٹیب ========== */

function pickExamView(view, btn) {
  document.querySelectorAll('#tab-exams .adm-type-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['miqdar-class','miqdar-individual','result-entry','class-result','individual-result']
    .forEach(v => {
      const el = document.getElementById('examSection-' + v);
      if (el) el.style.display = 'none';
    });
  const target = document.getElementById('examSection-' + view);
  if (target) target.style.display = 'block';
  if (['miqdar-class','result-entry','class-result'].includes(view)) populateExamClassSelects();
}

function populateExamClassSelects() {
  ['mqClassSelect','reClassSelect','crExamClass'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<option value="">کلاس منتخب کریں...</option>' +
      (storedData.classes||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  });
}

function loadMiqdarClass() {
  const clsId = document.getElementById('mqClassSelect').value;
  const term  = document.getElementById('mqTermSelect').value;
  const year  = document.getElementById('mqYear').value;
  if (!clsId) { alert('کلاس منتخب کریں'); return; }
  const cls      = (storedData.classes||[]).find(c => c.id===clsId);
  const students = (storedData.records||[]).filter(r => r.isAdmissionProfile && r.classId===clsId && r.status!=='withdrawn');
  if (!students.length) { alert('اس کلاس میں کوئی طالب علم نہیں'); return; }
  const existing = (storedData.examMiqdar||[]).filter(m => m.classId===clsId && m.term===term && m.year==year);
  document.getElementById('miqdarClassTitle').textContent =
    `${cls.name} — ${term==='first'?'پہلی':'دوسری'} ششماہی ${year}`;
  document.getElementById('miqdarClassTableBody').innerHTML = students.map(s => {
    const prev = existing.find(m => m.regNo===s.admRegNo) || {};
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px; text-align:right; font-weight:600;">${s.name||'—'}</td>
      <td style="padding:8px; text-align:center; font-size:0.82rem; color:var(--muted);">${s.admRegNo}</td>
      <td style="padding:8px;">
        <div style="display:flex; gap:4px; align-items:center;">
          <input type="number" class="mq-start-para" data-id="${s.admRegNo}" min="1" max="30"
            value="${prev.startPara||''}" placeholder="پارہ"
            style="width:60px; padding:5px; border:1px solid var(--border); border-radius:6px; text-align:center;">
          <span style="color:var(--muted); font-size:0.8rem;">پ</span>
          <input type="number" class="mq-start-ruku" data-id="${s.admRegNo}" min="1" max="40"
            value="${prev.startRuku||''}" placeholder="رکوع"
            style="width:60px; padding:5px; border:1px solid var(--border); border-radius:6px; text-align:center;">
          <span style="color:var(--muted); font-size:0.8rem;">ر</span>
        </div>
      </td>
      <td style="padding:8px;">
        <div style="display:flex; gap:4px; align-items:center;">
          <input type="number" class="mq-end-para" data-id="${s.admRegNo}" min="1" max="30"
            value="${prev.endPara||''}" placeholder="پارہ"
            style="width:60px; padding:5px; border:1px solid var(--border); border-radius:6px; text-align:center;">
          <span style="color:var(--muted); font-size:0.8rem;">پ</span>
          <input type="number" class="mq-end-ruku" data-id="${s.admRegNo}" min="1" max="40"
            value="${prev.endRuku||''}" placeholder="رکوع"
            style="width:60px; padding:5px; border:1px solid var(--border); border-radius:6px; text-align:center;">
          <span style="color:var(--muted); font-size:0.8rem;">ر</span>
        </div>
      </td>
      <td style="padding:8px; text-align:center;" id="mqTarget-${s.admRegNo}">
        ${prev.targetRuku ? `<strong style="color:var(--accent-2);">${prev.targetRuku} رکوع</strong>` : '—'}
      </td>
    </tr>`;
  }).join('');
  document.getElementById('miqdarClassArea').style.display = 'block';
}

function saveMiqdarClass() {
  const clsId = document.getElementById('mqClassSelect').value;
  const term  = document.getElementById('mqTermSelect').value;
  const year  = parseInt(document.getElementById('mqYear').value);
  if (!storedData.examMiqdar) storedData.examMiqdar = [];
  const rows = document.querySelectorAll('#miqdarClassTableBody tr');
  rows.forEach(row => {
    const inputs   = row.querySelectorAll('input[type=number]');
    if (inputs.length < 4) return;
    const regNo     = inputs[0].dataset.id;
    const startPara = parseInt(inputs[0].value)||0;
    const startRuku = parseInt(inputs[1].value)||0;
    const endPara   = parseInt(inputs[2].value)||0;
    const endRuku   = parseInt(inputs[3].value)||0;
    const targetRuku= Math.max(0,(endPara-startPara)*8+(endRuku-startRuku));
    const rec = { regNo, classId:clsId, term, year, startPara, startRuku, endPara, endRuku, targetRuku };
    const idx = storedData.examMiqdar.findIndex(m => m.regNo===regNo && m.classId===clsId && m.term===term && m.year===year);
    if (idx>=0) storedData.examMiqdar[idx]=rec; else storedData.examMiqdar.push(rec);
    const td = document.getElementById('mqTarget-'+regNo);
    if (td) td.innerHTML = `<strong style="color:var(--accent-2);">${targetRuku} رکوع</strong>`;
  });
  saveToLocal();
  alert('مقدار خواندگی محفوظ ہو گئی');
}

function loadMiqdarIndividual() {
  const id   = document.getElementById('mqIndId').value.trim();
  const term = document.getElementById('mqIndTerm').value;
  const year = document.getElementById('mqIndYear').value;
  if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
  const s = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo===id);
  if (!s) { alert('طالب علم نہیں ملا'); return; }
  document.getElementById('mqIndName').textContent   = s.name||'—';
  document.getElementById('mqIndFather').textContent = s.admFatherName||'—';
  const prev = (storedData.examMiqdar||[]).find(m => m.regNo===id && m.term===term && m.year==year) || {};
  document.getElementById('mqIndStartPara').value = prev.startPara||'';
  document.getElementById('mqIndStartRuku').value = prev.startRuku||'';
  document.getElementById('mqIndEndPara').value   = prev.endPara||'';
  document.getElementById('mqIndEndRuku').value   = prev.endRuku||'';
  document.getElementById('miqdarIndArea').style.display = 'block';
  document.getElementById('mqIndMsg').textContent = '';
}

function saveMiqdarIndividual() {
  const id        = document.getElementById('mqIndId').value.trim();
  const term      = document.getElementById('mqIndTerm').value;
  const year      = parseInt(document.getElementById('mqIndYear').value);
  const startPara = parseInt(document.getElementById('mqIndStartPara').value)||0;
  const startRuku = parseInt(document.getElementById('mqIndStartRuku').value)||0;
  const endPara   = parseInt(document.getElementById('mqIndEndPara').value)||0;
  const endRuku   = parseInt(document.getElementById('mqIndEndRuku').value)||0;
  const targetRuku= Math.max(0,(endPara-startPara)*8+(endRuku-startRuku));
  const s = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo===id);
  if (!s) return;
  if (!storedData.examMiqdar) storedData.examMiqdar = [];
  const rec = { regNo:id, classId:s.classId, term, year, startPara, startRuku, endPara, endRuku, targetRuku };
  const idx = storedData.examMiqdar.findIndex(m => m.regNo===id && m.term===term && m.year===year);
  if (idx>=0) storedData.examMiqdar[idx]=rec; else storedData.examMiqdar.push(rec);
  saveToLocal();
  document.getElementById('mqIndMsg').innerHTML =
    `<span style="color:var(--accent-2); font-weight:700;">محفوظ ہو گیا — ہدف: ${targetRuku} رکوع</span>`;
}

function loadResultEntry() {
  const clsId = document.getElementById('reClassSelect').value;
  const term  = document.getElementById('reTermSelect').value;
  const year  = document.getElementById('reYear').value;
  if (!clsId) { alert('کلاس منتخب کریں'); return; }
  const cls      = (storedData.classes||[]).find(c => c.id===clsId);
  const students = (storedData.records||[]).filter(r => r.isAdmissionProfile && r.classId===clsId && r.status!=='withdrawn');
  if (!students.length) { alert('اس کلاس میں کوئی طالب علم نہیں'); return; }
  const miqdar   = storedData.examMiqdar||[];
  const existing = storedData.examResults||[];
  document.getElementById('resultEntryTitle').textContent =
    `${cls.name} — ${term==='first'?'پہلی':'دوسری'} ششماہی ${year}`;
  document.getElementById('resultEntryTableBody').innerHTML = students.map(s => {
    const mq   = miqdar.find(m => m.regNo===s.admRegNo && m.term===term && m.year==year);
    const prev = existing.find(e => e.regNo===s.admRegNo && e.term===term && e.year==year);
    const tgt  = mq?.targetRuku||0;
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px; text-align:right; font-weight:600;">${s.name||'—'}</td>
      <td style="padding:8px; text-align:center; font-size:0.82rem; color:var(--muted);">${s.admRegNo}</td>
      <td style="padding:8px; text-align:center; font-weight:700; color:var(--accent-2);">${tgt||'—'}</td>
      <td style="padding:8px;">
        <input type="number" class="re-achieved" data-id="${s.admRegNo}" data-target="${tgt}"
          min="0" value="${prev?.achievedRuku||''}" placeholder="رکوع"
          oninput="updateResultPct(this)"
          style="width:80px; padding:6px; border:1px solid var(--border); border-radius:6px; text-align:center;">
      </td>
      <td style="padding:8px; text-align:center; font-weight:700;" id="rePct-${s.admRegNo}">
        ${prev ? `<span style="color:${prev.pct>=80?'#15803d':prev.pct>=60?'#b45309':'#dc2626'}">${prev.pct}%</span>` : '—'}
      </td>
    </tr>`;
  }).join('');
  document.getElementById('resultEntryArea').style.display = 'block';
}

function updateResultPct(inp) {
  const achieved = parseInt(inp.value)||0;
  const target   = parseInt(inp.dataset.target)||0;
  const pct      = target ? Math.round((achieved/target)*100) : 0;
  const el       = document.getElementById('rePct-'+inp.dataset.id);
  if (el) el.innerHTML = `<span style="color:${pct>=80?'#15803d':pct>=60?'#b45309':'#dc2626'}">${pct}%</span>`;
}

function saveResultEntry() {
  const clsId = document.getElementById('reClassSelect').value;
  const term  = document.getElementById('reTermSelect').value;
  const year  = parseInt(document.getElementById('reYear').value);
  if (!storedData.examResults) storedData.examResults = [];
  document.querySelectorAll('.re-achieved').forEach(inp => {
    const regNo    = inp.dataset.id;
    const target   = parseInt(inp.dataset.target)||0;
    const achieved = parseInt(inp.value)||0;
    const pct      = target ? Math.round((achieved/target)*100) : 0;
    const s        = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo===regNo);
    const rec = { regNo, classId:clsId, term, year, targetRuku:target, achievedRuku:achieved, pct,
                  studentName:s?.name||'', classNm:(storedData.classes||[]).find(c=>c.id===clsId)?.name||'' };
    const idx = storedData.examResults.findIndex(e => e.regNo===regNo && e.term===term && e.year===year);
    if (idx>=0) storedData.examResults[idx]=rec; else storedData.examResults.push(rec);
  });
  saveToLocal();
  alert('رزلٹ محفوظ ہو گیا');
}

function renderClassExamResult() {
  const clsId = document.getElementById('crExamClass').value;
  const term  = document.getElementById('crExamTerm').value;
  const year  = parseInt(document.getElementById('crExamYear').value);
  const area  = document.getElementById('classExamResultArea');
  if (!clsId) { alert('کلاس منتخب کریں'); return; }
  const cls   = (storedData.classes||[]).find(c=>c.id===clsId);
  let results = (storedData.examResults||[]).filter(e => e.classId===clsId && e.year===year);
  if (term !== 'annual') results = results.filter(e => e.term===term);
  if (!results.length) { area.innerHTML='<div class="empty-dashboard-state">رزلٹ موجود نہیں</div>'; return; }
  const avg = results.reduce((s,r)=>s+(r.pct||0),0)/results.length;
  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.3rem; font-weight:800; color:var(--accent);">کلاس رزلٹ</div>
        <div style="color:var(--muted);">${cls?.name||''} — ${term==='annual'?'سالانہ':term==='first'?'پہلی':'دوسری'} ششماہی ${year}</div>
        <div style="color:var(--accent-2); font-weight:700; margin-top:4px;">اوسط: ${avg.toFixed(1)}%</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
          <thead><tr style="background:var(--accent); color:#fff;">
            <th style="padding:10px;">#</th><th style="padding:10px;">نام</th><th style="padding:10px;">ID</th>
            <th style="padding:10px;">ششماہی</th><th style="padding:10px;">ہدف</th>
            <th style="padding:10px;">حاصل</th><th style="padding:10px;">فیصد</th>
          </tr></thead>
          <tbody>${results.map((r,i)=>`<tr style="border-bottom:1px solid var(--border);">
            <td style="padding:10px; text-align:center;">${i+1}</td>
            <td style="padding:10px; text-align:right; font-weight:700;">${r.studentName||'—'}</td>
            <td style="padding:10px; text-align:center;">${r.regNo}</td>
            <td style="padding:10px; text-align:center;">${r.term==='first'?'پہلی':'دوسری'}</td>
            <td style="padding:10px; text-align:center;">${r.targetRuku}</td>
            <td style="padding:10px; text-align:center;">${r.achievedRuku}</td>
            <td style="padding:10px; text-align:center; font-weight:800; color:${r.pct>=80?'#15803d':r.pct>=60?'#b45309':'#dc2626'}">${r.pct}%</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>`;
}

function printClassExamResult() {
  const area = document.getElementById('classExamResultArea');
  const pr   = document.getElementById('classExamResultPrint');
  if (!area.innerHTML.trim()) { renderClassExamResult(); return; }
  pr.innerHTML = area.innerHTML; pr.style.display = 'block';
  setTimeout(() => window.print(), 100);
}

function renderIndividualExamResult() {
  const id   = document.getElementById('indExamId').value.trim();
  const year = parseInt(document.getElementById('indExamYear').value);
  const area = document.getElementById('individualExamResultArea');
  if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
  const s = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo===id);
  if (!s) { area.innerHTML='<div class="empty-dashboard-state">طالب علم نہیں ملا</div>'; return; }
  const results = (storedData.examResults||[]).filter(e => e.regNo===id && e.year===year);
  if (!results.length) { area.innerHTML=`<div class="empty-dashboard-state">${s.name} کا ${year} میں کوئی رزلٹ نہیں</div>`; return; }
  const avg = results.reduce((s,r)=>s+(r.pct||0),0)/results.length;
  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.3rem; font-weight:800; color:var(--accent);">انفرادی رزلٹ ${year}</div>
        <div style="font-weight:700; font-size:1.1rem;">${s.name}</div>
        <div style="font-size:0.88rem; color:var(--muted);">والد: ${s.admFatherName||'—'} | ID: ${id}</div>
        <div style="color:var(--accent-2); font-weight:700; margin-top:4px;">سالانہ اوسط: ${avg.toFixed(1)}%</div>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
        <thead><tr style="background:var(--accent); color:#fff;">
          <th style="padding:10px;">ششماہی</th><th style="padding:10px;">ہدف (رکوع)</th>
          <th style="padding:10px;">حاصل (رکوع)</th><th style="padding:10px;">فیصد</th>
          <th style="padding:10px;">درجہ</th>
        </tr></thead>
        <tbody>${results.map(r=>`<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:10px; text-align:center;">${r.term==='first'?'پہلی':'دوسری'} ششماہی</td>
          <td style="padding:10px; text-align:center;">${r.targetRuku}</td>
          <td style="padding:10px; text-align:center;">${r.achievedRuku}</td>
          <td style="padding:10px; text-align:center; font-weight:800; color:${r.pct>=80?'#15803d':r.pct>=60?'#b45309':'#dc2626'}">${r.pct}%</td>
          <td style="padding:10px; text-align:center; font-weight:700;">${r.pct>=80?'ممتاز':r.pct>=60?'اچھا':r.pct>=40?'اوسط':'ضعیف'}</td>
        </tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function printIndividualExamResult() {
  const area = document.getElementById('individualExamResultArea');
  const pr   = document.getElementById('individualExamResultPrint');
  if (!area.innerHTML.trim()) { renderIndividualExamResult(); return; }
  pr.innerHTML = area.innerHTML; pr.style.display = 'block';
  setTimeout(() => window.print(), 100);
}





/* ===== داخلہ جات ٹیب — بٹن گرڈ فنکشن ===== */
function pickAdmType(value, btn) {
  // پرانا سیلیکٹ sync
  const sel = document.getElementById('admissionTypeSelect');
  if (sel) { sel.value = value; }

  // بٹن active state
  document.querySelectorAll('.adm-type-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // slide-down اینیمیشن
  const containers = [
    'newAdmissionFormContainer',
    'searchStudentsContainer',
    'allStudentsContainer',
    'classesContainer',
    'withdrawStudentContainer',
    'withdrawnListContainer',
    'printFormContainer'
  ];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  // toggleAdmissionForm کو call کریں (پرانا JS)
  if (typeof toggleAdmissionForm === 'function') toggleAdmissionForm();

  // نئے ظاہر ہونے والے کنٹینر پر اینیمیشن
  setTimeout(() => {
    containers.forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        el.classList.remove('slide-down');
        void el.offsetWidth; // reflow
        el.classList.add('slide-down');
      }
    });
  }, 50);
}


function printAdmissionForm() {
  window.print();
}


/* ========== طالب علم پروفائل MODAL ========== */
let _profileRegNo = null;

function openStudentProfile(regNo) {
  const r = (storedData.records||[]).find(s => s.isAdmissionProfile && s.admRegNo === regNo);
  if (!r) { alert('ریکارڈ نہیں ملا'); return; }
  _profileRegNo = regNo;

  // ہیڈر
  document.getElementById('profileModalName').textContent = r.name || '—';
  document.getElementById('profileModalId').textContent   = 'رجسٹریشن: ' + regNo;

  // تمام fields بھریں
  const fields = [
    'admRegNo','name','admFatherName','admClass','admGender',
    'admDobFull','admBForm','admDate','admAddress',
    'fatherName','fatherCnic','fatherEdu','fatherOcc',
    'fatherMobile','fatherWhatsapp','fatherEmail','fatherIncome',
    'motherName','motherCnic','motherEdu','motherOcc',
    'motherMobile','motherWhatsapp','motherIncome',
    'guardianName','guardianRel','guardianCnic',
    'guardianOcc','guardianMobile','guardianWhatsapp'
  ];
  fields.forEach(f => {
    const el = document.getElementById('pf_' + f);
    if (el) el.value = r[f] || '';
  });

  document.getElementById('studentProfileModal').style.display = 'block';
  document.body.style.overflow = 'hidden';
}

function saveStudentProfile() {
  const idx = (storedData.records||[]).findIndex(s => s.isAdmissionProfile && s.admRegNo === _profileRegNo);
  if (idx === -1) { alert('ریکارڈ نہیں ملا'); return; }

  const fields = [
    'admRegNo','name','admFatherName','admClass','admGender',
    'admDobFull','admBForm','admDate','admAddress',
    'fatherName','fatherCnic','fatherEdu','fatherOcc',
    'fatherMobile','fatherWhatsapp','fatherEmail','fatherIncome',
    'motherName','motherCnic','motherEdu','motherOcc',
    'motherMobile','motherWhatsapp','motherIncome',
    'guardianName','guardianRel','guardianCnic',
    'guardianOcc','guardianMobile','guardianWhatsapp'
  ];
  fields.forEach(f => {
    const el = document.getElementById('pf_' + f);
    if (el) storedData.records[idx][f] = el.value;
  });

  saveToLocal();
  alert('پروفائل محفوظ ہو گیا');
  closeStudentProfile();
  searchAdmissions();
}

function closeStudentProfile() {
  document.getElementById('studentProfileModal').style.display = 'none';
  document.body.style.overflow = '';
  _profileRegNo = null;
}

/* ========== ADMISSION WIZARD JS ========== */
let _wizardStep = 1;
const _wizardTotal = 4;

function wizardGoTo(step) {
  // پینلز
  for (let i = 1; i <= _wizardTotal; i++) {
    const p = document.getElementById('wpanel-' + i);
    if (p) p.style.display = (i === step) ? 'block' : 'none';
  }
  // Steps اور connectors
  for (let i = 1; i <= _wizardTotal; i++) {
    const s = document.getElementById('wstep-' + i);
    if (!s) continue;
    s.classList.remove('active', 'done');
    if (i === step) s.classList.add('active');
    else if (i < step) s.classList.add('done');
  }
  // connectors
  document.querySelectorAll('.wizard-connector').forEach((c, idx) => {
    c.classList.toggle('done', idx < step - 1);
  });
  _wizardStep = step;
  // اوپر سکرول
  const fc = document.getElementById('newAdmissionFormContainer');
  if (fc) fc.scrollIntoView({ behavior: 'smooth', block: 'start' });
  if (typeof updateGenderToggle === 'function') updateGenderToggle();
}

function wizardNext(fromStep) {
  if (fromStep === 1) {
    const name = document.getElementById('admName').value.trim();
    if (!name) { alert('براہ کرم طالب علم کا نام درج کریں۔'); return; }
  }
  if (fromStep === _wizardTotal - 1) {
    // آخری مرحلے سے پہلے جائزہ بھریں
    wizardBuildReview();
  }
  wizardGoTo(fromStep + 1);
}

function wizardBack(fromStep) {
  wizardGoTo(fromStep - 1);
}

function wizardBuildReview() {
  const get = id => (document.getElementById(id)?.value || '—');
  const genderEl = document.querySelector('input[name="admGenderRadio"]:checked');
  const guardianEl = document.querySelector('input[name="isFatherGuardian"]:checked');

  const rows = (pairs) => pairs.map(([l, v]) =>
    `<div class="review-row">
       <span class="review-label">${l}</span>
       <span class="review-value">${v || '—'}</span>
     </div>`).join('');

  const html = `
    <div class="review-section-title">طالب علم کی معلومات</div>
    ${rows([
      ['رجسٹریشن نمبر', get('admRegNo')],
      ['نام', get('admName')],
      ['والد کا نام', get('admFatherName')],
      ['تاریخ داخلہ', get('admDate')],
      ['عمر', get('admAge')],
      ['صنف', genderEl ? genderEl.value : '—'],
      ['ب فارم', get('admBForm')],
      ['پتہ', get('admAddress')],
    ])}
    <div class="review-section-title">والد کی معلومات</div>
    ${rows([
      ['نام', get('fatherName')],
      ['شناختی کارڈ', get('fatherCnic')],
      ['موبائل', get('fatherMobile')],
      ['پیشہ', get('fatherOcc')],
      ['آمدنی', get('fatherIncome')],
      ['سرپرست', guardianEl?.value === 'yes' ? 'ہاں' : 'نہیں'],
    ])}
    <div class="review-section-title">والدہ کی معلومات</div>
    ${rows([
      ['نام', get('motherName')],
      ['شناختی کارڈ', get('motherCnic')],
      ['موبائل', get('motherMobile')],
      ['پیشہ', get('motherOcc')],
    ])}
  `;
  const area = document.getElementById('wizardReviewArea');
  if (area) area.innerHTML = html;
}

// صنف ٹوگل JS (CSS :has() fallback)
function updateGenderToggle() {
  const boyRadio = document.getElementById('genderBoy');
  const girlRadio = document.getElementById('genderGirl');
  const boyLabel = document.querySelector('label[for="genderBoy"]');
  const girlLabel = document.querySelector('label[for="genderGirl"]');
  if (!boyRadio || !girlRadio) return;

  if (boyRadio.checked) {
    if(boyLabel)  { boyLabel.style.borderColor='#1d4ed8'; boyLabel.style.background='#eff6ff'; boyLabel.style.color='#1d4ed8'; }
    if(girlLabel) { girlLabel.style.borderColor=''; girlLabel.style.background=''; girlLabel.style.color=''; }
  } else {
    if(girlLabel) { girlLabel.style.borderColor='#be185d'; girlLabel.style.background='#fdf2f8'; girlLabel.style.color='#be185d'; }
    if(boyLabel)  { boyLabel.style.borderColor=''; boyLabel.style.background=''; boyLabel.style.color=''; }
  }
}
document.addEventListener('change', e => {
  if (e.target.name === 'admGenderRadio') updateGenderToggle();
});

// جب نیا داخلہ کھلے تو wizard مرحلہ 1 سے شروع کریں
const _origToggleAdm = window.toggleAdmissionForm;
window.toggleAdmissionForm = function() {
  if (typeof _origToggleAdm === 'function') _origToggleAdm();
  // wizard reset
  setTimeout(() => {
    const fc = document.getElementById('newAdmissionFormContainer');
    if (fc && fc.style.display !== 'none') wizardGoTo(1);
  }, 60);
};


/* ========== حاضری ٹیب JS ========== */
function pickAttendanceType(type, btn) {
  // hidden select sync
  const sel = document.getElementById('attendanceTypeSelect');
  if (sel) sel.value = type;

  // بٹن active
  document.querySelectorAll('.att-toggle-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // toggleAttendanceView call
  if (typeof toggleAttendanceView === 'function') toggleAttendanceView();
}

/* ===== نیا حاضری ویو سوئچر ===== */
function pickAttView(view, btn) {
  // بٹن active (صرف حاضری ٹیب کے بٹن)
  document.querySelectorAll('#tab-attendance .adm-type-btn, .adm-type-btn').forEach(b => {
    if (b.onclick && b.onclick.toString().includes('pickAttView')) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');

  // تمام att sections چھپائیں
  ['attSection-individual','attSection-studentreport','attSection-classreport','attSection-summary']
    .forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });

  // موجودہ class/staff containers
  const scEl = document.getElementById('studentAttendanceContainer');
  const sfEl = document.getElementById('staffAttendanceContainer');
  if (scEl) scEl.style.display = 'none';
  if (sfEl) sfEl.style.display = 'none';

  if (view === 'class') {
    if (scEl) { scEl.style.display = 'block'; populateClassSelects(); }
  } else if (view === 'staff') {
    if (sfEl) { sfEl.style.display = 'block'; }
    const sel = document.getElementById('attendanceTypeSelect');
    if (sel) sel.value = 'staff';
    if (typeof toggleAttendanceView === 'function') toggleAttendanceView();
  } else if (view === 'classreport') {
    const el = document.getElementById('attSection-classreport');
    if (el) { el.style.display = 'block'; populateAttCRClass(); }
    const m = document.getElementById('attCRMonth');
    if (m && !m.value) m.value = new Date().toISOString().slice(0,7);
  } else {
    const el = document.getElementById('attSection-' + view);
    if (el) el.style.display = 'block';
    if (view === 'summary') {
      const m = document.getElementById('attSumMonth');
      if (m && !m.value) m.value = new Date().toISOString().slice(0,7);
    }
    if (view === 'studentreport') {
      const now = new Date();
      const f = document.getElementById('attSRFrom');
      const t = document.getElementById('attSRTo');
      if (f && !f.value) f.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0,10);
      if (t && !t.value) t.value = now.toISOString().slice(0,10);
    }
  }
}

function populateAttCRClass() {
  const sel = document.getElementById('attCRClass');
  if (!sel) return;
  sel.innerHTML = '<option value="">کلاس منتخب کریں...</option>' +
    (storedData.classes||[]).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
}

/* ===== انفرادی اندراج ===== */
function searchIndividualStudent() {
  const id = document.getElementById('indAttRegNo').value.trim();
  if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
  const s = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo === id);
  if (!s) { alert('کوئی طالب علم نہیں ملا'); return; }
  document.getElementById('indAttName').textContent = s.name || '—';
  document.getElementById('indAttFather').textContent = s.admFatherName || '—';
  document.getElementById('indAttStudentInfo').style.display = 'flex';
  document.getElementById('indAttSaveBtn').style.display = 'inline-block';
  document.getElementById('indAttMsg').textContent = '';
  if (!document.getElementById('indAttDate').value)
    document.getElementById('indAttDate').value = new Date().toISOString().slice(0,10);
}

function saveIndividualAttendance() {
  const regNo  = document.getElementById('indAttRegNo').value.trim();
  const date   = document.getElementById('indAttDate').value;
  const status = document.getElementById('indAttStatus').value;
  if (!regNo || !date) { alert('تاریخ اور رجسٹریشن نمبر ضروری ہے'); return; }

  if (!storedData.attendance) storedData.attendance = {};
  if (!storedData.attendance[date]) storedData.attendance[date] = {};
  storedData.attendance[date][regNo] = status;
  saveToLocal();

  document.getElementById('indAttMsg').innerHTML =
    `<span style="color:var(--accent-2); font-weight:700;">محفوظ ہو گیا — ${regNo} کی حاضری ${date} کو "${status}" درج ہوئی</span>`;
}

/* ===== طالب علم کی انفرادی حاضری رپورٹ ===== */
function renderStudentAttReport() {
  const id   = document.getElementById('attSRId').value.trim();
  const from = document.getElementById('attSRFrom').value;
  const to   = document.getElementById('attSRTo').value;
  const area = document.getElementById('studentAttReportArea');
  if (!id || !from || !to) { alert('تمام فیلڈز بھریں'); return; }

  const student = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo === id);
  if (!student) { area.innerHTML = '<div class="empty-dashboard-state">طالب علم نہیں ملا</div>'; return; }

  const att = storedData.attendance || {};
  const fromD = new Date(from), toD = new Date(to);
  let rows = [], P=0, A=0, L=0, E=0;

  for (let d = new Date(fromD); d <= toD; d.setDate(d.getDate()+1)) {
    const key = d.toISOString().slice(0,10);
    if (att[key]) {
      const st = att[key][id] || null;
      if (st) {
        rows.push({ date: key, status: st });
        if (st==='P') P++; else if (st==='A') A++; else if (st==='L') L++; else if (st==='E') E++;
      }
    }
  }
  const total = P+A+L+E;
  const pct   = total ? Math.round((P/total)*100) : 0;

  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.3rem; font-weight:800; color:var(--accent);">حاضری رپورٹ</div>
        <div style="font-weight:700;">${student.name}</div>
        <div style="font-size:0.85rem; color:var(--muted);">${from} تا ${to}</div>
      </div>
      <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; justify-content:center;">
        <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px 16px; text-align:center; min-width:70px;">
          <div style="font-size:1.4rem; font-weight:800; color:#15803d;">${P}</div>
          <div style="font-size:0.8rem; color:#15803d;">حاضر</div>
        </div>
        <div style="background:#fff5f5; border:1px solid #fecaca; border-radius:8px; padding:10px 16px; text-align:center; min-width:70px;">
          <div style="font-size:1.4rem; font-weight:800; color:#dc2626;">${A}</div>
          <div style="font-size:0.8rem; color:#dc2626;">غیر حاضر</div>
        </div>
        <div style="background:#fefce8; border:1px solid #fde68a; border-radius:8px; padding:10px 16px; text-align:center; min-width:70px;">
          <div style="font-size:1.4rem; font-weight:800; color:#b45309;">${L}</div>
          <div style="font-size:0.8rem; color:#b45309;">لیٹ</div>
        </div>
        <div style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:10px 16px; text-align:center; min-width:70px;">
          <div style="font-size:1.4rem; font-weight:800; color:#0369a1;">${pct}%</div>
          <div style="font-size:0.8rem; color:#0369a1;">حاضری</div>
        </div>
      </div>
      ${rows.length ? `
      <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
        <thead><tr style="background:var(--accent); color:#fff;">
          <th style="padding:8px;">تاریخ</th><th style="padding:8px;">کیفیت</th>
        </tr></thead>
        <tbody>${rows.map(r => `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:8px; text-align:center;">${r.date}</td>
          <td style="padding:8px; text-align:center; font-weight:700; color:${r.status==='P'?'#15803d':r.status==='A'?'#dc2626':r.status==='L'?'#b45309':'#0369a1'}">${r.status}</td>
        </tr>`).join('')}</tbody>
      </table>` : '<div class="empty-dashboard-state">اس مدت میں کوئی ریکارڈ نہیں</div>'}
    </div>`;
}

function printStudentAttReport() {
  const area = document.getElementById('studentAttReportArea');
  const print = document.getElementById('studentAttReportPrint');
  if (!area.innerHTML.trim()) { renderStudentAttReport(); return; }
  print.innerHTML = area.innerHTML;
  print.style.display = 'block';
  setTimeout(() => window.print(), 100);
}

/* ===== کلاس حاضری رپورٹ ===== */
function renderClassAttReport() {
  const clsId = document.getElementById('attCRClass').value;
  const month = document.getElementById('attCRMonth').value;
  const area  = document.getElementById('classAttReportArea');
  if (!clsId || !month) { alert('کلاس اور مہینہ منتخب کریں'); return; }

  const cls      = (storedData.classes||[]).find(c => c.id === clsId);
  const students = (storedData.records||[]).filter(r => r.isAdmissionProfile && r.classId === clsId && r.status !== 'withdrawn');
  const att      = storedData.attendance || {};
  const [yr, mo] = month.split('-').map(Number);
  const days     = new Date(yr, mo, 0).getDate();

  if (!students.length) {
    area.innerHTML = '<div class="empty-dashboard-state">اس کلاس میں کوئی طالب علم نہیں</div>';
    return;
  }

  const rows = students.map(s => {
    let P=0, A=0, L=0;
    for (let d=1; d<=days; d++) {
      const key = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const st  = att[key]?.[s.admRegNo];
      if (st==='P') P++; else if (st==='A') A++; else if (st==='L') L++;
    }
    const total = P+A+L;
    const pct   = total ? Math.round((P/total)*100) : 0;
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:8px; text-align:right; font-weight:700;">${s.name||'—'}</td>
      <td style="padding:8px; text-align:center;">${s.admRegNo}</td>
      <td style="padding:8px; text-align:center; color:#15803d; font-weight:700;">${P}</td>
      <td style="padding:8px; text-align:center; color:#dc2626; font-weight:700;">${A}</td>
      <td style="padding:8px; text-align:center; color:#b45309; font-weight:700;">${L}</td>
      <td style="padding:8px; text-align:center; font-weight:800; color:${pct>=75?'#15803d':pct>=50?'#b45309':'#dc2626'}">${pct}%</td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.3rem; font-weight:800; color:var(--accent);">کلاس حاضری رپورٹ</div>
        <div style="font-size:1rem; color:var(--muted);">${cls?.name||''} — ${month}</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.88rem;">
          <thead><tr style="background:var(--accent); color:#fff;">
            <th style="padding:8px;">نام</th><th style="padding:8px;">ID</th>
            <th style="padding:8px; color:#86efac;">P</th><th style="padding:8px; color:#fca5a5;">A</th>
            <th style="padding:8px; color:#fde68a;">L</th><th style="padding:8px;">%</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

function printClassAttReport() {
  const area  = document.getElementById('classAttReportArea');
  const print = document.getElementById('classAttReportPrint');
  if (!area.innerHTML.trim()) { renderClassAttReport(); return; }
  print.innerHTML = area.innerHTML;
  print.style.display = 'block';
  setTimeout(() => window.print(), 100);
}

/* ===== خلاصہ رپورٹ ===== */
function renderAttSummary() {
  const month = document.getElementById('attSumMonth').value;
  const area  = document.getElementById('attSummaryArea');
  if (!month) return;

  const att      = storedData.attendance || {};
  const classes  = storedData.classes || [];
  const [yr, mo] = month.split('-').map(Number);
  const days     = new Date(yr, mo, 0).getDate();

  if (!classes.length) {
    area.innerHTML = '<div class="empty-dashboard-state">کوئی کلاس موجود نہیں</div>';
    return;
  }

  const rows = classes.map(cls => {
    const students = (storedData.records||[]).filter(r => r.isAdmissionProfile && r.classId === cls.id && r.status !== 'withdrawn');
    let totalP=0, totalA=0, totalL=0, totalDays=0;
    students.forEach(s => {
      for (let d=1; d<=days; d++) {
        const key = `${yr}-${String(mo).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const st  = att[key]?.[s.admRegNo];
        if (st) {
          totalDays++;
          if (st==='P') totalP++; else if (st==='A') totalA++; else if (st==='L') totalL++;
        }
      }
    });
    const pct = totalDays ? Math.round((totalP/totalDays)*100) : 0;
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:10px 14px; text-align:right; font-weight:700;">${cls.name}</td>
      <td style="padding:10px; text-align:center;">${students.length}</td>
      <td style="padding:10px; text-align:center; color:#15803d; font-weight:700;">${totalP}</td>
      <td style="padding:10px; text-align:center; color:#dc2626; font-weight:700;">${totalA}</td>
      <td style="padding:10px; text-align:center; color:#b45309; font-weight:700;">${totalL}</td>
      <td style="padding:10px; text-align:center; font-weight:800; font-size:1.05rem; color:${pct>=75?'#15803d':pct>=50?'#b45309':'#dc2626'}">${pct}%</td>
    </tr>`;
  }).join('');

  area.innerHTML = `
    <div style="background:#fff; border:1px solid var(--border); border-radius:12px; padding:20px; margin-top:14px;">
      <div style="text-align:center; border-bottom:2px solid var(--accent); padding-bottom:12px; margin-bottom:16px;">
        <div style="font-size:1.3rem; font-weight:800; color:var(--accent);">خلاصہ حاضری رپورٹ</div>
        <div style="font-size:1rem; color:var(--muted);">${month} — پورا ادارہ</div>
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%; border-collapse:collapse; font-size:0.9rem;">
          <thead><tr style="background:var(--accent); color:#fff;">
            <th style="padding:10px 14px;">کلاس</th><th style="padding:10px;">طلباء</th>
            <th style="padding:10px; color:#86efac;">حاضر</th><th style="padding:10px; color:#fca5a5;">غیر حاضر</th>
            <th style="padding:10px; color:#fde68a;">لیٹ</th><th style="padding:10px;">% حاضری</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}



function pickSession(session, btn) {
  // hidden select sync
  const sel = document.getElementById('staffAttendanceSession');
  if (sel) { sel.value = session; }

  // بٹن active
  document.querySelectorAll('.session-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');

  // loadStaffAttendance call
  if (typeof loadStaffAttendance === 'function') loadStaffAttendance();
}

// لاک انفو بینر کو خوبصورت بنائیں
const _origLoadStaff = window.loadStaffAttendance;
if (typeof _origLoadStaff === 'function') {
  window.loadStaffAttendance = function() {
    _origLoadStaff.apply(this, arguments);
    // lock info کا مواد ٹھیک کریں
    setTimeout(() => {
      const lockEl = document.getElementById('staffAttendanceLockInfo');
      if (lockEl && lockEl.style.display !== 'none' && lockEl.innerHTML) {
        lockEl.classList.add('att-lock-banner');
      }
    }, 100);
  };
}


/* ========== اسٹاف ٹیب JS ========== */
let _staffFormOpen = false;

function toggleStaffForm() {
  _staffFormOpen = !_staffFormOpen;
  const panel = document.getElementById('staffFormCollapse');
  const icon  = document.getElementById('staffFormToggleIcon');
  const text  = document.getElementById('staffFormToggleText');
  if (!panel) return;

  if (_staffFormOpen) {
    panel.style.display = 'block';
    panel.classList.remove('slide-down');
    void panel.offsetWidth;
    panel.classList.add('slide-down');
    if (icon) icon.textContent = '';
    if (text) text.textContent = 'فارم بند کریں';
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else {
    panel.style.display = 'none';
    if (icon) icon.textContent = '';
    if (text) text.textContent = 'نیا استاد شامل کریں';
  }
}

function editStaffProfile(code) {
  const profile = (storedData.staffProfiles || []).find(
    s => String(s.staffCode) === String(code)
  );
  if (!profile) { alert('پروفائل نہیں ملا۔'); return; }

  // فارم کھولیں
  if (!_staffFormOpen) toggleStaffForm();

  // فیلڈز بھریں
  const set = (id, val) => { const el = document.getElementById(id); if(el) el.value = val || ''; };
  set('staffName',           profile.name);
  set('staffFatherName',     profile.fatherName);
  set('staffCnic',           profile.cnic);
  set('staffPhone',          profile.phone);
  set('staffWhatsapp',       profile.whatsapp);
  set('staffAddress',        profile.address);
  set('staffQualification',  profile.qualification);
  set('staffJoiningDate',    profile.joiningDate);
  set('staffShiftStart',     profile.shiftStart || '06:50');
  set('staffShiftEnd',       profile.shiftEnd   || '14:45');
  set('staffExperience',     profile.experience);
  set('staffReference',      profile.reference);
  set('staffNotes',          profile.notes);
  set('staffResidenceStatus',profile.residenceStatus);

  // کلاس سیلیکٹ
  const cls = document.getElementById('staffClass');
  if (cls) cls.value = profile.assignedClass || '';

  // پرانا ریکارڈ ہٹانے کے لیے مارک کریں
  window._editingStaffCode = String(code);
  alert('ترمیم کریں اور "پروفائل محفوظ کریں" دبائیں۔');
}

function deleteStaffProfile(code) {
  if (!confirm('کیا آپ یہ پروفائل حذف کرنا چاہتے ہیں؟')) return;
  storedData.staffProfiles = (storedData.staffProfiles || []).filter(
    s => String(s.staffCode) !== String(code)
  );
  saveToLocal();
  renderStaffList();
}

// saveStaffProfile کو extend کریں تاکہ edit mode کام کرے
const _origSaveStaff = window.saveStaffProfile;
if (typeof _origSaveStaff === 'function') {
  window.saveStaffProfile = function() {
    if (window._editingStaffCode) {
      storedData.staffProfiles = (storedData.staffProfiles || []).filter(
        s => String(s.staffCode) !== String(window._editingStaffCode)
      );
      window._editingStaffCode = null;
    }
    _origSaveStaff.apply(this, arguments);
    // فارم بند کریں
    if (_staffFormOpen) toggleStaffForm();
  };
}


/* ========== فیس ٹیب JS ========== */
function pickFeeView(view, btn) {
  // بٹن active state
  document.querySelectorAll('.adm-type-btn').forEach(b => {
    if (b.closest('#tab-fees')) b.classList.remove('active');
  });
  if (btn) btn.classList.add('active');

  // تمام fee containers چھپائیں
  ['feeRecordPaymentContainer','feeReceiptContainer','feeAnalyticsContainer']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

  // متعلقہ container دکھائیں
  if (view === 'record') {
    document.getElementById('feeRecordPaymentContainer').style.display = 'block';
  } else if (view === 'receipt') {
    document.getElementById('feeReceiptContainer').style.display = 'block';
  } else if (view === 'analytics') {
    document.getElementById('feeAnalyticsContainer').style.display = 'block';
    renderFeeAnalytics();
    pickFeeReport('all', document.querySelector('.fee-report-tab-btn'));
  }
}

/* ===== رسید بنائیں ===== */
function loadStudentForReceipt() {
  const id = document.getElementById('receiptSearchId').value.trim();
  if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }

  const student = (storedData.records || []).find(r => r.isAdmissionProfile && r.admRegNo === id);
  if (!student) { alert('کوئی طالب علم نہیں ملا'); return; }

  document.getElementById('receiptDispName').textContent = student.name || '—';
  document.getElementById('receiptDispFather').textContent = student.admFatherName || '—';

  const fees = (storedData.records || [])
    .filter(r => r.isFeeRecord && r.studentId === id)
    .sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));

  const area = document.getElementById('studentPastReceiptsArea');
  if (!fees.length) {
    area.innerHTML = '<div class="empty-dashboard-state">اس طالب علم کی کوئی فیس ریکارڈ موجود نہیں</div>';
  } else {
    area.innerHTML = fees.map(f => `
      <div style="background:#fff; border:1px solid var(--border); border-radius:10px; padding:14px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-weight:700; color:var(--accent);">${f.feeMonth}</div>
          <div style="font-size:0.85rem; color:var(--muted);">رسید: ${f.invoiceId}</div>
        </div>
        <div style="font-weight:700; color:var(--accent-2);">Rs. ${(f.totalPaid||0).toLocaleString()}</div>
        <div style="font-size:0.85rem; color:var(--muted);">${f.feeMethod}</div>
        <button onclick="reprintReceipt('${f.invoiceId}')" style="background:var(--accent); color:#fff; border:none; padding:6px 14px; border-radius:7px; cursor:pointer; font-size:0.85rem;">پرنٹ</button>
      </div>`).join('');
  }
  document.getElementById('receiptStudentArea').style.display = 'block';
}

function reprintReceipt(invoiceId) {
  const fee = (storedData.records || []).find(r => r.isFeeRecord && r.invoiceId === invoiceId);
  if (!fee) { alert('رسید نہیں ملی'); return; }

  const student = (storedData.records || []).find(r => r.isAdmissionProfile && r.admRegNo === fee.studentId);
  const now = new Date(fee.timestamp);
  const monthDateObj = new Date(fee.feeMonth + '-01');
  const readableFeeMonth = monthDateObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

  document.getElementById('receiptStudentId').innerText = fee.studentId;
  document.getElementById('receiptInvoice').innerText = invoiceId;
  document.getElementById('receiptDate').innerText = now.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('receiptName').innerText = (fee.studentName||'').toUpperCase();
  document.getElementById('receiptFather').innerText = (fee.studentFather||'').toUpperCase();
  document.getElementById('receiptFeeMonth').innerText = readableFeeMonth.toUpperCase();
  document.getElementById('receiptFeeAmount').innerText = (fee.feeAmount||0).toLocaleString();
  document.getElementById('receiptArrears').innerText = (fee.feeArrears||0).toLocaleString();
  document.getElementById('receiptTotal').innerText = (fee.totalPaid||0).toLocaleString();
  document.getElementById('receiptMethod').innerText = fee.feeMethod;
  document.getElementById('receiptTimestamp').innerText = now.toLocaleString('en-PK', { hour12:true });
  window.print();
}

/* ===== رپورٹس سب-ٹیب ===== */
function pickFeeReport(type, btn) {
  document.querySelectorAll('.fee-report-tab-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['all','daily','paid','unpaid','track'].forEach(t => {
    const el = document.getElementById('feeReport_' + t);
    if (el) el.style.display = (t === type) ? 'block' : 'none';
  });
  if (type === 'daily') {
    const d = document.getElementById('dailyStatDate');
    if (d && !d.value) d.value = new Date().toISOString().slice(0,10);
    renderDailyStatement();
  }
  if (type === 'paid' || type === 'unpaid') {
    const m = document.getElementById(type === 'paid' ? 'paidReportMonth' : 'unpaidReportMonth');
    if (m && !m.value) m.value = new Date().toISOString().slice(0,7);
  }
}

/* ===== ڈیلی اسٹیٹمنٹ ===== */
function renderDailyStatement() {
  const date = document.getElementById('dailyStatDate').value;
  if (!date) return;
  const fees = (storedData.records||[]).filter(r => r.isFeeRecord && r.timestamp && r.timestamp.slice(0,10) === date);
  const area = document.getElementById('dailyStatArea');
  if (!fees.length) {
    area.innerHTML = `<div class="empty-dashboard-state">${date} کو کوئی فیس وصول نہیں ہوئی</div>`;
    return;
  }
  const total = fees.reduce((s,f) => s + (f.totalPaid||0), 0);
  area.innerHTML = `
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:14px; margin-bottom:14px; text-align:center;">
      <div style="font-size:0.9rem; color:#15803d;">مجموعی وصولی — ${date}</div>
      <div style="font-size:2rem; font-weight:800; color:#15803d;">Rs. ${total.toLocaleString()}</div>
    </div>
    ${fees.map(f => `
    <div style="background:#fff; border:1px solid var(--border); border-radius:10px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <div style="font-weight:700;">${f.studentName||'—'}</div>
        <div style="font-size:0.82rem; color:var(--muted);">${f.studentId} | ${f.feeMonth}</div>
      </div>
      <div style="font-weight:700; color:var(--accent-2);">Rs. ${(f.totalPaid||0).toLocaleString()}</div>
      <div style="font-size:0.82rem; color:var(--muted);">${f.feeMethod}</div>
    </div>`).join('')}`;
}

/* ===== دہندہ رپورٹ ===== */
function renderPaidReport() {
  const month = document.getElementById('paidReportMonth').value;
  if (!month) return;
  const fees = (storedData.records||[]).filter(r => r.isFeeRecord && r.feeMonth === month);
  const area = document.getElementById('paidReportArea');
  if (!fees.length) {
    area.innerHTML = `<div class="empty-dashboard-state">${month} میں کوئی ادائیگی نہیں</div>`;
    return;
  }
  area.innerHTML = `
    <div style="font-weight:700; color:var(--accent-2); margin-bottom:10px;">مہینہ ${month} — ${fees.length} دہندگان</div>
    ${fees.map(f => `
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <div style="font-weight:700;">${f.studentName||'—'}</div>
        <div style="font-size:0.82rem; color:var(--muted);">${f.studentId}</div>
      </div>
      <div style="font-weight:700; color:var(--accent-2);">Rs. ${(f.totalPaid||0).toLocaleString()}</div>
      <div style="font-size:0.82rem; color:var(--muted);">${f.feeMethod}</div>
    </div>`).join('')}`;
}

/* ===== نادہندہ رپورٹ ===== */
function renderUnpaidReport() {
  const month = document.getElementById('unpaidReportMonth').value;
  if (!month) return;
  const allStudents = (storedData.records||[]).filter(r => r.isAdmissionProfile && r.status !== 'withdrawn');
  const paidIds = new Set((storedData.records||[]).filter(r => r.isFeeRecord && r.feeMonth === month).map(r => r.studentId));
  const unpaid = allStudents.filter(s => !paidIds.has(s.admRegNo));
  const area = document.getElementById('unpaidReportArea');
  if (!unpaid.length) {
    area.innerHTML = `<div class="empty-dashboard-state">ماشاءاللہ! ${month} میں تمام طلباء کی فیس جمع ہے</div>`;
    return;
  }
  area.innerHTML = `
    <div style="font-weight:700; color:var(--danger); margin-bottom:10px;">مہینہ ${month} — ${unpaid.length} نادہندگان</div>
    ${unpaid.map(s => `
    <div style="background:#fff5f5; border:1px solid #fecaca; border-radius:10px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div>
        <div style="font-weight:700;">${s.name||'—'}</div>
        <div style="font-size:0.82rem; color:var(--muted);">${s.admRegNo} | والد: ${s.admFatherName||'—'}</div>
      </div>
      <div style="font-size:0.82rem; color:var(--danger); font-weight:700;">فیس باقی</div>
    </div>`).join('')}`;
}

/* ===== انفرادی فیس ٹریکنگ ===== */
function renderFeeTrack() {
  const id = document.getElementById('trackFeeId').value.trim();
  if (!id) { alert('رجسٹریشن نمبر درج کریں'); return; }
  const student = (storedData.records||[]).find(r => r.isAdmissionProfile && r.admRegNo === id);
  const fees = (storedData.records||[]).filter(r => r.isFeeRecord && r.studentId === id)
                 .sort((a,b) => a.feeMonth.localeCompare(b.feeMonth));
  const area = document.getElementById('feeTrackArea');
  if (!student) { area.innerHTML = '<div class="empty-dashboard-state">کوئی طالب علم نہیں ملا</div>'; return; }

  const total = fees.reduce((s,f) => s+(f.totalPaid||0), 0);
  area.innerHTML = `
    <div class="fee-student-badge" style="margin-bottom:16px;">
      <div class="fee-student-avatar"></div>
      <div>
        <div class="fee-student-name">${student.name||'—'}</div>
        <div class="fee-student-father">والد: ${student.admFatherName||'—'} | ID: ${id}</div>
      </div>
    </div>
    <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:12px; margin-bottom:14px; text-align:center;">
      <div style="font-size:0.85rem; color:#15803d;">کل جمع شدہ فیس (داخلے سے اب تک)</div>
      <div style="font-size:1.8rem; font-weight:800; color:#15803d;">Rs. ${total.toLocaleString()}</div>
    </div>
    ${!fees.length
      ? '<div class="empty-dashboard-state">ابھی تک کوئی فیس جمع نہیں ہوئی</div>'
      : fees.map(f => `
    <div style="background:#fff; border:1px solid var(--border); border-radius:10px; padding:12px 16px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
      <div style="font-weight:700; color:var(--accent);">${f.feeMonth}</div>
      <div style="font-size:0.82rem; color:var(--muted);">رسید: ${f.invoiceId}</div>
      <div style="font-weight:700; color:var(--accent-2);">Rs. ${(f.totalPaid||0).toLocaleString()}</div>
      <div style="font-size:0.82rem; color:var(--muted);">${f.feeMethod}</div>
    </div>`).join('')}`;
}



/* ========================================
   ماہانہ جائزہ — مکمل JS
   ======================================== */

// مضامین کی تعریف — max نمبر تصویر کے مطابق
const ME_COLS = [
  { key:'attendance', label:'حاضری',   max:10,  icon:'' },
  { key:'manzil',     label:'منزل',    max:60,  icon:'' },
  { key:'tajweed',    label:'تجوید',   max:10,  icon:'' },
  { key:'islamiat',   label:'اسلامیات',max:10,  icon:''  },
  { key:'itmaad',     label:'اعتماد',  max:10,  icon:'' },
  // خواندگی — دو ذیلی فیلڈز
  { key:'para',       label:'پارہ نمبر',   max:null, icon:'', group:'literacy', sub:true },
  { key:'tarkoo',     label:'ترکو نمبر',   max:null, icon:'', group:'literacy', sub:true },
];

// کل ممکنہ نمبر (صرف scored فیلڈز)
const ME_MAX_TOTAL = ME_COLS.filter(c=>c.max).reduce((s,c)=>s+c.max, 0);

// گریڈ
function meGrade(pct) {
  if (pct >= 90) return { g:'A+', cls:'me-total-a' };
  if (pct >= 75) return { g:'A',  cls:'me-total-a' };
  if (pct >= 60) return { g:'B',  cls:'me-total-b' };
  if (pct >= 50) return { g:'C',  cls:'me-total-c' };
  return               { g:'D',  cls:'me-total-d' };
}

// کلاس dropdown بھریں
function mePopulateClasses() {
  const sels = ['meClassSelect','meHistoryClassFilter'];
  sels.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const prefix = id === 'meHistoryClassFilter' ? '<option value="">تمام کلاسز</option>' : '<option value="">کلاس منتخب کریں...</option>';
    el.innerHTML = prefix + (storedData.classes||[]).map(
      c=>`<option value="${c.id}">${c.name}</option>`
    ).join('');
  });
}

// طلباء لوڈ کریں اور ٹیبل بنائیں
function meLoadStudents() {
  const classId   = document.getElementById('meClassSelect')?.value;
  const month     = document.getElementById('meMonth')?.value;
  const year      = document.getElementById('meYear')?.value;
  const area      = document.getElementById('meTableArea');
  if (!area) return;

  if (!classId) { alert('براہ کرم پہلے کلاس منتخب کریں۔'); return; }

  const cls      = (storedData.classes||[]).find(c=>c.id===classId);
  const students = (storedData.records||[])
    .filter(r=>r.isAdmissionProfile && r.admClass===classId && !r.isWithdrawn)
    .sort((a,b)=>Number(a.admRegNo||0)-Number(b.admRegNo||0));

  if (students.length === 0) {
    area.innerHTML = '<div class="empty-dashboard-state">اس کلاس میں کوئی طالب علم موجود نہیں۔</div>';
    return;
  }

  // پہلے سے محفوظ ریکارڈ چیک کریں
  const existing = (storedData.monthlyExams||[]).find(
    r=>r.classId===classId && r.month===month && r.year===year
  );

  // ہیڈر — دو قطاریں
  const nonSub = ME_COLS.filter(c=>!c.sub);
  const hasLit = ME_COLS.some(c=>c.sub);

  const thead = `
    <thead>
      <tr>
        <th rowspan="2" style="min-width:48px;">نمبر</th>
        <th rowspan="2" style="min-width:160px; text-align:right; padding-right:12px;">طالب علم</th>
        ${nonSub.map(c=>`<th rowspan="2">${c.icon ? c.icon + '<br>' : ''}${c.label}<br><span class="me-max-label">/ ${c.max}</span></th>`).join('')}
        ${hasLit ? `<th colspan="2" class="me-literacy-group">خواندگی</th>` : ''}
        <th rowspan="2" style="min-width:80px;">کل<br><span class="me-max-label">/ ${ME_MAX_TOTAL}</span></th>
      </tr>
      <tr class="me-subhead">
        ${ME_COLS.filter(c=>c.sub).map(c=>`<th class="me-literacy-sub">${c.icon ? c.icon + ' ' : ''}${c.label}</th>`).join('')}
      </tr>
    </thead>`;

  // قطاریں
  const rows = students.map(s => {
    const prev = existing?.students?.find(r=>r.regNo===s.admRegNo) || {};
    const inputs = ME_COLS.map(c => {
      const val = prev[c.key] ?? '';
      if (c.sub) {
        return `<td><input type="text" class="me-input" style="width:70px;"
          id="me_${s.admRegNo}_${c.key}" value="${val}"
          placeholder="${c.label.charAt(0)}"
          oninput="meCalcRow('${s.admRegNo}')"></td>`;
      }
      return `<td><input type="number" class="me-input"
        id="me_${s.admRegNo}_${c.key}"
        min="0" max="${c.max}" value="${val}" placeholder="0"
        oninput="meCalcRow('${s.admRegNo}')"></td>`;
    }).join('');

    return `<tr id="me-row-${s.admRegNo}">
      <td><span class="me-reg">${s.admRegNo||'-'}</span></td>
      <td class="me-td-info"><span class="me-name">${s.name||'-'}</span></td>
      ${inputs}
      <td id="me_${s.admRegNo}_total">
        <span class="me-total-cell me-total-na">—</span>
      </td>
    </tr>`;
  }).join('');

  // خلاصہ بار
  const saveBar = `
    <div class="me-save-bar" style="margin-top:18px;">
      <button class="me-save-btn" onclick="meSaveExam('${classId}','${month}','${year}')">
        💾 ${cls?.name||''} — ${month} ${year} محفوظ کریں
      </button>
      <div class="me-summary-chips">
        <span class="me-chip me-chip-green">طلباء: ${students.length}</span>
        <span class="me-chip me-chip-blue">کل نمبر: ${ME_MAX_TOTAL}</span>
      </div>
      ${existing ? '<span style="color:#16a34a; font-size:0.88rem; font-weight:700;">پہلے سے ریکارڈ موجود — اپ ڈیٹ ہو گا</span>' : ''}
    </div>`;

  area.innerHTML = `
    <div class="me-table-wrap">
      <table class="me-table">
        ${thead}
        <tbody>${rows}</tbody>
      </table>
    </div>
    ${saveBar}`;

  // موجودہ totals حساب کریں
  students.forEach(s=>meCalcRow(s.admRegNo));
}

// ایک قطار کا total
function meCalcRow(regNo) {
  let total = 0;
  ME_COLS.filter(c=>c.max).forEach(c=>{
    const el = document.getElementById(`me_${regNo}_${c.key}`);
    if (!el) return;
    const v = Number(el.value||0);
    // validation
    if (v > c.max) { el.classList.add('me-invalid'); }
    else           { el.classList.remove('me-invalid'); }
    total += Math.min(v, c.max);
  });

  const pct  = ME_MAX_TOTAL > 0 ? (total/ME_MAX_TOTAL)*100 : 0;
  const gd   = meGrade(pct);
  const cell = document.getElementById(`me_${regNo}_total`);
  if (cell) {
    cell.innerHTML = `<span class="me-total-cell ${gd.cls}" title="${pct.toFixed(1)}% — ${gd.g}">${total}</span>`;
  }
}

// محفوظ کریں
function meSaveExam(classId, month, year) {
  const cls      = (storedData.classes||[]).find(c=>c.id===classId);
  const students = (storedData.records||[])
    .filter(r=>r.isAdmissionProfile && r.admClass===classId && !r.isWithdrawn);

  if (students.length===0) { alert('کوئی طالب علم نہیں۔'); return; }

  const studentData = students.map(s=>{
    const row = { regNo:s.admRegNo, name:s.name };
    ME_COLS.forEach(c=>{
      const el = document.getElementById(`me_${s.admRegNo}_${c.key}`);
      row[c.key] = c.max ? Number(el?.value||0) : (el?.value||'');
    });
    // total
    row.total = ME_COLS.filter(c=>c.max)
      .reduce((sum,c)=>sum+Math.min(Number(row[c.key]||0),c.max), 0);
    const pct = ME_MAX_TOTAL>0 ? (row.total/ME_MAX_TOTAL)*100 : 0;
    row.pct   = +pct.toFixed(1);
    row.grade = meGrade(pct).g;
    return row;
  });

  if (!storedData.monthlyExams) storedData.monthlyExams = [];

  const idx = storedData.monthlyExams.findIndex(
    r=>r.classId===classId && r.month===month && r.year===year
  );
  const record = {
    classId, className:cls?.name||classId,
    month, year, students:studentData,
    savedAt: new Date().toISOString()
  };

  if (idx>-1) storedData.monthlyExams[idx] = record;
  else        storedData.monthlyExams.push(record);

  saveToLocal();
  meRenderHistory();

  const avg = studentData.reduce((s,r)=>s+r.pct,0)/studentData.length;
  alert(`${cls?.name||''} — ${month} ${year}\n${studentData.length} طلباء کا ریکارڈ محفوظ ہو گیا!\nکلاسی اوسط: ${avg.toFixed(1)}%`);
}

// تاریخ render
function meRenderHistory() {
  const area    = document.getElementById('meHistoryArea');
  const clsF    = document.getElementById('meHistoryClassFilter')?.value||'';
  const monthF  = document.getElementById('meHistoryMonthFilter')?.value||'';
  if (!area) return;

  let exams = (storedData.monthlyExams||[])
    .filter(r=>(!clsF||r.classId===clsF) && (!monthF||r.month===monthF))
    .sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));

  if (!exams.length) {
    area.innerHTML='<div class="empty-dashboard-state">کوئی ریکارڈ موجود نہیں۔</div>';
    return;
  }

  area.innerHTML = exams.map((exam,ei)=>{
    const avg = exam.students.reduce((s,r)=>s+(r.pct||0),0)/exam.students.length;
    const gd  = meGrade(avg);
    const rows = exam.students.map(s=>{
      const sg = meGrade(s.pct||0);
      return `<tr>
        <td><span style="font-size:0.78rem;color:var(--muted);">${s.regNo||'-'}</span></td>
        <td style="text-align:right;font-weight:700;padding-right:10px;">${s.name||'-'}</td>
        ${ME_COLS.filter(c=>!c.sub&&c.max).map(c=>`<td style="text-align:center;">${s[c.key]??0}/${c.max}</td>`).join('')}
        <td style="text-align:center;">${s.para||'—'}</td>
        <td style="text-align:center;">${s.tarkoo||'—'}</td>
        <td style="text-align:center;">
          <span class="me-total-cell ${sg.cls}" style="font-size:0.88rem;">${s.total}</span>
        </td>
        <td style="text-align:center;">
          <span style="font-size:0.8rem;font-weight:700;color:${sg.cls.includes('total-a')?'#15803d':sg.cls.includes('total-b')?'#1d4ed8':sg.cls.includes('total-c')?'#d97706':'#dc2626'}">${s.pct}% (${s.grade})</span>
        </td>
      </tr>`;
    }).join('');

    return `
      <div class="me-history-card">
        <div class="me-history-header">
          <div>
            <span class="me-history-title">${exam.className}</span>
            <span class="me-history-badge" style="margin-right:8px;">${exam.month} ${exam.year}</span>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="me-chip me-chip-green">اوسط: ${avg.toFixed(1)}% ${gd.g}</span>
            <span class="me-chip me-chip-blue">طلباء: ${exam.students.length}</span>
            <button class="me-del-btn" onclick="meDeleteExam(${ei})">حذف</button>
          </div>
        </div>
        <div class="me-table-wrap" style="margin-bottom:0;">
          <table class="me-table" style="min-width:700px;">
            <thead>
              <tr>
                <th>نمبر</th><th>نام</th>
                ${ME_COLS.filter(c=>!c.sub&&c.max).map(c=>`<th>${c.label}</th>`).join('')}
                <th>پارہ</th><th>ترکو</th>
                <th>کل</th><th>فیصد</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`;
  }).join('');
}

function meDeleteExam(displayIdx) {
  if(!confirm('کیا آپ یہ ریکارڈ حذف کرنا چاہتے ہیں؟')) return;
  const clsF   = document.getElementById('meHistoryClassFilter')?.value||'';
  const monthF = document.getElementById('meHistoryMonthFilter')?.value||'';
  let exams = (storedData.monthlyExams||[])
    .filter(r=>(!clsF||r.classId===clsF)&&(!monthF||r.month===monthF))
    .sort((a,b)=>new Date(b.savedAt)-new Date(a.savedAt));
  const target = exams[displayIdx];
  if (!target) return;
  storedData.monthlyExams = storedData.monthlyExams.filter(r=>r!==target);
  saveToLocal();
  meRenderHistory();
}

// جب section کھلے
const _meOrigToggle = window.toggleEntrySection;
window.toggleEntrySection = function() {
  if (typeof _meOrigToggle==='function') _meOrigToggle();
  setTimeout(()=>{
    if (document.getElementById('entrySection-monthly')?.style.display!=='none') {
      mePopulateClasses();
      meRenderHistory();
    }
  }, 50);
};

// storedData init
const _meOrigLoad = window.loadFromLocal;
window.loadFromLocal = function() {
  if (typeof _meOrigLoad==='function') _meOrigLoad();
  if (!storedData.monthlyExams) storedData.monthlyExams = [];
};

window.onload = function() {
    // initApp نہیں ہے — DOMContentLoaded میں سب ہو چکا
    initSpeechRecognition();
    loadTargetAyah(); // پہلی آیت خودبخود لوڈ کریں
    if (typeof showTab === "function") showTab("dashboard");
};



  
