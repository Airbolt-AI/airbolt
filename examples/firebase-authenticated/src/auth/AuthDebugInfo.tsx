import { useEffect, useState } from 'react';
import { auth } from './firebase';
import { onAuthStateChanged, type User } from 'firebase/auth';

interface DebugInfo {
  firebaseDetected: boolean;
  userSignedIn: boolean;
  tokenClaims: any;
  airboltSDKDetection: boolean;
  currentUser: User | null;
}

export default function AuthDebugInfo() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    firebaseDetected: false,
    userSignedIn: false,
    tokenClaims: null,
    airboltSDKDetection: false,
    currentUser: null,
  });

  useEffect(() => {
    const updateDebugInfo = async (user: User | null) => {
      try {
        // Check if Firebase is available globally (for SDK detection)
        const firebaseDetected =
          typeof window !== 'undefined' &&
          (window as any).firebase !== undefined;

        const userSignedIn = !!user;

        let tokenClaims = null;
        if (user) {
          try {
            // Get the ID token and decode it
            const token = await user.getIdToken();
            const tokenParts = token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              tokenClaims = payload;
            }
          } catch (error) {
            console.error('Error getting token:', error);
          }
        }

        // Check if Airbolt SDK would detect Firebase
        const airboltSDKDetection = userSignedIn; // SDK detects via signed-in user

        setDebugInfo({
          firebaseDetected,
          userSignedIn,
          tokenClaims,
          airboltSDKDetection,
          currentUser: user,
        });
      } catch (error) {
        console.error('Error getting debug info:', error);
      }
    };

    // Listen for auth state changes
    const unsubscribe = onAuthStateChanged(auth, updateDebugInfo);

    // Initial load
    updateDebugInfo(auth.currentUser);

    return () => unsubscribe();
  }, []);

  return (
    <div className="debug-section">
      <h3>🔍 Debug Panel - Understanding the Integration</h3>

      <div className="debug-item">
        <h4>
          <span
            className={`status-indicator ${debugInfo.firebaseDetected ? 'success' : 'error'}`}
          ></span>
          Firebase Available
        </h4>
        <pre>
          {debugInfo.firebaseDetected
            ? 'Yes - Firebase Auth is initialized'
            : 'No - Firebase not detected'}
        </pre>
      </div>

      <div className="debug-item">
        <h4>
          <span
            className={`status-indicator ${debugInfo.userSignedIn ? 'success' : 'error'}`}
          ></span>
          User Signed In
        </h4>
        <pre>
          {debugInfo.userSignedIn
            ? `Yes - ${debugInfo.currentUser?.email || 'Anonymous user'}`
            : 'No - No signed-in user'}
        </pre>
      </div>

      <div className="debug-item">
        <h4>
          <span
            className={`status-indicator ${debugInfo.airboltSDKDetection ? 'success' : 'error'}`}
          ></span>
          Airbolt SDK Detection
        </h4>
        <pre>
          {debugInfo.airboltSDKDetection
            ? 'SDK will detect Firebase automatically'
            : 'SDK will fall back to anonymous mode'}
        </pre>
      </div>

      {debugInfo.currentUser && (
        <div className="debug-item">
          <h4>
            <span className="status-indicator success"></span>
            User Information
          </h4>
          <pre>
            {JSON.stringify(
              {
                uid: debugInfo.currentUser.uid,
                email: debugInfo.currentUser.email,
                displayName: debugInfo.currentUser.displayName,
                emailVerified: debugInfo.currentUser.emailVerified,
                providerId: debugInfo.currentUser.providerId,
                providerData: debugInfo.currentUser.providerData.map(p => ({
                  providerId: p.providerId,
                  email: p.email,
                  displayName: p.displayName,
                })),
              },
              null,
              2
            )}
          </pre>
        </div>
      )}

      {debugInfo.tokenClaims && (
        <div className="debug-item">
          <h4>
            <span className="status-indicator success"></span>
            JWT Token Claims
          </h4>
          <pre>{JSON.stringify(debugInfo.tokenClaims, null, 2)}</pre>
        </div>
      )}

      <div className="debug-item">
        <h4>Expected Backend Configuration</h4>
        <pre>
          {`# Development Mode (Current)
No configuration needed! Backend auto-discovers Firebase tokens.

# Production Mode  
NODE_ENV=production
EXTERNAL_JWT_ISSUER=${debugInfo.tokenClaims?.iss || 'https://securetoken.google.com/your-project-id'}
EXTERNAL_JWT_AUDIENCE=${debugInfo.tokenClaims?.aud || 'your-project-id'}`}
        </pre>
      </div>
    </div>
  );
}
