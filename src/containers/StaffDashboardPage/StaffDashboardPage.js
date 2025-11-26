import React, { useEffect, useRef } from 'react';
import { connect } from 'react-redux';
import { Page, LayoutSingleColumn } from '../../components';
import TopbarContainer from '../../containers/TopbarContainer/TopbarContainer';
import FooterContainer from '../../containers/FooterContainer/FooterContainer';
import { userDisplayNameAsString } from '../../util/data';

const StaffDashboardPage = props => {
  const { currentUser } = props;
  const iframeRef = useRef(null);

  // 1️⃣ IF Softr redirected back to Sharetribe → get email
  const queryParams = new URLSearchParams(window.location.search);
  const emailFromUrl = queryParams.get('email');

  // 2️⃣ Used ENVIRONMENT-AWARE redirect:
  const sharetribeBaseUrl =
    window.location.origin; // automatically works in dev + test + live

  const softrLoginUrl = `https://justwashes.softr.app/login?redirect=${sharetribeBaseUrl}/p/staff-dashboard`;

  // 3️⃣ Load Softr iframe resizer script
  useEffect(() => {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/iframe-resizer/4.2.11/iframeResizer.min.js';
    script.async = true;
    script.onload = () => {
      if (window.iFrameResize) {
        window.iFrameResize(
          { checkOrigin: false, log: false },
          '#softr-892e03b5-8b94-4879-b5d5-ad645ba82ed3-list1'
        );
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
    };
  }, []);

  // 4️⃣ If no Softr login yet → show login button & stop here
  if (!emailFromUrl) {
    return (
      <Page title="Washer Login | JustWashes">
        <TopbarContainer />

        <LayoutSingleColumn>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h1>Welcome</h1>
            <p>Please sign in to begin your onboarding process.</p>

            <a
              href={softrLoginUrl}
              style={{
                padding: '12px 24px',
                background: '#0066ff',
                color: '#fff',
                borderRadius: '8px',
                textDecoration: 'none',
                fontWeight: 'bold',
                display: 'inline-block',
                marginTop: '16px',
              }}
            >
              Open Washer Login Portal
            </a>
          </div>
        </LayoutSingleColumn>

        <FooterContainer />
      </Page>
    );
  }

  // 5️⃣ If we HAVE email from Softr → load the checklist embed
  return (
    <Page title="Staff Dashboard | JustWashes">
      <TopbarContainer />

      <LayoutSingleColumn>
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <h1>Washer Dashboard</h1>
          <p>Logged in as: <strong>{emailFromUrl}</strong></p>

          <hr style={{ margin: '20px 0' }} />

          <h2>Your Onboarding Checklist</h2>

          <div style={{ position: 'relative', minHeight: '900px' }}>
            <iframe
              id="softr-892e03b5-8b94-4879-b5d5-ad645ba82ed3-list1"
              ref={iframeRef}
              src="https://JustWashes.softr.app/embed/pages/892e03b5-8b94-4879-b5d5-ad645ba82ed3/blocks/list1"
              width="100%"
              height="1000"
              scrolling="no"
              frameBorder="0"
              style={{ border: 'none' }}
              title="Onboarding Checklist"
            />
          </div>
        </div>
      </LayoutSingleColumn>

      <FooterContainer />
    </Page>
  );
};

const mapStateToProps = state => ({
  currentUser: state.user?.currentUser,
});

export default connect(mapStateToProps)(StaffDashboardPage);
