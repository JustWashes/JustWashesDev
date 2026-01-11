// src/containers/StaffSchedulePage/StaffSchedulePage.js
import React, { useEffect, useMemo, useState } from 'react';
import { connect } from 'react-redux';
import { Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './StaffSchedulePage.module.css';

import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';

const API_BASE_URL =
  process.env.REACT_APP_DEV_API_BASE_URL || 'http://localhost:3500';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const toISODate = d => {
  const dt = new Date(d);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
};

const monthKeyFromDate = d => {
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
};

const daysInMonth = monthStr => {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(y, m - 1, 1);
  const end = new Date(y, m, 0);
  const arr = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    arr.push(new Date(d));
  }
  return { start, end, days: arr };
};

const getWeekStartKey = dateObj => {
  const d = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate());
  const day = d.getDay(); // 0 Sun
  const wk = new Date(d);
  wk.setDate(d.getDate() - day);
  return toISODate(wk);
};

const hoursBetween = (s, e) => {
  const ss = String(s || '').slice(0, 5);
  const ee = String(e || '').slice(0, 5);
  const [sh, sm] = ss.split(':').map(Number);
  const [eh, em] = ee.split(':').map(Number);
  if ([sh, sm, eh, em].some(n => Number.isNaN(n))) return 0;
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return Math.max(0, mins) / 60;
};

const safeReadJson = async res => {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
};

const weekdayLabel = wd => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][wd];

const StaffSchedulePage = props => {
  const { currentUser } = props;

  if (!currentUser) {
    if (typeof window !== 'undefined') window.location.href = '/login';
    return null;
  }

  // For MVP: use washer_id from publicData or manual input
  const washerIdFromProfile =
    currentUser?.attributes?.profile?.publicData?.washer_id || '';

  const [washerId, setWasherId] = useState(washerIdFromProfile);

  const [anchorDate, setAnchorDate] = useState(new Date());
  const [month, setMonth] = useState(monthKeyFromDate(new Date()));

  const [defaultZip, setDefaultZip] = useState('38655');

  // Week template (Sun..Sat)
  const [weekTemplate, setWeekTemplate] = useState(
    Array.from({ length: 7 }).map((_, wd) => ({
      weekday: wd,
      is_working: false,
      start_time: '10:00',
      end_time: '15:00',
      zip: '38655',
    }))
  );

  // Per-date overrides: { 'YYYY-MM-DD': { is_day_off, start_time, end_time, zip, approval_status } }
  const [overrides, setOverrides] = useState({});

  const [selectedDateISO, setSelectedDateISO] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [okMsg, setOkMsg] = useState(null);

  useEffect(() => {
    setMonth(monthKeyFromDate(anchorDate));
  }, [anchorDate]);

  // Keep template ZIPs filled (doesn't override if already set)
  useEffect(() => {
    setWeekTemplate(prev =>
      prev.map(r => ({
        ...r,
        zip: (r.zip && String(r.zip).trim()) ? r.zip : defaultZip,
      }))
    );
  }, [defaultZip]);

  const { days: monthDays } = useMemo(() => daysInMonth(month), [month]);

  const computeMonthPlan = () => {
    return monthDays.map(d => {
      const iso = toISODate(d);
      const wd = d.getDay(); // 0..6 local
      const base = weekTemplate.find(x => x.weekday === wd) || null;
      const ov = overrides[iso] || null;

      let isWorking = base?.is_working || false;
      let start_time = base?.start_time || null;
      let end_time = base?.end_time || null;
      let zip = base?.zip || defaultZip;

      if (ov) {
        if (ov.is_day_off) {
          isWorking = false;
          start_time = null;
          end_time = null;
        } else {
          isWorking = true;
          start_time = ov.start_time || start_time;
          end_time = ov.end_time || end_time;
        }
        if (ov.zip) zip = ov.zip;
      }

      const hours = isWorking ? hoursBetween(start_time, end_time) : 0;

      return { service_date: iso, isWorking, start_time, end_time, zip, hours, weekday: wd };
    });
  };

  const monthPlan = useMemo(
    () => computeMonthPlan(),
    [month, weekTemplate, overrides, defaultZip]
  );

  const weeklyHours = useMemo(() => {
    const map = {};
    monthPlan.forEach(p => {
      const wk = getWeekStartKey(new Date(p.service_date + 'T00:00:00'));
      map[wk] = (map[wk] || 0) + (p.hours || 0);
    });
    return map;
  }, [monthPlan]);

  const weeklyFailures = useMemo(() => {
    return Object.entries(weeklyHours)
      .filter(([, hrs]) => hrs < 10)
      .map(([wk, hrs]) => ({ weekStart: wk, hours: Number(hrs.toFixed(2)) }));
  }, [weeklyHours]);

  const calendarEvents = useMemo(() => {
    // Render working days as blocks in month view (all-day)
    return monthPlan
      .filter(p => p.isWorking)
      .map(p => ({
        id: p.service_date,
        title: `${p.start_time}-${p.end_time} · ${p.zip}`,
        start: new Date(p.service_date + 'T00:00:00'),
        end: new Date(p.service_date + 'T23:59:59'),
        allDay: true,
        zip: p.zip,
      }));
  }, [monthPlan]);

  const loadFromServer = async () => {
    setErrorMsg(null);
    setOkMsg(null);

    if (!washerId) {
      setErrorMsg('Washer ID is required (public.washers.id).');
      return;
    }

    setLoading(true);
    try {
      const url = `${API_BASE_URL}/api/staff/schedule?washerId=${encodeURIComponent(
        washerId
      )}&month=${encodeURIComponent(month)}`;

      const res = await fetch(url, { credentials: 'include' });
      const { json, text } = await safeReadJson(res);

      if (!res.ok) {
        throw new Error(
          json?.error ||
            `Failed to load schedule (HTTP ${res.status}): ${text.slice(0, 120)}`
        );
      }

      const serverWeek = Array.isArray(json?.defaultWeek) ? json.defaultWeek : [];
      const serverEx = Array.isArray(json?.exceptions) ? json.exceptions : [];

      // Server uses Option B: it may only store working weekdays.
      const nextWeek = Array.from({ length: 7 }).map((_, wd) => {
        const row = serverWeek.find(r => Number(r.weekday) === wd) || null;
        return {
          weekday: wd,
          is_working: !!row,
          start_time: row?.start_time ? String(row.start_time).slice(0, 5) : '10:00',
          end_time: row?.end_time ? String(row.end_time).slice(0, 5) : '15:00',
          zip: row?.zip || defaultZip,
        };
      });
      setWeekTemplate(nextWeek);

      const nextOverrides = {};
      serverEx.forEach(r => {
        nextOverrides[r.service_date] = {
          is_day_off: !!r.is_day_off,
          start_time: r.start_time ? String(r.start_time).slice(0, 5) : '',
          end_time: r.end_time ? String(r.end_time).slice(0, 5) : '',
          zip: r.zip || '',
          approval_status: r.approval_status || 'approved',
        };
      });
      setOverrides(nextOverrides);

      setOkMsg('Loaded schedule.');
    } catch (e) {
      setErrorMsg(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const applyTemplateToMonth = () => {
    setOkMsg('Template applied to month (base schedule updated). You can still override specific days.');
    setErrorMsg(null);
  };

  const setTemplateDay = (weekday, patch) => {
    setWeekTemplate(prev => prev.map(r => (r.weekday === weekday ? { ...r, ...patch } : r)));
  };

  const setOverrideForDate = (dateISO, patch) => {
    setOverrides(prev => ({
      ...prev,
      [dateISO]: {
        ...(prev[dateISO] || { is_day_off: false, start_time: '', end_time: '', zip: '', approval_status: 'approved' }),
        ...patch,
      },
    }));
  };

  const clearOverrideForDate = dateISO => {
    setOverrides(prev => {
      const next = { ...prev };
      delete next[dateISO];
      return next;
    });
  };

  const saveSchedule = async () => {
    setErrorMsg(null);
    setOkMsg(null);

    if (!washerId) {
      setErrorMsg('Washer ID is required.');
      return;
    }

    if (weeklyFailures.length > 0) {
      setErrorMsg('Cannot save: schedule has weeks under 10 hours. Fix the red weeks first.');
      return;
    }

    setSaveLoading(true);
    try {
      const exceptionsArr = Object.entries(overrides).map(([service_date, o]) => ({
        service_date,
        is_day_off: !!o.is_day_off,
        start_time: o.is_day_off ? null : (o.start_time || null),
        end_time: o.is_day_off ? null : (o.end_time || null),
        zip: o.zip || null,
        approval_status: o.approval_status || 'approved',
      }));

      const payload = {
        washerId,
        month,
        defaultZip,
        defaultWeek: weekTemplate,
        exceptions: exceptionsArr,
      };

      const res = await fetch(`${API_BASE_URL}/api/staff/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const { json, text } = await safeReadJson(res);
      if (!res.ok) {
        const failures = json?.failures;
        if (Array.isArray(failures) && failures.length > 0) {
          throw new Error(
            `Server rejected: < 10 hours/week. Failures: ${failures
              .map(f => `${f.weekStart}=${f.hours}h`)
              .join(', ')}`
          );
        }
        throw new Error(json?.error || `Save failed (HTTP ${res.status}): ${text.slice(0, 160)}`);
      }

      setOkMsg('Saved schedule and regenerated availability for this month.');
    } catch (e) {
      setErrorMsg(e.message || String(e));
    } finally {
      setSaveLoading(false);
    }
  };

  const selectedPlan = selectedDateISO ? monthPlan.find(p => p.service_date === selectedDateISO) : null;
  const selectedOverride = selectedDateISO ? overrides[selectedDateISO] || null : null;

  return (
    <Page title="Staff Schedule | JustWashes">
      <TopbarContainer />

      <div className={css.pageBackground}>
        <div className={css.pageHeader}>
          <h1 className={css.title}>Staff scheduling</h1>
          <p className={css.subtitle}>
            Set your default weekly pattern, apply it to the month, and override any day. Minimum 10 hours per week.
          </p>
        </div>

        <div className={css.grid}>
          {/* Left: Calendar */}
          <section className={css.card} style={{ gridColumn: '1 / span 2' }}>
            <div className={css.rowSplit}>
              <label className={css.label}>
                Washer ID (public.washers.id)
                <input
                  className={css.input}
                  value={washerId}
                  onChange={e => setWasherId(e.target.value)}
                  placeholder="e.g. 691f83cf-ab51-491f-9141-f9be70dbe69b"
                />
              </label>
              <label className={css.label}>
                Default ZIP
                <input
                  className={css.input}
                  value={defaultZip}
                  onChange={e => setDefaultZip(e.target.value)}
                  placeholder="e.g. 38655"
                />
              </label>
            </div>

            <div className={css.rowSplit}>
              <button type="button" className={css.secondaryButton} onClick={loadFromServer} disabled={loading}>
                {loading ? 'Loading…' : 'Load saved schedule'}
              </button>
              <button type="button" className={css.secondaryButton} onClick={applyTemplateToMonth}>
                Apply week template to month
              </button>
              <button type="button" className={css.primaryButton} onClick={saveSchedule} disabled={saveLoading}>
                {saveLoading ? 'Saving…' : 'Save month schedule'}
              </button>
            </div>

            {errorMsg ? <div className={css.errorBanner}>{errorMsg}</div> : null}
            {okMsg ? <div className={css.successBanner}>{okMsg}</div> : null}

            {weeklyFailures.length > 0 ? (
              <div className={css.errorBanner}>
                Weeks below 10 hours:{' '}
                {weeklyFailures.map(f => `${f.weekStart} (${f.hours}h)`).join(', ')}
              </div>
            ) : (
              <div className={css.successBanner}>Weekly minimum satisfied (≥ 10 hours/week).</div>
            )}

            <div style={{ height: 680, marginTop: 10 }}>
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                view={Views.MONTH}
                views={[Views.MONTH]}
                date={anchorDate}
                onNavigate={d => setAnchorDate(d)}
                selectable
                onSelectSlot={slot => {
                  const d = slot?.start;
                  if (d) setSelectedDateISO(toISODate(d));
                }}
                onSelectEvent={evt => {
                  if (evt?.id) setSelectedDateISO(evt.id);
                }}
              />
            </div>

            <div className={css.detailNote}>
              Click a day to edit. Blue blocks show working days; empty days are off.
            </div>
          </section>

          {/* Right top: Week template */}
          <section className={css.card}>
            <h2 className={css.cardTitle}>Week template</h2>
            <p className={css.cardSubtitle}>
              Set your “typical week” first. This is the default pattern applied across the month.
            </p>

            {weekTemplate.map(row => (
              <div key={row.weekday} className={css.templateRow}>
                <div className={css.templateDay}>{weekdayLabel(row.weekday)}</div>

                <label className={css.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={!!row.is_working}
                    onChange={e => setTemplateDay(row.weekday, { is_working: e.target.checked })}
                  />
                  Working
                </label>

                <input
                  className={css.input}
                  type="time"
                  value={row.start_time || '10:00'}
                  disabled={!row.is_working}
                  onChange={e => setTemplateDay(row.weekday, { start_time: e.target.value })}
                />
                <input
                  className={css.input}
                  type="time"
                  value={row.end_time || '15:00'}
                  disabled={!row.is_working}
                  onChange={e => setTemplateDay(row.weekday, { end_time: e.target.value })}
                />
                <input
                  className={css.input}
                  type="text"
                  value={row.zip || defaultZip}
                  disabled={!row.is_working}
                  onChange={e => setTemplateDay(row.weekday, { zip: e.target.value })}
                  placeholder="ZIP"
                />
              </div>
            ))}
          </section>

          {/* Right bottom: Selected day override */}
          <section className={css.card}>
            <h2 className={css.cardTitle}>Selected day</h2>
            {!selectedDateISO ? (
              <div className={css.emptyState}>Click a day in the calendar to edit.</div>
            ) : (
              <>
                <div className={css.detailRow}>
                  <span className={css.detailLabel}>Date</span>
                  <span className={css.detailValue}>{selectedDateISO}</span>
                </div>

                <div className={css.detailRow}>
                  <span className={css.detailLabel}>Default</span>
                  <span className={css.detailValue}>
                    {selectedPlan?.isWorking
                      ? `${selectedPlan.start_time}-${selectedPlan.end_time} · ${selectedPlan.zip}`
                      : 'Off'}
                  </span>
                </div>

                <div className={css.rowSplit}>
                  <button
                    type="button"
                    className={css.secondaryButton}
                    onClick={() =>
                      setOverrideForDate(selectedDateISO, {
                        is_day_off: true,
                        start_time: '',
                        end_time: '',
                      })
                    }
                  >
                    Mark day off
                  </button>
                  <button
                    type="button"
                    className={css.secondaryButton}
                    onClick={() => clearOverrideForDate(selectedDateISO)}
                  >
                    Clear override
                  </button>
                </div>

                <div className={css.formRow} style={{ marginTop: 10 }}>
                  <label className={css.label}>
                    Custom start
                    <input
                      className={css.input}
                      type="time"
                      value={(selectedOverride?.start_time || selectedPlan?.start_time || '10:00')}
                      disabled={!!selectedOverride?.is_day_off}
                      onChange={e =>
                        setOverrideForDate(selectedDateISO, {
                          is_day_off: false,
                          start_time: e.target.value,
                        })
                      }
                    />
                  </label>
                  <label className={css.label}>
                    Custom end
                    <input
                      className={css.input}
                      type="time"
                      value={(selectedOverride?.end_time || selectedPlan?.end_time || '15:00')}
                      disabled={!!selectedOverride?.is_day_off}
                      onChange={e =>
                        setOverrideForDate(selectedDateISO, {
                          is_day_off: false,
                          end_time: e.target.value,
                        })
                      }
                    />
                  </label>
                </div>

                <div className={css.formRow}>
                  <label className={css.label}>
                    Custom ZIP (optional)
                    <input
                      className={css.input}
                      type="text"
                      value={(selectedOverride?.zip || selectedPlan?.zip || '')}
                      disabled={!!selectedOverride?.is_day_off}
                      onChange={e => setOverrideForDate(selectedDateISO, { zip: e.target.value })}
                      placeholder="ZIP"
                    />
                  </label>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <FooterContainer />
    </Page>
  );
};

const mapStateToProps = state => ({
  currentUser: state.user?.currentUser,
});

export default connect(mapStateToProps)(StaffSchedulePage);
