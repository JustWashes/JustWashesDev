// src/containers/DashboardPage/DashboardPage.js

import React, { useState } from 'react';
import { connect } from 'react-redux';
import { Page } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';

import css from './DashboardPage.module.css';

// Mock data for now – we’ll replace this with Supabase later
const mockUpcomingWashes = [
  {
    id: 1,
    date: 'Dec 27',
    time: '3:00 PM',
    location: 'Campus West',
    washerName: 'Alex Rivera',
    washerPhone: '(555) 123-4567',
    status: 'Scheduled',
    vehicleCount: 1,
  },
];

const mockPastWashes = [
  {
    id: 2,
    date: 'Dec 20',
    time: '4:30 PM',
    location: 'The Hub',
    washerName: 'Taylor Smith',
    status: 'Completed',
    vehicleCount: 1,
  },
];

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
  const [cadence, setCadence] = useState('monthly'); // weekly | biweekly | monthly
  const [selectedWash, setSelectedWash] = useState(null);

  return (
    <Page title="Dashboard | JustWashes">
      <TopbarContainer />

      {/* PAGE HEADER */}
      <div className={css.pageHeader}>
        <h1 className={css.title}>Dashboard</h1>
        <p className={css.subtitle}>
          Book new washes, manage your subscription, and review your wash history.
        </p>
      </div>

      <div className={css.grid}>
        {/* LEFT COLUMN – booking + subscription */}
        <div className={css.leftColumn}>
          {/* Booking */}
          <section className={css.card}>
            <h2 className={css.cardTitle}>Book a wash</h2>
            <p className={css.cardSubtitle}>
              Your subscription credits apply automatically. Select a date and time to schedule.
            </p>

            <div className={css.calendarPlaceholder}>
              Calendar component will go here (date + time selector).
            </div>

            <button type="button" className={css.primaryButton}>
              Confirm booking
            </button>
          </section>

          {/* Subscription controls */}
          <section className={css.card}>
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
                      count === vehicleCount ? css.pillButtonActive : css.pillButton
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
                  {vehicleCount} vehicle{vehicleCount > 1 ? 's' : ''} ·{' '}
                  {cadence === 'weekly'
                    ? 'Weekly washes'
                    : cadence === 'biweekly'
                    ? 'Every 2 weeks'
                    : 'Monthly washes'}
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
          <section className={css.card}>
            <h2 className={css.cardTitle}>Upcoming washes</h2>
            <p className={css.cardSubtitle}>
              Select a wash to see details, reschedule, or cancel. Cancellations inside 24 hours
              may incur a $25 fee.
            </p>

            {mockUpcomingWashes.length === 0 ? (
              <div className={css.emptyState}>
                No upcoming washes. Use the calendar to book your next wash.
              </div>
            ) : (
              mockUpcomingWashes.map(wash => (
                <button
                  key={wash.id}
                  type="button"
                  className={css.listRow}
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
                    <span className={css.chip}>{wash.status}</span>
                  </div>
                </button>
              ))
            )}
          </section>

          {/* Past washes */}
          <section className={css.card}>
            <h2 className={css.cardTitle}>Past washes</h2>
            {mockPastWashes.length === 0 ? (
              <div className={css.emptyState}>No wash history yet.</div>
            ) : (
              mockPastWashes.map(wash => (
                <button
                  key={wash.id}
                  type="button"
                  className={css.listRow}
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
          <section className={css.card}>
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
                  <span className={css.detailValue}>{selectedWash.location}</span>
                </div>
                <div className={css.detailRow}>
                  <span className={css.detailLabel}>Washer</span>
                  <span className={css.detailValue}>{selectedWash.washerName}</span>
                </div>
                {selectedWash.washerPhone && (
                  <div className={css.detailRow}>
                    <span className={css.detailLabel}>Washer contact</span>
                    <span className={css.detailValue}>{selectedWash.washerPhone}</span>
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
                  Customers are unable to cancel within 24 hours of the wash unless they pay the
                  $25 cancellation fee. This enforcement will live on the server.
                </p>
              </div>
            ) : (
              <div className={css.emptyState}>Select an upcoming or past wash to see details.</div>
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

export default connect(mapStateToProps)(DashboardPage);
