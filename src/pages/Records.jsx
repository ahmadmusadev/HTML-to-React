import React, { useState, useEffect } from 'react';
import { useMadrasa } from '../context/MadrasaContext';
import { mapSupabaseToUi as mapStudentToUi } from './Admissions';
import { isValidUUID } from '../lib/supabaseClient';

export const mapSupabaseToUi = (row, studentLookup = {}) => {
  if (!row) return null;
  if (row.isAdmissionProfile || row.isFeeRecord) return null;

  // Already mapped or legacy structure check
  if (row.year !== undefined && row.halfYear !== undefined && row.attendance && !row.hifz_year) {
    return row;
  }

  const student = row.students || (row.student_id ? studentLookup[row.student_id] : null) || {};
  const studentName = student.name || student.admName || row.student_name || row.name || '';

  const totalWorking = Number(row.total_working ?? row.attendance?.working) || 0;
  const totalPresent = Number(row.total_present ?? row.attendance?.present) || 0;
  const totalAbsent = Number(row.total_absent ?? row.attendance?.absent) || 0;
  const totalLeave = Number(row.total_leave ?? row.attendance?.leave) || 0;
  const attPct = row.attendance_pct != null
    ? Number(row.attendance_pct)
    : (row.attendance?.pct != null
      ? Number(row.attendance.pct)
      : (totalWorking ? +((totalPresent / totalWorking) * 100).toFixed(2) : 0));

  const monthlyAcademic = row.monthly_academic_details || row.monthlyAcademicDetails || {};
  const monthlyAttendance = row.monthly_attendance_details || row.attendance?.monthlyDetails || {};

  const ts = row.updated_at || row.created_at || row.ts || new Date().toISOString();

  return {
    id: row.id,
    studentId: student.roll_number || student.admRegNo || row.student_id || '',
    studentUuid: row.student_id || '',
    name: studentName,
    year: Number(row.hifz_year ?? row.year ?? 1),
    halfYear: Number(row.half_year ?? row.halfYear ?? 1),
    pages: Number(row.total_pages ?? row.pages) || 0,
    pao: Number(row.pao) || 0,
    juz: Number(row.juz) || 0,
    pct: Number(row.pct) || 0,
    score: Number(row.score) || 0,
    attendance: {
      working: totalWorking,
      present: totalPresent,
      absent: totalAbsent,
      leave: totalLeave,
      pct: attPct,
      monthlyDetails: monthlyAttendance
    },
    monthlyAcademicDetails: monthlyAcademic,
    ts: ts
  };
};

export const mapUiToSupabase = (data, madrasaId) => {
  return {
    id: data.id && isValidUUID(data.id) ? data.id : undefined,
    madrasa_id: madrasaId || data.madrasa_id || null,
    student_id: data.studentUuid || data.student_id || null,
    hifz_year: Number(data.year || data.hifz_year || 1),
    half_year: Number(data.halfYear || data.half_year || 1),
    total_pages: Number(data.pages ?? data.total_pages) || 0,
    pao: Number(data.pao) || 0,
    juz: Number(data.juz) || 0,
    pct: Number(data.pct) || 0,
    score: Number(data.score) || 0,
    total_working: Number(data.attendance?.working ?? data.total_working) || 0,
    total_present: Number(data.attendance?.present ?? data.total_present) || 0,
    total_absent: Number(data.attendance?.absent ?? data.total_absent) || 0,
    total_leave: Number(data.attendance?.leave ?? data.total_leave) || 0,
    attendance_pct: Number(data.attendance?.pct ?? data.attendance_pct) || 0,
    monthly_academic_details: data.monthlyAcademicDetails || data.monthly_academic_details || {},
    monthly_attendance_details: data.attendance?.monthlyDetails || data.monthly_attendance_details || {},
    updated_at: new Date().toISOString()
  };
};

export default function Records() {
  const {
    activeMadrasaId,
    loadMadrasaData,
    saveMadrasaData,
    fetchHifzHalfYearRecordsFromSupabase,
    deleteHifzHalfYearRecordFromSupabase,
    fetchStudentsFromSupabase
  } = useMadrasa();

  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Load from Supabase with local fallback
  const loadData = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      let hasError = false;
      const [stdsData, hifzData] = await Promise.all([
        fetchStudentsFromSupabase(activeMadrasaId).catch(err => {
          console.warn('Students fetch error in Records:', err);
          hasError = true;
          return null;
        }),
        fetchHifzHalfYearRecordsFromSupabase(activeMadrasaId).catch(err => {
          console.warn('Hifz records fetch error in Records:', err);
          hasError = true;
          return null;
        })
      ]);

      const studentLookup = {};
      if (stdsData) {
        const mappedStudents = stdsData.map(mapStudentToUi).filter(Boolean);
        mappedStudents.forEach(s => {
          if (s.id) studentLookup[s.id] = s;
        });
      }

      if (hifzData) {
        const mapped = hifzData
          .map(r => mapSupabaseToUi(r, studentLookup))
          .filter(Boolean);
        setRecords(mapped);
      } else {
        // Fallback local storage
        const stored = loadMadrasaData('hf_records_v1') || {};
        const localMapped = (stored.records || [])
          .map(r => mapSupabaseToUi(r, studentLookup))
          .filter(Boolean);
        setRecords(localMapped);
      }

      if (hasError) {
        setFetchError('سرور سے ریکارڈز لوڈ کرنے میں دشواری پیش آئی، لوکل ریکارڈز دکھائے جا رہے ہیں۔');
      }
    } catch (e) {
      console.error('Failed loading records:', e);
      setFetchError('ڈیٹا لوڈ کرنے میں خرابی پیش آئی۔');
      const stored = loadMadrasaData('hf_records_v1') || {};
      setRecords((stored.records || []).map(r => mapSupabaseToUi(r, {})).filter(Boolean));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeMadrasaId]);

  const deleteRecord = async (rec) => {
    if (!window.confirm('کیا آپ یہ تعلیمی ریکارڈ حذف کرنا چاہتے ہیں؟')) return;
    try {
      const recId = rec.id || rec.ts;
      await deleteHifzHalfYearRecordFromSupabase(recId, activeMadrasaId);
      const newRecords = records.filter(r => !(r.id === rec.id && r.ts === rec.ts && r.name === rec.name));
      setRecords(newRecords);
    } catch (err) {
      console.error('Failed to delete record:', err);
      alert('ریکارڈ حذف کرنے میں خرابی: ' + (err.message || err));
    }
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

      {fetchError && (
        <div style={{ background: '#fff3cd', color: '#856404', padding: '10px 15px', borderRadius: '8px', marginBottom: '15px' }}>
          ⚠️ {fetchError}
        </div>
      )}

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
        {loading ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '30px' }}>
            ⏳ ریکارڈز لوڈ ہو رہے ہیں...
          </div>
        ) : filteredRecords.length === 0 ? (
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
                  const timeStr = !isNaN(d.getTime())
                    ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
                    : '-';
                  const dateStr = !isNaN(d.getTime())
                    ? d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    : '-';

                  const attWork = r.attendance ? r.attendance.working : '-';
                  const attAbsent = r.attendance ? (r.attendance.absent || 0) : 0;
                  const attLeave = r.attendance ? (r.attendance.leave || 0) : 0;
                  const attTotalOff = attAbsent + attLeave;
                  const attPct = r.attendance && r.attendance.pct != null ? r.attendance.pct + '%' : '-';

                  return (
                    <tr key={(r.id || '') + (r.ts || '') + (r.name || '') + i}>
                      <td>{r.name}</td>
                      <td>سال {r.year}<br /><span style={{ fontSize: '0.8rem' }}>ششماہی {r.halfYear}</span></td>
                      <td><b>{r.pages}</b> <span style={{ fontSize: '0.8rem' }}>({r.pao} پاؤ / {r.juz} پارہ)</span></td>
                      <td style={{ fontWeight: 'bold', color: r.pct >= 75 ? 'var(--accent)' : 'var(--danger)' }}>{r.pct}%</td>
                      <td>{attTotalOff} / {attWork}</td>
                      <td style={{ fontWeight: 'bold' }}>{attPct}</td>
                      <td style={{ fontSize: '0.8rem', direction: 'ltr', textAlign: 'right' }}>{monthlyText || '—'}</td>
                      <td style={{ fontSize: '0.75rem' }}>{timeStr}<br />{dateStr}</td>
                      <td>
                        <button 
                          onClick={() => deleteRecord(r)} 
                          style={{ padding: '5px 10px', fontSize: '0.8rem', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
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
          <div className="card result" style={{ marginTop: '25px' }}>
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
