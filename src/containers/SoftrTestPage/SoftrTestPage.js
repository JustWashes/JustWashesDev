import React from 'react';
import { connect } from 'react-redux';
import { Page, LayoutSingleColumn } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';
import { userDisplayNameAsString } from '../../util/data';

const SoftrTestPage = props => {
  const { currentUser } = props;

  const userEmail = currentUser?.attributes?.email || '';
  const displayName = currentUser ? userDisplayNameAsString(currentUser) : '';

  // Softr login page (opens in full window)
  const softrLoginUrl = `https://justwashes.softr.app/login?redirect=/staff-onboarding-checklist`;

  return (
    <Page title="Washer Login | JustWashes">
      {/* Sharetribe Topbar */}
      <TopbarContainer />

      <LayoutSingleColumn>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h1>Welcome {displayName || 'Washer'}</h1>
          <p>To continue your onboarding, please sign in below:</p>

          {/* 🔵 BUTTON — open Softr login externally */}
          <a
            href={softrLoginUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              padding: '12px 24px',
              backgroundColor: '#0066ff',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '16px',
              fontWeight: 'bold',
              marginTop: '20px',
            }}
          >
            Sign in to Washer Portal
          </a>

          {/* Show debug only if email exists */}
          {userEmail ? (
            <p style={{ marginTop: '12px', fontSize: '14px', color: '#666' }}>
              Already logged in as: <strong>{userEmail}</strong>
            </p>
          ) : null}
        </div>
      </LayoutSingleColumn>

      {/* Sharetribe Footer */}
      <FooterContainer />
    </Page>
  );
};

const mapStateToProps = state => ({
  currentUser: state.user?.currentUser,
});

export default connect(mapStateToProps)(SoftrTestPage);
