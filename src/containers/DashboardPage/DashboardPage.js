// src/containers/DashboardPage/DashboardPage.js

import React, { useState, useEffect } from 'react';
import { connect } from 'react-redux';
import { Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './DashboardPage.module.css';

// Use dev API base (3500) - later move to env
const API_BASE_URL =
  process.env.REACT_APP_DEV_API_BASE_URL || 'http://localhost:3500';

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

  const firstName =
    currentUser?.attributes?.profile?.firstName ||
    currentUser?.attributes?.profile?.displayName ||
    'there';

  // Load dashboard data from backend API (which talks to Supabase)
  useEffect(() => {
    const loadData = async () => {
      try {
        const userId = currentUser?.id?.uuid;
        const qs = userId ? `?userId=${encodeURIComponent(userId)}` : '';
        const url = `${API_BASE_URL}/api/dashboard${qs}`;
        console.log('Fetching dashboard data from:', url);

        const res = await fetch(url, {
          credentials: 'include',
        });

        console.log('Dashboard response status:', res.status);

        if (!res.ok) {
          setUpcomingWashes([]);
          setPastWashes([]);
          setIsLoading(false);
          return;
        }

        const json = await res.json();
        console.log('Dashboard data:', json);

        if (Array.isArray(json.upcoming)) {
          setUpcomingWashes(json.upcoming);
        }
        if (Array.isArray(json.past)) {
          setPastWashes(json.past);
        }
        if (json.credits) {
          setCredits(json.credits);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
        setUpcomingWashes([]);
        setPastWashes([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [currentUser]);

  const currentPlanLabel =
    `${vehicleCount} vehicle${vehicleCount > 1 ? 's' : ''} · ` +
    (cadence === 'weekly'
      ? 'Weekly washes'
      : cadence === 'biweekly'
      ? 'Every 2 weeks'
      : 'Monthly washes');

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

              <div className={css.calendarPlaceholder}>
                <div className={css.calendarSkeleton}>
                  <div className={css.calendarHeader}>
                    <span>June 2025</span>
                    <span className={css.calendarDots}>···</span>
                  </div>
                  <div className={css.calendarGrid}>
                    {[...Array(14)].map((_, idx) => (
                      <div key={idx} className={css.calendarDay} />
                    ))}
                  </div>
                </div>
              </div>

              <button type="button" className={css.primaryButton}>
                Confirm booking
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
                inside 24 hours may incur a $25 fee.
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
                    <span className={css.detailLabel}>Washer</span>
                    <span className={css.detailValue}>
                      {selectedWash.washerName || 'Assigned washer'}
                    </span>
                  </div>
                  {selectedWash.washerPhone && (
                    <div className={css.detailRow}>
                      <span className={css.detailLabel}>Washer contact</span>
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
                    they pay the $25 cancellation fee. This enforcement will live on
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
