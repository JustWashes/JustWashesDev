// src/containers/ChooseSubscriptionPage/ChooseSubscriptionPage.js

import React from 'react';
import { connect } from 'react-redux';
import { Page, LayoutSingleColumn } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';
import { userDisplayNameAsString } from '../../util/data';

const ChooseSubscriptionPage = props => {
  const { currentUser } = props;
  const name = currentUser ? userDisplayNameAsString(currentUser) : 'there';
  const email = currentUser?.attributes?.email || '';

  /** 🔹 Stripe Checkout Call */
  const handleCheckout = async plan => {
    try {
      const response = await fetch('http://localhost:3500/api/stripe/checkout', { // 👈 FIXED URL
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, email }),
      });

      const data = await response.json();

      if (data.url) {
        window.location.href = data.url; // redirect to Stripe checkout
      } else {
        console.error(data);
        alert('Stripe error: No checkout URL returned.');
      }
    } catch (err) {
      console.error('Stripe Checkout Error:', err);
      alert('Could not connect to Stripe API.');
    }
  };

  return (
    <Page title="Choose Subscription | JustWashes">
      <TopbarContainer />

      {/* HEADER */}
      <div
        style={{
          background: 'linear-gradient(135deg, #007bff, #00a8ff)',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <h1 style={{ fontSize: '2.4rem', fontWeight: 700 }}>
          Hey {name}, choose your wash plan 🚗
        </h1>
        <p style={{ fontSize: '1.1rem', opacity: 0.95 }}>
          Select a plan below to continue to Stripe Checkout (Sandbox Mode)
        </p>
      </div>

      <LayoutSingleColumn>
        <div
          style={{
            maxWidth: '850px',
            margin: '40px auto',
            display: 'grid',
            gap: '20px',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          }}
        >
          {/* MONTHLY */}
          <div style={card}>
            <h3 style={cardTitle}>Monthly</h3>
            <p>$49 / month<br />Best upkeep plan</p>
            <button style={button} onClick={() => handleCheckout('monthly')}>Select Monthly</button>
          </div>

          {/* BI-MONTHLY */}
          <div style={card}>
            <h3 style={cardTitle}>Bi-Monthly</h3>
            <p>$69 / 2 months<br />Most popular</p>
            <button style={button} onClick={() => handleCheckout('bimonthly')}>Select Bi-Monthly</button>
          </div>

          {/* QUARTERLY */}
          <div style={card}>
            <h3 style={cardTitle}>Quarterly</h3>
            <p>$99 / 3 months<br />Seasonal refresh</p>
            <button style={button} onClick={() => handleCheckout('quarterly')}>Select Quarterly</button>
          </div>
        </div>
      </LayoutSingleColumn>

      <FooterContainer />
    </Page>
  );
};

/** 🎨 Styles */
const card = {
  padding: '24px',
  borderRadius: '12px',
  background: '#fff',
  border: '1px solid #eee',
  boxShadow: '0 6px 20px rgba(0,0,0,0.1)',
  textAlign: 'center',
};

const cardTitle = {
  fontSize: '1.4rem',
  fontWeight: '600',
  marginBottom: '10px',
};

const button = {
  marginTop: '12px',
  padding: '12px 24px',
  background: '#007bff',
  color: '#fff',
  border: 'none',
  borderRadius: '6px',
  cursor: 'pointer',
  transition: '0.2s',
};

const mapStateToProps = state => ({
  currentUser: state.user?.currentUser,
});

export default connect(mapStateToProps)(ChooseSubscriptionPage);
