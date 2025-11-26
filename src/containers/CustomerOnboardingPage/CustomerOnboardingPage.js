// src/containers/CustomerOnboardingPage/CustomerOnboardingPage.js

import React from 'react';
import { connect } from 'react-redux';
import { Page, LayoutSingleColumn } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';
import { userDisplayNameAsString } from '../../util/data';

const CustomerOnboardingPage = props => {
  const { currentUser } = props;

  const name = currentUser ? userDisplayNameAsString(currentUser) : 'there';
  const email = currentUser?.attributes?.email || '';

  const needsOnboarding =
    !currentUser?.attributes?.profile?.publicData?.trainingStatus ||
    currentUser?.attributes?.profile?.publicData?.trainingStatus === 'incomplete';

  const startOnboardingUrl = `https://justwashes.softr.app/onboarding?email=${encodeURIComponent(email)}`;

  return (
    <Page title="Customer Onboarding | JustWashes">
      <TopbarContainer />

      {/* 🔹 Gradient Header */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0d3b66, #007bff)',
          padding: '60px 20px',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <h1 style={{ fontSize: '2.8rem', fontWeight: '700', marginBottom: '10px' }}>
          Welcome {name} 👋
        </h1>
        <p style={{ fontSize: '1.2rem', opacity: 0.9 }}>
          You’re just a few steps away from activating your account.
        </p>
      </div>

      <LayoutSingleColumn>
        {/* 🔹 Main Onboarding Card */}
        <div
          style={{
            maxWidth: '650px',
            margin: '40px auto',
            padding: '32px',
            textAlign: 'center',
            background: '#fff',
            borderRadius: '16px',
            boxShadow: '0 6px 20px rgba(0,0,0,0.10)',
            border: '1px solid #e6e6e6',
          }}
        >
          <h2 style={{ fontSize: '1.8rem', fontWeight: '600', marginBottom: '24px' }}>
            🚗 JustWashes – Washer Onboarding
          </h2>

          {/* 👣 Placeholder “Steps” */}
          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            <p style={{ fontSize: '1rem', marginBottom: '8px', fontWeight: '500' }}>
              Your onboarding includes:
            </p>
            <ul style={{ listStyle: 'none', padding: 0, lineHeight: '1.8' }}>
              <li>✔ Enter your email & PIN</li>
              <li>✔ Upload vehicle & address</li>
              <li>✔ Complete required agreements</li>
              <li>✔ Choose the plan that best matches your wash frequency, vehicle type, and number of vehicles</li>
            </ul>
          </div>

          {/* 🔹 Button / Logic */}
          {needsOnboarding ? (
            <button
              style={{
                padding: '14px 32px',
                background: '#007bff',
                color: '#fff',
                fontSize: '1.1rem',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                transition: '0.2s all',
              }}
              onClick={() => window.location.href = startOnboardingUrl}
              onMouseOver={e => (e.currentTarget.style.background = '#0056b3')}
              onMouseOut={e => (e.currentTarget.style.background = '#007bff')}
            >
              Begin Onboarding
            </button>
          ) : (
            <div>
              <p style={{ fontSize: '1.2rem', color: '#28a745', marginBottom: '16px' }}>
                🎉 You're already fully onboarded!
              </p>
              <button
                style={{
                  padding: '14px 32px',
                  background: '#28a745',
                  color: '#fff',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: '0.2s all',
                }}
                onClick={() => window.location.href = '/'}
                onMouseOver={e => (e.currentTarget.style.background = '#208637')}
                onMouseOut={e => (e.currentTarget.style.background = '#28a745')}
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </div>
      </LayoutSingleColumn>

      <FooterContainer />
    </Page>
  );
};

const mapStateToProps = state => ({
  currentUser: state.user?.currentUser,
});

export default connect(mapStateToProps)(CustomerOnboardingPage);
