// src/containers/DashboardPage/DashboardPage.js

import React, { useState, useEffect, useMemo } from 'react';
import { connect } from 'react-redux';
import { Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './DashboardPage.module.css';

// Use dev API base (3500) - later move to env
const API_BASE_URL =
  process.env.REACT_APP_DEV_API_BASE_URL || 'http://localhost:3500';

const toISODate = d => {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toISOString().slice(0, 10);
};

// Friendly date/time helpers for clearer UI labels
const formatFriendlyDate = isoDate => {
  try {
    const d = new Date(`${isoDate}T00:00:00`);
    return d.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  } catch (e) {
    return isoDate;
  }
};

const formatTimeRange = (start, end) => {
  // Expect times like "HH:MM:SS". Show HH:MM–HH:MM in local-friendly form.
  try {
    const s = start.slice(0, 5);
    const e = end.slice(0, 5);
    return `${s}–${e}`;
  } catch (err) {
    return `${start}-${end}`;
  }
};

const monthRangeForISODate = isoDate => {
  const d = new Date(`${isoDate}T00:00:00`);
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: new Date(end.getTime() - 86400000).toISOString().slice(0, 10), // last day of month
  };
};

const safeReadJson = async res => {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch (e) {
    return { json: null, text };
  }
};

const DashboardPage = props => {
  const { currentUser } = props;

  // If user is not logged in via Sharetribe, send them to login / landing
  if (!currentUser) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }

  const [vehicleCount, setVehicleCount] = useState(1);
  const [cadence, setCadence] = useState('monthly');

  const [upcomingWashes, setUpcomingWashes] = useState([]);
  const [pastWashes, setPastWashes] = useState([]);
  const [selectedWash, setSelectedWash] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [credits, setCredits] = useState(null);

  // Booking widget state
  const [zip, setZip] = useState('38655'); // default; later pull from customer profile / most recent wash
  const [selectedDate, setSelectedDate] = useState('');
  const [monthSummary, setMonthSummary] = useState([]); // [{date, open_blocks}]
  const [daySlots, setDaySlots] = useState([]); // aggregated slots
  const [selectedSlotKey, setSelectedSlotKey] = useState(''); // "HH:MM:SS-HH:MM:SS"
  const [bookingMode, setBookingMode] = useState('auto'); // 'auto' | 'specific'
  const [selectedWasherId, setSelectedWasherId] = useState('');
  const [bookingBusy, setBookingBusy] = useState(false);
  const [bookingError, setBookingError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  const firstName =
    currentUser?.attributes?.profile?.firstName ||
    currentUser?.attributes?.profile?.displayName ||
    'there';

  const userId = currentUser?.id?.uuid || null;

  const creditsRemaining = typeof credits?.remaining === 'number' ? credits.remaining : null;
  const bookingDisabled = creditsRemaining !== null ? creditsRemaining <= 0 : false;

  const currentPlanLabel =
    `${vehicleCount} vehicle${vehicleCount > 1 ? 's' : ''} · ` +
    (cadence === 'weekly'
      ? 'Weekly washes'
      : cadence === 'biweekly'
      ? 'Every 2 weeks'
      : 'Monthly washes');

  // Load dashboard data from backend API (which talks to Supabase)
  const loadDashboard = async () => {
    try {
      const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
      const url = `${API_BASE_URL}/api/dashboard${qs}`;
      const res = await fetch(url, { credentials: 'include' });

      if (!res.ok) {
        setUpcomingWashes([]);
        setPastWashes([]);
        setIsLoading(false);
        return;
      }

      const json = await res.json();

      if (Array.isArray(json.upcoming)) setUpcomingWashes(json.upcoming);
      if (Array.isArray(json.past)) setPastWashes(json.past);
      if (json.credits) setCredits(json.credits);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
      setUpcomingWashes([]);
      setPastWashes([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    setIsLoading(true);
    loadDashboard();
  }, [currentUser]);

  // Month summary: load whenever ZIP or selectedDate’s month changes
  useEffect(() => {
    const run = async () => {
      try {
        setMonthSummary([]);
        if (!zip) return;

        // Use selectedDate month if set, otherwise "this month"
        const anchor = selectedDate ? selectedDate : toISODate(new Date());
        const { startDate, endDate } = monthRangeForISODate(anchor);

        const url = `${API_BASE_URL}/api/availability?zip=${encodeURIComponent(
          zip
        )}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;

        const res = await fetch(url, { credentials: 'include' });
        const { json, text } = await safeReadJson(res);

        if (!res.ok) {
          console.error('Month summary failed:', json || text);
          return;
        }

        const days = Array.isArray(json?.days) ? json.days : [];
        setMonthSummary(days);
      } catch (e) {
        console.error('Month summary unexpected error:', e);
      }
    };

    run();
  }, [zip, selectedDate]);

  const monthSummaryMap = useMemo(() => {
    const m = new Map();
    (monthSummary || []).forEach(d => {
      if (d?.date) m.set(d.date, d.open_blocks || 0);
    });
    return m;
  }, [monthSummary]);

  // Day slots: load when date changes
  useEffect(() => {
    const run = async () => {
      try {
        setDaySlots([]);
        setSelectedSlotKey('');
        setSelectedWasherId('');
        setBookingError(null);
        setBookingSuccess(null);

        if (!zip || !selectedDate) return;

        const url = `${API_BASE_URL}/api/availability?zip=${encodeURIComponent(
          zip
        )}&date=${encodeURIComponent(selectedDate)}`;

        const res = await fetch(url, { credentials: 'include' });
        const { json, text } = await safeReadJson(res);

        if (!res.ok) {
          console.error('Day availability failed:', json || text);
          setDaySlots([]);
          return;
        }

        setDaySlots(Array.isArray(json?.slots) ? json.slots : []);
      } catch (e) {
        console.error('Day availability unexpected error:', e);
        setDaySlots([]);
      }
    };

    run();
  }, [zip, selectedDate]);

  const selectedSlot = useMemo(() => {
    if (!selectedSlotKey) return null;
    return (daySlots || []).find(s => `${s.start_time}-${s.end_time}` === selectedSlotKey) || null;
  }, [daySlots, selectedSlotKey]);

  const canChooseTechnician = bookingMode === 'specific' && selectedSlot;

  const handleConfirmBooking = async () => {
    try {
      setBookingBusy(true);
      setBookingError(null);
      setBookingSuccess(null);

      if (bookingDisabled) {
        setBookingError('No credits remaining. Please upgrade your plan.');
        return;
      }

      if (!userId) {
        setBookingError('Missing user session. Please re-login.');
        return;
      }

      if (!zip || !selectedDate || !selectedSlot) {
        setBookingError('Select a date and time first.');
        return;
      }

      if (bookingMode === 'specific' && !selectedWasherId) {
        setBookingError('Select a technician.');
        return;
      }

      const payload = {
        sharetribe_user_id: userId,
        zip,
        service_date: selectedDate,
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        vehicle_count: vehicleCount || 1,
        mode: bookingMode === 'specific' ? 'specific' : 'auto',
        washer_id: bookingMode === 'specific' ? selectedWasherId : null,
      };

      const res = await fetch(`${API_BASE_URL}/api/bookings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      const { json, text } = await safeReadJson(res);

      if (!res.ok) {
        console.error('Booking failed:', json || text);
        setBookingError(json?.message || json?.details || json?.error || 'Booking failed.');
        return;
      }

      setBookingSuccess('Booked successfully. Your wash will appear under Upcoming washes.');
      // Refresh dashboard list
      await loadDashboard();

      // Reset selection but keep zip
      setSelectedSlotKey('');
      setSelectedWasherId('');
    } catch (e) {
      console.error('Confirm booking unexpected error:', e);
      setBookingError(e.message || 'Unexpected error booking wash.');
    } finally {
      setBookingBusy(false);
    }
  };

  // Small helper: show “available this month” chips (acts like “calendar info” without a full calendar lib)
  const availableDateChips = useMemo(() => {
    const items = (monthSummary || []).slice(0, 14); // keep UI tight
    return items;
  }, [monthSummary]);

  return (
    <Page title="Dashboard | JustWashes">
      <TopbarContainer />

      <div className={css.pageBackground}>
        {/* PAGE HEADER / HERO */}
        <div className={css.pageHeader}>
          <div className={css.headerLeft}>
            <p className={css.eyebrow}>Client dashboard</p>
            <h1 className={css.title}>Welcome back, {firstName} 👋</h1>
            <p className={css.subtitle}>
              Book new washes, manage your subscription, and stay on top of your wash
              schedule in one place.
            </p>
            <div className={css.planPill}>
              <span className={css.planLabel}>Current plan</span>
              <span className={css.planValue}>{currentPlanLabel}</span>
            </div>
          </div>

          <div className={css.headerRight}>
            <div className={css.statsCard}>
              <div className={css.statsRow}>
                <div>
                  <div className={css.statsLabel}>Upcoming washes</div>
                  <div className={css.statsValue}>{upcomingWashes.length}</div>
                </div>
                <div>
                  <div className={css.statsLabel}>Wash history</div>
                  <div className={css.statsValueMuted}>{pastWashes.length}</div>
                </div>
              </div>

              {/* Wash credits under the two primary stats */}
              <div className={css.statsCreditsRow}>
                <span className={css.statsLabel}>Wash credits:</span>
                {credits ? (
                  <span
                    className={
                      credits.remaining > 0
                        ? css.creditsChip
                        : css.creditsChipEmpty
                    }
                  >
                    {credits.remaining > 0
                      ? `${credits.remaining} remaining`
                      : 'No credits remaining'}
                  </span>
                ) : (
                  <span className={css.creditsChipMuted}>
                    Credits not configured yet
                  </span>
                )}
              </div>

              <div className={css.statsFooter}>
                Your next wash is just a few clicks away.
              </div>
            </div>
          </div>
        </div>

        <div className={css.grid}>
          {/* LEFT COLUMN – booking + subscription */}
          <div className={css.leftColumn}>
            {/* Booking */}
            <section className={`${css.card} ${css.cardAnimated}`}>
              <h2 className={css.cardTitle}>Book a wash</h2>
              <p className={css.cardSubtitle}>
                Your subscription credits apply automatically. Select a date and time
                to schedule.
              </p>

              {/* ZIP / Location (ZIP for now) */}
              <div className={css.controlGroup}>
                <div className={css.controlLabel}>Location (ZIP)</div>
                <input
                  type="text"
                  className={css.input}
                  value={zip}
                  onChange={e => setZip(e.target.value)}
                  disabled={bookingDisabled}
                />
              </div>

              {/* Date picker */}
              <div className={css.controlGroup}>
                <div className={css.controlLabel}>Date</div>
                <input
                  type="date"
                  className={css.input}
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  disabled={bookingDisabled}
                />
              </div>

              {/* “Calendar info” summary */}
              <div className={css.controlGroup}>
                <div className={css.controlLabel}>Availability this month</div>
                {availableDateChips.length === 0 ? (
                  <div className={css.emptyState}>
                    {zip ? 'No open availability found for this month yet.' : 'Enter a ZIP to see availability.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {availableDateChips.map(d => {
                      const label = formatFriendlyDate(d.date);
                      return (
                        <button
                          key={d.date}
                          type="button"
                          className={css.pillButton}
                          onClick={() => setSelectedDate(d.date)}
                          disabled={bookingDisabled}
                          title={`${d.open_blocks} block(s)`}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{label}</span>
                            <small style={{ fontSize: 11, opacity: 0.85 }}>{d.open_blocks} open</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Slots */}
              <div className={css.controlGroup}>
                <div className={css.controlLabel}>Available times</div>

                {selectedDate && (monthSummaryMap.get(selectedDate) || 0) === 0 ? (
                  <div className={css.emptyState}>
                    No availability for this date. Try a different day.
                  </div>
                ) : daySlots.length === 0 ? (
                  <div className={css.emptyState}>
                    {selectedDate ? 'No availability for this date. Try a different day.' : 'Select a date to see times.'}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {daySlots.map(slot => {
                      const key = `${slot.start_time}-${slot.end_time}`;
                      const active = key === selectedSlotKey;
                      const timeLabel = formatTimeRange(slot.start_time, slot.end_time);
                      const washerCount = Array.isArray(slot.washers) ? slot.washers.length : 0;
                      const sub = `${slot.total_capacity_remaining} spot(s)` + (washerCount ? ` · ${washerCount} tech${washerCount > 1 ? 's' : ''}` : '');

                      return (
                        <button
                          key={key}
                          type="button"
                          className={active ? css.pillButtonActive : css.pillButton}
                          onClick={() => {
                            setSelectedSlotKey(key);
                            setSelectedWasherId('');
                            setBookingError(null);
                            setBookingSuccess(null);
                          }}
                          disabled={bookingDisabled}
                          title={`${slot.total_capacity_remaining} spot(s) available${washerCount ? ` · ${washerCount} tech(s)` : ''}`}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <span style={{ fontWeight: 600 }}>{timeLabel}</span>
                            <small style={{ fontSize: 11, opacity: 0.85 }}>{sub}</small>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Booking mode */}
              <div className={css.controlGroup}>
                <div className={css.controlLabel}>Booking option</div>
                <div className={css.pillGroup}>
                  <button
                    type="button"
                    className={bookingMode === 'auto' ? css.pillButtonActive : css.pillButton}
                    onClick={() => {
                      setBookingMode('auto');
                      setSelectedWasherId('');
                    }}
                    disabled={bookingDisabled}
                  >
                    Book now
                  </button>
                  <button
                    type="button"
                    className={bookingMode === 'specific' ? css.pillButtonActive : css.pillButton}
                    onClick={() => setBookingMode('specific')}
                    disabled={bookingDisabled}
                  >
                    Book a specific technician
                  </button>
                </div>

                {bookingMode === 'auto' ? (
                  <div className={css.detailNote}>
                    “Book now” automatically assigns a technician fairly among active technicians in this ZIP.
                  </div>
                ) : (
                  <div className={css.detailNote}>
                    Choose a technician for the selected time slot.
                  </div>
                )}
              </div>

              {/* Technician dropdown (only if specific mode and slot selected) */}
              {canChooseTechnician ? (
                <div className={css.controlGroup}>
                  <div className={css.controlLabel}>Technician</div>
                  <select
                    className={css.input}
                    value={selectedWasherId}
                    onChange={e => setSelectedWasherId(e.target.value)}
                    disabled={bookingDisabled}
                  >
                    <option value="">Select a technician…</option>
                    {(selectedSlot?.washers || []).map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name || w.id.slice(0, 8)} {w.phone ? `(${w.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {/* No credits banner */}
              {bookingDisabled ? (
                <div className={css.errorBanner}>
                  No credits remaining. Upgrade your plan to book another wash.
                </div>
              ) : null}

              {bookingError ? <div className={css.errorBanner}>{bookingError}</div> : null}
              {bookingSuccess ? <div className={css.successBanner}>{bookingSuccess}</div> : null}

              <button
                type="button"
                className={css.primaryButton}
                onClick={handleConfirmBooking}
                disabled={bookingDisabled || bookingBusy || !selectedDate || !selectedSlotKey}
              >
                {bookingBusy ? 'Booking…' : 'Confirm booking'}
              </button>
            </section>

            {/* Subscription controls */}
            <section className={`${css.card} ${css.cardAnimated} ${css.cardDelayed}`}>
              <h2 className={css.cardTitle}>Subscription settings</h2>
              <p className={css.cardSubtitle}>
                Change how many vehicles are covered and how often you receive washes.
              </p>

              <div className={css.controlGroup}>
                <div className={css.controlLabel}>Number of vehicles</div>
                <div className={css.pillGroup}>
                  {[1, 2, 3, 4].map(count => (
                    <button
                      key={count}
                      type="button"
                      className={
                        count === vehicleCount
                          ? css.pillButtonActive
                          : css.pillButton
                      }
                      onClick={() => setVehicleCount(count)}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>

              <div className={css.controlGroup}>
                <div className={css.controlLabel}>Wash cadence</div>
                <div className={css.pillGroup}>
                  {['weekly', 'biweekly', 'monthly'].map(option => (
                    <button
                      key={option}
                      type="button"
                      className={
                        option === cadence ? css.pillButtonActive : css.pillButton
                      }
                      onClick={() => setCadence(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className={css.subscriptionSummary}>
                <div>
                  <div className={css.summaryLabel}>Current plan</div>
                  <div className={css.summaryValue}>
                    {credits?.planLabel || currentPlanLabel}
                  </div>

                  <div className={css.creditsRow}>
                    {credits ? (
                      <span
                        className={
                          credits.remaining > 0
                            ? css.creditsChip
                            : css.creditsChipEmpty
                        }
                      >
                        {credits.remaining > 0
                          ? `${credits.remaining} wash credit${
                              credits.remaining === 1 ? '' : 's'
                            } remaining`
                          : 'No credits remaining'}
                      </span>
                    ) : (
                      <span className={css.creditsChipMuted}>
                        Credits not configured yet
                      </span>
                    )}
                  </div>
                </div>
                <button type="button" className={css.secondaryButton}>
                  Save changes
                </button>
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN – upcoming/past/detail */}
          <div className={css.rightColumn}>
            {/* Upcoming washes */}
            <section className={`${css.card} ${css.cardAnimated}`}>
              <h2 className={css.cardTitle}>Upcoming washes</h2>
              <p className={css.cardSubtitle}>
                Select a wash to see details, reschedule, or cancel. Cancellations
                inside 24 hours may incur a $20 fee.
              </p>

              {isLoading ? (
                <div className={css.loadingShimmer}>
                  <div className={css.loadingBar} />
                  <div className={css.loadingBar} />
                </div>
              ) : upcomingWashes.length === 0 ? (
                <div className={css.emptyState}>
                  No upcoming washes. Use the calendar to book your next wash.
                </div>
              ) : (
                upcomingWashes.map(wash => (
                  <button
                    key={wash.id}
                    type="button"
                    className={`${css.listRow} ${
                      selectedWash?.id === wash.id ? css.listRowActive : ''
                    }`}
                    onClick={() => setSelectedWash(wash)}
                  >
                    <div className={css.listRowLeft}>
                      <div className={css.listPrimary}>
                        {wash.date} · {wash.time}
                      </div>
                      <div className={css.listSecondary}>
                        {wash.location} · {wash.vehicleCount} vehicle
                        {wash.vehicleCount > 1 ? 's' : ''}
                      </div>
                    </div>
                    <div className={css.listRowRight}>
                      <span
                        className={
                          wash.status === 'completed'
                            ? css.chipMuted
                            : css.chipSuccess
                        }
                      >
                        {wash.status}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </section>

            {/* Past washes */}
            <section className={`${css.card} ${css.cardAnimated} ${css.cardDelayed}`}>
              <h2 className={css.cardTitle}>Past washes</h2>
              {isLoading ? (
                <div className={css.loadingShimmer}>
                  <div className={css.loadingBar} />
                  <div className={css.loadingBar} />
                </div>
              ) : pastWashes.length === 0 ? (
                <div className={css.emptyState}>No wash history yet.</div>
              ) : (
                pastWashes.map(wash => (
                  <button
                    key={wash.id}
                    type="button"
                    className={`${css.listRow} ${
                      selectedWash?.id === wash.id ? css.listRowActive : ''
                    }`}
                    onClick={() => setSelectedWash(wash)}
                  >
                    <div className={css.listRowLeft}>
                      <div className={css.listPrimary}>
                        {wash.date} · {wash.time}
                      </div>
                      <div className={css.listSecondary}>
                        {wash.location} · Washer: {wash.washerName}
                      </div>
                    </div>
                    <div className={css.listRowRight}>
                      <span className={css.chipMuted}>{wash.status}</span>
                    </div>
                  </button>
                ))
              )}
            </section>

            {/* Details */}
            <section className={`${css.card} ${css.cardAnimated}`}>
              <h2 className={css.cardTitle}>Wash details</h2>
              {selectedWash ? (
                <div className={css.detailBody}>
                  <div className={css.detailRow}>
                    <span className={css.detailLabel}>Date & time</span>
                    <span className={css.detailValue}>
                      {selectedWash.date} · {selectedWash.time}
                    </span>
                  </div>
                  <div className={css.detailRow}>
                    <span className={css.detailLabel}>Location</span>
                    <span className={css.detailValue}>
                      {selectedWash.location}
                    </span>
                  </div>
                  <div className={css.detailRow}>
                    <span className={css.detailLabel}>Technician</span>
                    <span className={css.detailValue}>
                      {selectedWash.washerName || 'Assigned technician'}
                    </span>
                  </div>
                  {selectedWash.washerPhone && (
                    <div className={css.detailRow}>
                      <span className={css.detailLabel}>Technician contact</span>
                      <span className={css.detailValue}>
                        {selectedWash.washerPhone}
                      </span>
                    </div>
                  )}
                  <div className={css.detailRow}>
                    <span className={css.detailLabel}>Vehicles</span>
                    <span className={css.detailValue}>
                      {selectedWash.vehicleCount} vehicle
                      {selectedWash.vehicleCount > 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className={css.detailActions}>
                    <button type="button" className={css.secondaryButton}>
                      Reschedule
                    </button>
                    <button type="button" className={css.dangerButton}>
                      Cancel wash
                    </button>
                  </div>

                  <p className={css.detailNote}>
                    Customers are unable to cancel within 24 hours of the wash unless
                    they pay the $20 cancellation fee. This enforcement will live on
                    the server.
                  </p>
                </div>
              ) : (
                <div className={css.emptyState}>
                  Select an upcoming or past wash to see details.
                </div>
              )}
            </section>
          </div>
        </div>
      </div>

      <FooterContainer />
    </Page>
  );
};

const mapStateToProps = state => ({
  currentUser: state.user?.currentUser,
});

export default connect(mapStateToProps)(DashboardPage);
