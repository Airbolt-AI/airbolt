import { useAuth0 } from '@auth0/auth0-react';
import { useEffect, useState } from 'react';

interface DebugState {
  hasAuth0: boolean;
  tokenFetched: boolean;
  tokenError: string | null;
  tokenPreview: string | null;
  decodedToken: any | null;
  sdkDetection: boolean;
}

function AuthDebugInfo() {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [debugState, setDebugState] = useState<DebugState>({
    hasAuth0: false,
    tokenFetched: false,
    tokenError: null,
    tokenPreview: null,
    decodedToken: null,
    sdkDetection: false,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    const checkAuth0Integration = async () => {
      const newState: DebugState = {
        hasAuth0: true, // Auth0 React SDK doesn't expose window.auth0
        tokenFetched: false,
        tokenError: null,
        tokenPreview: null,
        decodedToken: null,
        sdkDetection: true, // React SDK provides auth through context
      };

      try {
        // Auth0 React SDK works through context, not global object
        // The SDK will get the token through the useAuth0 hook

        // Try to get token
        const token = await getAccessTokenSilently();
        newState.tokenFetched = true;
        newState.tokenPreview = token.substring(0, 50) + '...';

        // Decode token (for debugging)
        try {
          const [, payload] = token.split('.');
          newState.decodedToken = JSON.parse(atob(payload));
        } catch (e) {
          console.error('Failed to decode token:', e);
        }
      } catch (error) {
        newState.tokenError =
          error instanceof Error ? error.message : 'Unknown error';
      }

      setDebugState(newState);
    };

    checkAuth0Integration();
  }, [getAccessTokenSilently, isAuthenticated]);

  if (!isAuthenticated) return null;

  return (
    <div className="debug-section">
      <h3>🔍 Auth0 Integration Debug Info</h3>
      <div className="debug-info">
        <div className="debug-item">
          <span
            className={`status-indicator ${debugState.hasAuth0 ? 'success' : 'error'}`}
          ></span>
          <strong>Auth0 React SDK:</strong>{' '}
          {debugState.hasAuth0 ? 'Loaded ✓' : 'Not Loaded ✗'}
        </div>

        <div className="debug-item">
          <span
            className={`status-indicator ${debugState.sdkDetection ? 'success' : 'error'}`}
          ></span>
          <strong>Auth0 Integration:</strong>{' '}
          {debugState.sdkDetection ? 'Connected ✓' : 'Not Connected ✗'}
        </div>

        <div className="debug-item">
          <span
            className={`status-indicator ${debugState.tokenFetched ? 'success' : 'error'}`}
          ></span>
          <strong>Token Retrieval:</strong>{' '}
          {debugState.tokenFetched ? 'Success ✓' : 'Failed ✗'}
          {debugState.tokenError && <pre>Error: {debugState.tokenError}</pre>}
          {debugState.tokenPreview && (
            <pre>Token: {debugState.tokenPreview}</pre>
          )}
        </div>

        {debugState.decodedToken && (
          <div className="debug-item">
            <strong>Token Claims:</strong>
            <pre>
              {JSON.stringify(
                {
                  sub: debugState.decodedToken.sub,
                  iss: debugState.decodedToken.iss,
                  aud: debugState.decodedToken.aud,
                  exp: new Date(
                    debugState.decodedToken.exp * 1000
                  ).toISOString(),
                  scope: debugState.decodedToken.scope,
                },
                null,
                2
              )}
            </pre>
          </div>
        )}

        {debugState.decodedToken && (
          <div className="debug-item">
            <strong>User Identification:</strong>
            <p>
              Your user ID: <code>{debugState.decodedToken.sub}</code>
            </p>
            <p className="note">
              This ID is used for rate limiting and user-specific features.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default AuthDebugInfo;
