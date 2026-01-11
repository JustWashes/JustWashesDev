// src/containers/AdminPage/AdminPage.js

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { connect } from 'react-redux';
import { Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './AdminPage.module.css';

// Calendar deps
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import {
  format,
  parse,
  startOfWeek,
  getDay,
  startOfMonth,
  endOfMonth,
} from 'date-fns';
import enUS from 'date-fns/locale/en-US';

const API_BASE_URL =
  process.env.REACT_APP_DEV_API_BASE_URL || 'http://localhost:3500';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }), // Sunday
  getDay,
  locales,
});

const toISODate = d => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

const safeReadJson = async res => {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch (e) {
    return { json: null, text };
  }
};

const buildEventDate = (serviceDate, hhmmss) => {
  if (!serviceDate || !hhmmss) return null;
  const hhmm = String(hhmmss).slice(0, 5); // "HH:MM"
  const dt = new Date(`${serviceDate}T${hhmm}:00`);
  return Number.isNaN(dt.getTime()) ? null : dt;
};

const getMonthRange = anchorDate => {
  const anchor = new Date(anchorDate);
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  return {
    start,
    end,
    startDate: toISODate(start),
    endDate: toISODate(end),
  };
};

const AdminPage = props => {
  const { currentUser } = props;

  // TODO: later enforce admin role via currentUser.profile.publicData.role === 'admin'
  if (!currentUser) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  // -----------------------------
  // Create Wash Form state
  // -----------------------------
  const [form, setForm] = useState({
    sharetribe_user_id: '',
    scheduled_date: '',
    scheduled_time: '',
    location_id: '',
    vehicle_count: 1,
    washer_id: '',
    status: 'scheduled',
    special_instructions: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [resultMessage, setResultMessage] = useState(null);
  const [resultError, setResultError] = useState(null);

  // -----------------------------
  // Admin wash list
  // -----------------------------
  const [washes, setWashes] = useState([]);
  const [isLoadingWashes, setIsLoadingWashes] = useState(true);

  // -----------------------------
  // Availability (MONTH calendar)
  // -----------------------------
  const [monthAnchor, setMonthAnchor] = useState(new Date()); // calendar month
  const [zipOptions, setZipOptions] = useState(['38655', '30319']); // seed options; auto-extends when data returns
  const [selectedZip, setSelectedZip] = useState('38655');

  const [availabilityWindows, setAvailabilityWindows] = useState([]);
  const [isLoadingAvailability, setIsLoadingAvailability] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);

  // -----------------------------
  // Helpers
  // -----------------------------
  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: name === 'vehicle_count' ? Number(value || 0) : value,
    }));
  };

  const formatDateTime = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return (
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    );
  };

  const formatTime = dt => {
    if (!dt) return '';
    return dt.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // -----------------------------
  // Load washes
  // -----------------------------
  const loadWashes = async () => {
    try {
      setIsLoadingWashes(true);
      const res = await fetch(`${API_BASE_URL}/api/admin/washes?limit=100`, {
        credentials: 'include',
      });

      const { json, text } = await safeReadJson(res);

      if (!res.ok) {
        console.error('Failed to load washes:', json || text);
        setWashes([]);
        return;
      }

      setWashes(Array.isArray(json?.washes) ? json.washes : []);
    } catch (err) {
      console.error('Unexpected error loading washes:', err);
      setWashes([]);
    } finally {
      setIsLoadingWashes(false);
    }
  };

  useEffect(() => {
    loadWashes();
  }, []);

  // -----------------------------
  // Create wash submit
  // -----------------------------
  const handleSubmit = async e => {
    e.preventDefault();
    setSubmitting(true);
    setResultMessage(null);
    setResultError(null);

    try {
      const { scheduled_date, scheduled_time } = form;

      const scheduled_start =
        scheduled_date && scheduled_time
          ? new Date(`${scheduled_date}T${scheduled_time}:00`).toISOString()
          : null;

      const payload = {
        sharetribe_user_id: form.sharetribe_user_id.trim(),
        scheduled_start,
        location_id: form.location_id.trim(),
        vehicle_count: form.vehicle_count || 1,
        status: form.status || 'scheduled',
        washer_id: form.washer_id.trim() || null,
        special_instructions: form.special_instructions.trim() || null,
      };

      const res = await fetch(`${API_BASE_URL}/api/admin/washes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const { json, text } = await safeReadJson(res);

      if (!res.ok) {
        console.error('Admin create wash error:', json || text);
        setResultError(json?.details || json?.error || 'Failed to create wash.');
      } else {
        setResultMessage(`Wash created with id ${json?.wash?.id || '(unknown)'}`);
        loadWashes();

        setForm(prev => ({
          ...prev,
          scheduled_date: '',
          scheduled_time: '',
          vehicle_count: 1,
          washer_id: '',
          status: 'scheduled',
          special_instructions: '',
        }));
      }
    } catch (err) {
      console.error('Unexpected error creating wash:', err);
      setResultError(err.message || 'Unexpected error');
    } finally {
      setSubmitting(false);
    }
  };

  // -----------------------------
  // Load availability (MONTH) - auto runs
  // -----------------------------
  const loadAvailabilityMonth = useCallback(async () => {
    try {
      setIsLoadingAvailability(true);
      setAvailabilityError(null);
      setSelectedEvent(null);

      const zip = String(selectedZip || '').trim();
      if (!zip) {
        setAvailabilityWindows([]);
        setAvailabilityError('Select a ZIP to load availability.');
        return;
      }

      const { startDate, endDate } = getMonthRange(monthAnchor);

      const url = `${API_BASE_URL}/api/admin/availability?zip=${encodeURIComponent(
        zip
      )}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(
        endDate
      )}`;

      const res = await fetch(url, { credentials: 'include' });
      const { json, text } = await safeReadJson(res);

      if (!res.ok) {
        console.error('Failed to load admin availability:', json || text);
        throw new Error(
          json?.details ||
            json?.error ||
            `Failed to load admin availability (HTTP ${res.status})`
        );
      }

      const rows = Array.isArray(json?.availability) ? json.availability : [];
      setAvailabilityWindows(rows);

      // auto-extend dropdown options from returned rows
      const returnedZips = Array.from(
        new Set(
          rows
            .map(r => String(r.zip ?? r.location ?? '').trim())
            .filter(Boolean)
        )
      ).sort();

      if (returnedZips.length) {
        setZipOptions(prev => Array.from(new Set([...prev, ...returnedZips])).sort());
      }
    } catch (err) {
      setAvailabilityWindows([]);
      setAvailabilityError(err.message || 'Unexpected error loading availability');
    } finally {
      setIsLoadingAvailability(false);
    }
  }, [selectedZip, monthAnchor]);

  // auto-load whenever ZIP or month changes (no “Load availability” button)
  useEffect(() => {
    loadAvailabilityMonth();
  }, [loadAvailabilityMonth]);

  // -----------------------------
  // Derived: calendar events (month)
  // -----------------------------
  const events = useMemo(() => {
    return (availabilityWindows || [])
      .map(r => {
        const serviceDate = r.service_date || r.serviceDate;
        const start = buildEventDate(serviceDate, r.start_time || r.startTime);
        const end = buildEventDate(serviceDate, r.end_time || r.endTime);
        if (!start || !end) return null;

        const washerName =
          r.washer?.display_name ||
          r.washers?.display_name ||
          r.display_name ||
          r.washer_name ||
          'Washer';

        const phone =
          r.washer?.phone || r.washers?.phone || r.phone || r.washer_phone || '';

        const zip = String(r.zip ?? r.location ?? '').trim();

        const label = `${formatTime(start)}–${formatTime(end)} ${washerName}`;

        return {
          id: r.id,
          title: label,
          start,
          end,
          zip,
          washerId: r.washer?.id || r.washer_id,
          washerName,
          status: r.status,
          capacityCurrent: r.current_bookings,
          capacityMax: r.max_bookings,
          phone,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.start - b.start);
  }, [availabilityWindows]);

  // simple deterministic color per washer
  const eventPropGetter = event => {
    const key = String(event.washerId || event.washerName || event.title || '');
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    const hue = hash % 360;

    return {
      style: {
        backgroundColor: `hsl(${hue} 70% 45%)`,
        borderRadius: '10px',
        border: '0',
        color: 'white',
        padding: '2px 6px',
        fontWeight: 700,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    };
  };

  const onNavigateMonth = nextDate => {
    // react-big-calendar gives the new visible date; treat it as month anchor
    setMonthAnchor(nextDate);
  };

  const monthLabel = useMemo(() => {
    try {
      return new Date(monthAnchor).toLocaleDateString(undefined, {
        month: 'long',
        year: 'numeric',
      });
    } catch (e) {
      return '';
    }
  }, [monthAnchor]);

  const whoWorking = useMemo(() => {
    const counts = new Map();
    for (const ev of events) {
      const name = ev.washerName || 'Washer';
      counts.set(name, (counts.get(name) || 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [events]);

  return (
    <Page title="Admin | JustWashes">
      <TopbarContainer />

      <div className={css.pageBackground}>
        <div className={css.pageHeader}>
          <h1 className={css.title}>Admin control center</h1>
          <p className={css.subtitle}>
            Internal tools to manage clients, washers, and schedules. Create washes manually,
            review recent activity, and view washer availability by ZIP (month view).
          </p>
        </div>

        <div className={css.grid}>
          {/* Create wash */}
          <section className={css.card}>
            <h2 className={css.cardTitle}>Create wash manually</h2>
            <p className={css.cardSubtitle}>
              Insert a wash directly into the database. Useful for correcting issues,
              onboarding new clients, or testing flows.
            </p>

            <form className={css.form} onSubmit={handleSubmit}>
              <div className={css.formRow}>
                <label className={css.label}>
                  Sharetribe user ID (client)
                  <input
                    type="text"
                    name="sharetribe_user_id"
                    value={form.sharetribe_user_id}
                    onChange={handleChange}
                    className={css.input}
                    placeholder="e.g. 69508c11-bb1c-4cd9-9f22-57e662987f50"
                    required
                  />
                </label>
              </div>

              <div className={css.rowSplit}>
                <label className={css.label}>
                  Date
                  <input
                    type="date"
                    name="scheduled_date"
                    value={form.scheduled_date}
                    onChange={handleChange}
                    className={css.input}
                    required
                  />
                </label>
                <label className={css.label}>
                  Time
                  <input
                    type="time"
                    name="scheduled_time"
                    value={form.scheduled_time}
                    onChange={handleChange}
                    className={css.input}
                    required
                  />
                </label>
              </div>

              <div className={css.formRow}>
                <label className={css.label}>
                  Location label / ID
                  <input
                    type="text"
                    name="location_id"
                    value={form.location_id}
                    onChange={handleChange}
                    className={css.input}
                    placeholder="e.g. 3165 Leconte Ave"
                    required
                  />
                </label>
              </div>

              <div className={css.rowSplit}>
                <label className={css.label}>
                  Vehicle count
                  <input
                    type="number"
                    min="1"
                    max="6"
                    name="vehicle_count"
                    value={form.vehicle_count}
                    onChange={handleChange}
                    className={css.input}
                  />
                </label>

                <label className={css.label}>
                  Status
                  <select
                    name="status"
                    value={form.status}
                    onChange={handleChange}
                    className={css.input}
                  >
                    <option value="scheduled">scheduled</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                    <option value="no_show">no_show</option>
                  </select>
                </label>
              </div>

              <div className={css.formRow}>
                <label className={css.label}>
                  Washer ID (optional)
                  <input
                    type="text"
                    name="washer_id"
                    value={form.washer_id}
                    onChange={handleChange}
                    className={css.input}
                    placeholder="UUID from public.washers.id"
                  />
                </label>
              </div>

              <div className={css.formRow}>
                <label className={css.label}>
                  Special instructions (optional)
                  <textarea
                    name="special_instructions"
                    value={form.special_instructions}
                    onChange={handleChange}
                    className={`${css.input} ${css.textarea}`}
                    rows={3}
                    placeholder="Gate codes, parking notes, etc."
                  />
                </label>
              </div>

              {resultMessage && <div className={css.successBanner}>{resultMessage}</div>}
              {resultError && <div className={css.errorBanner}>{resultError}</div>}

              <button type="submit" className={css.primaryButton} disabled={submitting}>
                {submitting ? 'Creating wash…' : 'Create wash'}
              </button>
            </form>
          </section>

          {/* Recent washes */}
          <section className={css.card}>
            <h2 className={css.cardTitle}>Recent washes</h2>
            <p className={css.cardSubtitle}>
              Pulled directly from Supabase. Use this to verify admin changes and keep
              an eye on upcoming demand.
            </p>

            <div className={css.tableWrapper}>
              {isLoadingWashes ? (
                <div className={css.tableLoading}>Loading washes…</div>
              ) : washes.length === 0 ? (
                <div className={css.tableEmpty}>No washes found yet.</div>
              ) : (
                <table className={css.table}>
                  <thead>
                    <tr>
                      <th>Date &amp; time</th>
                      <th>Client (Sharetribe ID)</th>
                      <th>Washer ID</th>
                      <th>Location</th>
                      <th>Vehicles</th>
                      <th>Status</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {washes.map(wash => (
                      <tr key={wash.id}>
                        <td>{formatDateTime(wash.scheduled_start)}</td>
                        <td className={css.monoCell} title={wash.sharetribe_user_id || ''}>
                          {wash.sharetribe_user_id
                            ? `${wash.sharetribe_user_id.slice(0, 8)}…`
                            : '—'}
                        </td>
                        <td className={css.monoCell} title={wash.washer_id || ''}>
                          {wash.washer_id ? `${wash.washer_id.slice(0, 8)}…` : '—'}
                        </td>
                        <td>{wash.location_id || '—'}</td>
                        <td>{wash.vehicle_count ?? '—'}</td>
                        <td>
                          <span
                            className={
                              wash.status === 'scheduled'
                                ? css.statusChipScheduled
                                : wash.status === 'completed'
                                ? css.statusChipCompleted
                                : css.statusChipOther
                            }
                          >
                            {wash.status}
                          </span>
                        </td>
                        <td className={css.notesCell} title={wash.special_instructions || ''}>
                          {wash.special_instructions
                            ? wash.special_instructions.length > 40
                              ? `${wash.special_instructions.slice(0, 40)}…`
                              : wash.special_instructions
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Availability calendar (Month view) */}
          <section className={css.card} style={{ gridColumn: '1 / -1' }}>
            <h2 className={css.cardTitle}>Staff availability (month view)</h2>
            <p className={css.cardSubtitle}>
              Aggregate availability for all staff in a ZIP. Navigate months using the calendar header.
              Clicking a block shows details on the right.
            </p>

            <div className={css.rowSplit}>
              <label className={css.label}>
                ZIP
                <select
                  className={css.input}
                  value={selectedZip}
                  onChange={e => setSelectedZip(e.target.value)}
                >
                  {zipOptions.map(z => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
              </label>

              <div className={css.label} style={{ display: 'flex', alignItems: 'flex-end' }}>
                <div className={css.controlLabel} style={{ marginBottom: 10 }}>
                  Showing: <span className={css.monoCell}>{monthLabel}</span>
                  {isLoadingAvailability ? ' · loading…' : ''}
                </div>
              </div>
            </div>

            {availabilityError ? (
              <div className={css.errorBanner} style={{ marginBottom: 10 }}>
                {availabilityError}
              </div>
            ) : null}

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
              <div style={{ minHeight: 720 }}>
                <Calendar
                  localizer={localizer}
                  events={events}
                  defaultView={Views.MONTH}
                  views={[Views.MONTH, Views.DAY]}
                  popup={true}
                  toolbar={true}
                  onSelectEvent={evt => setSelectedEvent(evt)}
                  onNavigate={onNavigateMonth}
                  eventPropGetter={eventPropGetter}
                  style={{ height: 720, borderRadius: 12, overflow: 'hidden' }}
                />
              </div>

              <div>
                <h3 className={css.cardTitle} style={{ fontSize: 16 }}>
                  Details
                </h3>

                {selectedEvent ? (
                  <div className={css.detailBody}>
                    <div className={css.detailRow}>
                      <span className={css.detailLabel}>Washer</span>
                      <span className={css.detailValue}>{selectedEvent.washerName}</span>
                    </div>
                    <div className={css.detailRow}>
                      <span className={css.detailLabel}>ZIP</span>
                      <span className={css.detailValue}>{selectedEvent.zip}</span>
                    </div>
                    <div className={css.detailRow}>
                      <span className={css.detailLabel}>Date</span>
                      <span className={css.detailValue}>
                        {selectedEvent.start
                          ? selectedEvent.start.toLocaleDateString()
                          : '—'}
                      </span>
                    </div>
                    <div className={css.detailRow}>
                      <span className={css.detailLabel}>Time</span>
                      <span className={css.detailValue}>
                        {formatTime(selectedEvent.start)} – {formatTime(selectedEvent.end)}
                      </span>
                    </div>
                    <div className={css.detailRow}>
                      <span className={css.detailLabel}>Capacity</span>
                      <span className={css.detailValue}>
                        {typeof selectedEvent.capacityCurrent === 'number' &&
                        typeof selectedEvent.capacityMax === 'number'
                          ? `${selectedEvent.capacityCurrent}/${selectedEvent.capacityMax}`
                          : '—'}
                      </span>
                    </div>
                    {selectedEvent.phone ? (
                      <div className={css.detailRow}>
                        <span className={css.detailLabel}>Phone</span>
                        <span className={css.detailValue}>{selectedEvent.phone}</span>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className={css.emptyState}>Click an availability block to see details.</div>
                )}

                <div style={{ marginTop: 16 }}>
                  <h3 className={css.cardTitle} style={{ fontSize: 16 }}>
                    Who’s working this month
                  </h3>
                  {events.length === 0 ? (
                    <div className={css.tableEmpty}>
                      No availability found for ZIP <span className={css.monoCell}>{selectedZip}</span> in{' '}
                      <span className={css.monoCell}>{monthLabel}</span>.
                    </div>
                  ) : (
                    <div className={css.detailBody}>
                      {whoWorking.map(([name, count]) => (
                        <div key={name} className={css.detailRow}>
                          <span className={css.detailLabel}>{name}</span>
                          <span className={css.detailValue}>{count} block(s)</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 12 }} className={css.detailNote}>
                  Data source: <span className={css.monoCell}>GET /api/admin/availability</span> with{' '}
                  <span className={css.monoCell}>zip</span>, <span className={css.monoCell}>startDate</span>,{' '}
                  <span className={css.monoCell}>endDate</span> (month range).
                </div>
              </div>
            </div>
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

export default connect(mapStateToProps)(AdminPage);
