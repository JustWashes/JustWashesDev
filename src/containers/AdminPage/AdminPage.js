// src/containers/AdminPage/AdminPage.js

import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './AdminPage.module.css';

const API_BASE_URL =
  process.env.REACT_APP_DEV_API_BASE_URL || 'http://localhost:3500';

const AdminPage = props => {
  const { currentUser } = props;

  // TODO: later enforce admin role via currentUser.profile.publicData.role === 'admin'
  if (!currentUser) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  // Form state for creating a wash
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

  // Admin wash list
  const [washes, setWashes] = useState([]);
  const [isLoadingWashes, setIsLoadingWashes] = useState(true);

  const handleChange = e => {
    const { name, value } = e.target;
    setForm(prev => ({
      ...prev,
      [name]:
        name === 'vehicle_count'
          ? Number(value || 0)
          : value,
    }));
  };

const loadWashes = async () => {
  try {
    setIsLoadingWashes(true);
    const res = await fetch(`${API_BASE_URL}/api/admin/washes?limit=100`, {
      credentials: 'include',
    });
    const json = await res.json();
    if (!res.ok) {
      console.error('Failed to load washes:', json);
      setWashes([]);
      return;
    }
    setWashes(Array.isArray(json.washes) ? json.washes : []);
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
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        console.error('Admin create wash error:', json);
        setResultError(json.details || json.error || 'Failed to create wash.');
      } else {
        setResultMessage(`Wash created with id ${json.wash.id}`);

        // Refresh the wash list so it appears immediately
        loadWashes();

        // Reset most fields but keep user id & location to speed up multiple entries
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

  const formatDateTime = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return (
      d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) +
      ' · ' +
      d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    );
  };

  return (
    <Page title="Admin | JustWashes">
      <TopbarContainer />

      <div className={css.pageBackground}>
        <div className={css.pageHeader}>
          <h1 className={css.title}>Admin control center</h1>
          <p className={css.subtitle}>
            Internal tools to manage clients, washers, and schedules. For now, you can
            create washes manually and review recent activity from Supabase.
          </p>
        </div>

        <div className={css.grid}>
          {/* Left: create wash form */}
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
                    placeholder="e.g. Campus West, Brookhaven..."
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
                    placeholder="Internal washer ID or Sharetribe ID"
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

              {resultMessage && (
                <div className={css.successBanner}>{resultMessage}</div>
              )}
              {resultError && <div className={css.errorBanner}>{resultError}</div>}

              <button
                type="submit"
                className={css.primaryButton}
                disabled={submitting}
              >
                {submitting ? 'Creating wash…' : 'Create wash'}
              </button>
            </form>
          </section>

          {/* Right: recent washes table */}
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
                            <td
                            className={css.notesCell}
                            title={wash.special_instructions || ''}
                            >
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
