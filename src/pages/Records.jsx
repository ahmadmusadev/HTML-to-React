import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';

export default function Records() {
  const { activeMadrasaId, loadMadrasaData, saveMadrasaData } = useMadrasa();
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load from local storage on mount and when active madrasa changes
  const loadLocalData = () => {
    const storedData = loadMadrasaData('hf_records_v1') || {};
    setRecords(storedData.records || []);
  };

  useEffect(() => {
    loadLocalData();
  }, [activeMadrasaId]);

  // Save to local storage when deleting
  const saveToLocal = (newRecords) => {
    let storedData = loadMadrasaData('hf_records_v1') || {};
    storedData.records = newRecords;
    saveMadrasaData('hf_records_v1', storedData);
    setRecords(newRecords);
  };

  const deleteRecord = (ts, name) => {
    if (!window.confirm('حذف کریں؟')) return;
    const newRecords = records.filter(r => !(r.ts === ts && r.name === name));
    saveToLocal(newRecords);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  // Only filter academic records (not admission profiles)
  const academicRecords = records.filter(r => r && r.name && !r.isAdmissionProfile);

  // Sort by newest first (by ts timestamp)
  const sortedRecords = [...academicRecords].sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));

  // Search filter
  const searchTerm = searchQuery.trim().toLowerCase();
  const filteredRecords = sortedRecords.filter(r =>
    (r.name || '').toLowerCase().includes(searchTerm)
  );

  // Annual Summary Calculation for all academic records
  const annualData = academicRecords.reduce((acc, r) => {
    if (!r.name) return acc;
    if (!acc[r.name]) acc[r.name] = {};

    const key = r.year;
    if (!acc[r.name][key]) {
      acc[r.name][key] = { totalPages: 0, totalWorking: 0, totalPresent: 0, totalAbsent: 0, totalLeave: 0, count: 0 };
    }

    acc[r.name][key].totalPages += (r.pages || 0);
    if (r.attendance) {
      acc[r.name][key].totalWorking += (r.attendance.working || 0);
      acc[r.name][key].totalPresent += (r.attendance.present || 0);
      acc[r.name][key].totalAbsent += (r.attendance.absent || 0);
      acc[r.name][key].totalLeave += (r.attendance.leave || 0);
      acc[r.name][key].count += 1;
    }
    return acc;
  }, {});

  return (
    <div className="tab-content" id="tab-records">
      <h2>اکیڈمک ریکارڈ تلاش کریں</h2>
      <div className="search-container">
        <input 
          type="text" 
          id="studentSearch"  
          placeholder="بچے کا نام لکھ کر تلاش کریں..." 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <button onClick={handleClearSearch}>واضح کریں</button>
      </div>

      <div id="recordsArea">
        {filteredRecords.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '20px' }}>
            {searchTerm ? `"${searchQuery}" کے نام سے کوئی ریکارڈ نہیں ملا۔` : 'کوئی محفوظ شدہ ریکارڈ موجود نہیں۔'}
          </div>
        ) : (
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>نام</th>
                  <th>سال/ششماہی</th>
                  <th>صفحات/پاؤ/پارہ</th>
                  <th>تعلیمی %</th>
                  <th>حاضری (A+L/W)</th>
                  <th>حاضری %</th>
                  <th style={{ minWidth: '180px' }}>ماہانہ تفصیل (خواندگی)</th>
                  <th>وقت</th>
                  <th>عمل</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r, i) => {
                  const monthlyText = Object.keys(r.monthlyAcademicDetails || {})
                    .map(m => `${r.monthlyAcademicDetails[m]}`)
                    .join(' / ');

                  const d = r.ts ? new Date(r.ts) : new Date();
                  const timeStr = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
                  const dateStr = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' });

                  const attWork = r.attendance ? r.attendance.working : '-';
                  const attAbsent = r.attendance ? (r.attendance.absent || 0) : 0;
                  const attLeave = r.attendance ? (r.attendance.leave || 0) : 0;
                  const attTotalOff = attAbsent + attLeave;
                  const attPct = r.attendance && r.attendance.pct != null ? r.attendance.pct + '%' : '-';

                  return (
                    <tr key={(r.ts || '') + (r.name || '') + i}>
                      <td>{r.name}</td>
                      <td>سال {r.year}<br /><span style={{ fontSize: '0.8rem' }}>ششماہی {r.halfYear}</span></td>
                      <td><b>{r.pages}</b> <span style={{ fontSize: '0.8rem' }}>({r.pao} پاؤ / {r.juz} پارہ)</span></td>
                      <td style={{ fontWeight: 'bold', color: r.pct >= 75 ? 'var(--accent)' : 'var(--danger)' }}>{r.pct}%</td>
                      <td>{attTotalOff} / {attWork}</td>
                      <td style={{ fontWeight: 'bold' }}>{attPct}</td>
                      <td style={{ fontSize: '0.8rem', direction: 'ltr', textAlign: 'right' }}>{monthlyText}</td>
                      <td style={{ fontSize: '0.75rem' }}>{timeStr}<br />{dateStr}</td>
                      <td>
                        <button 
                          onClick={() => deleteRecord(r.ts, r.name)} 
                          style={{ padding: '5px 10px', fontSize: '0.8rem', background: 'var(--danger)' }}
                        >
                          حذف
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div id="summaryArea">
        {academicRecords.length > 0 && (
          <div className="card result">
            <h2>سالانہ حاضری کا خلاصہ</h2>
            <div className="table-responsive summary-table">
              <table>
                <thead>
                  <tr>
                    <th>نام</th>
                    <th>سال</th>
                    <th>ششماہی کی تعداد</th>
                    <th>کل ایام کار</th>
                    <th>کل غیر حاضری + رخصت</th>
                    <th>کل حاضر ایام</th>
                    <th>سالانہ حاضری %</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(annualData).sort().map(name => {
                    return Object.keys(annualData[name]).sort().map(year => {
                      const data = annualData[name][year];
                      if (data.count === 0) return null;

                      const title = data.count === 2 ? `سال ${year} (مکمل)` : `سال ${year} (نامکمل)`;
                      const attPct = data.totalWorking ? ((data.totalPresent / data.totalWorking) * 100).toFixed(2) : 0;
                      const rowStyle = data.count === 2 ? { fontWeight: 'bold', background: '#f0f9f2' } : { background: '#fff' };

                      return (
                        <tr key={`${name}-${year}`} style={rowStyle}>
                          <td>{name}</td>
                          <td>{title}</td>
                          <td>{data.count}</td>
                          <td>{data.totalWorking}</td>
                          <td>{data.totalAbsent + data.totalLeave}</td>
                          <td>{data.totalPresent}</td>
                          <td style={{ fontWeight: 'bold', color: attPct >= 80 ? 'var(--accent)' : 'var(--danger)' }}>{attPct}%</td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
