// server/api/staffSchedule.js
const { supabase } = require('../supabaseClient');

const toISODate = d => d.toISOString().slice(0, 10);

const parseMonth = monthStr => {
  if (!/^\d{4}-\d{2}$/.test(monthStr || '')) return null;
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start, end };
};

const normalizeTime = t => {
  if (!t) return null;
  const s = String(t).trim();
  if (/^\d{2}:\d{2}:\d{2}$/.test(s)) return s;
  if (/^\d{2}:\d{2}$/.test(s)) return `${s}:00`;
  return null;
};

const hoursBetween = (startTime, endTime) => {
  const s = String(startTime || '').slice(0, 5);
  const e = String(endTime || '').slice(0, 5);
  const [sh, sm] = s.split(':').map(Number);
  const [eh, em] = e.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return 0;
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, mins) / 60;
};

const getWeekKeySun = isoDate => {
  // Week bucket: Sunday-start, local time (matches frontend)
  const d = new Date(isoDate + 'T00:00:00');
  const day = d.getDay(); // 0 Sun
  const wk = new Date(d);
  wk.setDate(d.getDate() - day);
  return wk.toISOString().slice(0, 10);
};

const computeMonthDays = ({ monthStart, monthEnd, defaultWeek, exMap, defaultZip }) => {
  const days = [];
  const cur = new Date(monthStart.getTime());

  while (cur <= monthEnd) {
    const iso = toISODate(cur);
    const weekday = cur.getUTCDay(); // 0..6

    const base = defaultWeek.find(x => Number(x.weekday) === weekday) || null;
    const ex = exMap[iso] || null;

    let isWorking = !!base?.is_working;
    let start_time = base?.start_time || null;
    let end_time = base?.end_time || null;
    let zip = base?.zip || defaultZip;

    if (ex && ex.approval_status !== 'rejected') {
      if (ex.is_day_off) {
        isWorking = false;
        start_time = null;
        end_time = null;
      } else {
        isWorking = true;
        start_time = ex.start_time || start_time;
        end_time = ex.end_time || end_time;
      }
      if (ex.zip) zip = ex.zip;
    }

    const hours = isWorking ? hoursBetween(start_time, end_time) : 0;

    days.push({
      service_date: iso,
      weekday,
      isWorking,
      start_time,
      end_time,
      zip,
      hours,
    });

    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  return days;
};

const validateWeeklyMinHours = days => {
  const byWeek = {};
  for (const d of days) {
    const wk = getWeekKeySun(d.service_date);
    byWeek[wk] = (byWeek[wk] || 0) + (d.hours || 0);
  }

  const failures = Object.entries(byWeek)
    .filter(([, hrs]) => hrs < 10)
    .map(([weekStart, hrs]) => ({ weekStart, hours: Number(hrs.toFixed(2)) }));

  return { ok: failures.length === 0, failures };
};

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const washerId = req.query.washerId;
      const month = req.query.month;

      if (!washerId || !month) {
        return res.status(400).json({ error: 'washerId and month (YYYY-MM) are required.' });
      }
      const parsed = parseMonth(month);
      if (!parsed) return res.status(400).json({ error: 'Invalid month. Use YYYY-MM.' });

      const startISO = toISODate(parsed.start);
      const endISO = toISODate(parsed.end);

      const { data: weekRows, error: weekErr } = await supabase
        .from('washer_default_week')
        .select('*')
        .eq('washer_id', washerId);

      if (weekErr) {
        return res.status(500).json({ error: 'default_week_query_failed', supabase: weekErr });
      }

      const { data: exRows, error: exErr } = await supabase
        .from('washer_schedule_exceptions')
        .select('*')
        .eq('washer_id', washerId)
        .gte('service_date', startISO)
        .lte('service_date', endISO);

      if (exErr) {
        return res.status(500).json({ error: 'exceptions_query_failed', supabase: exErr });
      }

      return res.json({
        washerId,
        month,
        defaultWeek: weekRows || [],
        exceptions: exRows || [],
      });
    }

    if (req.method === 'POST') {
      const { washerId, month, defaultZip, defaultWeek, exceptions } = req.body || {};
      if (!washerId || !month) {
        return res.status(400).json({ error: 'washerId and month are required.' });
      }

      const parsed = parseMonth(month);
      if (!parsed) return res.status(400).json({ error: 'Invalid month. Use YYYY-MM.' });

      const zipFallback = String(defaultZip || '').trim() || '00000';

      // Normalize defaultWeek to 7 rows (Sun..Sat), but we will ONLY upsert working days.
      const incomingWeek = Array.isArray(defaultWeek) ? defaultWeek : [];
      const normWeek7 = Array.from({ length: 7 }).map((_, wd) => {
        const row = incomingWeek.find(r => Number(r.weekday) === wd) || {};
        const is_working = !!row.is_working;

        const startNorm = normalizeTime(row.start_time);
        const endNorm = normalizeTime(row.end_time);

        return {
          washer_id: washerId,
          weekday: wd,
          is_working,
          // If is_working is true and times are missing, provide safe defaults.
          start_time: is_working ? (startNorm || '10:00:00') : null,
          end_time: is_working ? (endNorm || '15:00:00') : null,
          zip: String((row.zip || zipFallback)).trim() || zipFallback,
          updated_at: new Date().toISOString(),
        };
      });

      // Normalize exceptions
      const exArr = Array.isArray(exceptions) ? exceptions : [];
      const exRows = exArr
        .filter(x => x && x.service_date)
        .map(x => ({
          washer_id: washerId,
          service_date: x.service_date,
          is_day_off: !!x.is_day_off,
          start_time: x.is_day_off ? null : normalizeTime(x.start_time),
          end_time: x.is_day_off ? null : normalizeTime(x.end_time),
          zip: x.zip ? String(x.zip).trim() : null,
          approval_status: x.approval_status || 'approved',
          updated_at: new Date().toISOString(),
        }));

      const exMap = {};
      for (const r of exRows) exMap[r.service_date] = r;

      // Validate weekly minimum hours against the *effective* month plan
      const monthDays = computeMonthDays({
        monthStart: parsed.start,
        monthEnd: parsed.end,
        defaultWeek: normWeek7.map(r => ({
          weekday: r.weekday,
          is_working: r.is_working,
          start_time: r.start_time,
          end_time: r.end_time,
          zip: r.zip,
        })),
        exMap,
        defaultZip: zipFallback,
      });

      const v = validateWeeklyMinHours(monthDays);
      if (!v.ok) {
        return res.status(400).json({
          error: 'min_weekly_hours_failed',
          message: 'Schedule must include at least 10 hours per week.',
          failures: v.failures,
        });
      }

      // OPTION B: Keep washer_default_week as "only working days".
      // - Upsert only rows where is_working=true
      // - Delete any rows for weekdays that are now off
      const workingRows = normWeek7
        .filter(r => r.is_working)
        .map(r => ({
          washer_id: r.washer_id,
          weekday: r.weekday,
          start_time: r.start_time,
          end_time: r.end_time,
          zip: r.zip,
          is_working: true,
          updated_at: r.updated_at,
        }));

      const offWeekdays = normWeek7.filter(r => !r.is_working).map(r => r.weekday);

      if (workingRows.length > 0) {
        const { error: upWeekErr } = await supabase
          .from('washer_default_week')
          .upsert(workingRows, { onConflict: 'washer_id,weekday' });

        if (upWeekErr) {
          return res.status(500).json({ error: 'default_week_upsert_failed', supabase: upWeekErr });
        }
      }

      if (offWeekdays.length > 0) {
        const { error: delWeekErr } = await supabase
          .from('washer_default_week')
          .delete()
          .eq('washer_id', washerId)
          .in('weekday', offWeekdays);

        if (delWeekErr) {
          return res.status(500).json({ error: 'default_week_delete_failed', supabase: delWeekErr });
        }
      }

      // Save exceptions (upsert)
      if (exRows.length > 0) {
        const { error: upExErr } = await supabase
          .from('washer_schedule_exceptions')
          .upsert(exRows, { onConflict: 'washer_id,service_date' });

        if (upExErr) {
          return res.status(500).json({ error: 'exceptions_upsert_failed', supabase: upExErr });
        }
      }

      // Regenerate washer_availability for the month
      const startISO = toISODate(parsed.start);
      const endISO = toISODate(parsed.end);

      const { error: delAvailErr } = await supabase
        .from('washer_availability')
        .delete()
        .eq('washer_id', washerId)
        .gte('service_date', startISO)
        .lte('service_date', endISO);

      if (delAvailErr) {
        return res.status(500).json({ error: 'availability_delete_failed', supabase: delAvailErr });
      }

      const inserts = monthDays
        .filter(d => d.isWorking && d.start_time && d.end_time && d.zip)
        .map(d => ({
          washer_id: washerId,
          service_date: d.service_date,
          start_time: d.start_time,
          end_time: d.end_time,
          location: String(d.zip), // your column is "location" but holds ZIP
          max_bookings: 3,
          current_bookings: 0,
          status: 'open',
        }));

      if (inserts.length > 0) {
        const { error: insErr } = await supabase.from('washer_availability').insert(inserts);
        if (insErr) {
          return res.status(500).json({ error: 'availability_insert_failed', supabase: insErr });
        }
      }

      return res.json({ ok: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('Unhandled staffSchedule error:', e);
    return res.status(500).json({
      error: 'unhandled_exception',
      details: e.message || String(e),
    });
  }
};
