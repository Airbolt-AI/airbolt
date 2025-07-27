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
        hasAuth0: !!(window as any).auth0,
        tokenFetched: false,
        tokenError: null,
        tokenPreview: null,
        decodedToken: null,
        sdkDetection: false,
      };

      try {
        // Check if SDK can detect Auth0
        newState.sdkDetection = !!(window as any).auth0?.getAccessTokenSilently;

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
          <strong>Auth0 Global Object:</strong>{' '}
          {debugState.hasAuth0 ? 'Detected ✓' : 'Not Found ✗'}
        </div>

        <div className="debug-item">
          <span
            className={`status-indicator ${debugState.sdkDetection ? 'success' : 'error'}`}
          ></span>
          <strong>SDK Auto-Detection:</strong>{' '}
          {debugState.sdkDetection ? 'Working ✓' : 'Not Working ✗'}
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

        <div className="debug-item">
          <strong>Expected Backend Config:</strong>
          <pre>EXTERNAL_JWT_PUBLIC_KEY="{`<Your Auth0 Public Key>`}"</pre>
          <p>
            The backend should extract user ID from:{' '}
            <code>{debugState.decodedToken?.sub || 'auth0|xxxxx'}</code>
            {debugState.decodedToken?.sub?.startsWith('auth0|') &&
              ' (prefix will be stripped)'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default AuthDebugInfo;
