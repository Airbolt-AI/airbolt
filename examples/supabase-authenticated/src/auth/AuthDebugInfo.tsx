import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

interface DebugInfo {
  supabaseDetected: boolean;
  sessionExists: boolean;
  tokenClaims: any;
  airboltSDKDetection: boolean;
}

export default function AuthDebugInfo() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    supabaseDetected: false,
    sessionExists: false,
    tokenClaims: null,
    airboltSDKDetection: false,
  });

  useEffect(() => {
    const updateDebugInfo = async () => {
      try {
        // Check if Supabase is available globally (for SDK detection)
        const supabaseDetected =
          typeof window !== 'undefined' &&
          (window as any).supabase !== undefined;

        // Get current session
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const sessionExists = !!session;

        let tokenClaims = null;
        if (session?.access_token) {
          try {
            // Decode JWT token (just the payload for debugging)
            const tokenParts = session.access_token.split('.');
            if (tokenParts.length === 3) {
              const payload = JSON.parse(atob(tokenParts[1]));
              tokenClaims = payload;
            }
          } catch (error) {
            console.error('Error decoding token:', error);
          }
        }

        // Check if Airbolt SDK would detect Supabase
        const airboltSDKDetection = sessionExists; // SDK detects via session existence

        setDebugInfo({
          supabaseDetected,
          sessionExists,
          tokenClaims,
          airboltSDKDetection,
        });
      } catch (error) {
        console.error('Error getting debug info:', error);
      }
    };

    updateDebugInfo();

    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      updateDebugInfo();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="debug-section">
      <h3>🔍 Debug Panel - Understanding the Integration</h3>

      <div className="debug-item">
        <h4>
          <span
            className={`status-indicator ${debugInfo.supabaseDetected ? 'success' : 'error'}`}
          ></span>
          Supabase Client Available
        </h4>
        <pre>
          {debugInfo.supabaseDetected
            ? 'Yes - Supabase client is initialized'
            : 'No - Supabase not detected'}
        </pre>
      </div>

      <div className="debug-item">
        <h4>
          <span
            className={`status-indicator ${debugInfo.sessionExists ? 'success' : 'error'}`}
          ></span>
          Active Session
        </h4>
        <pre>
          {debugInfo.sessionExists
            ? 'Yes - User is authenticated'
            : 'No - No active session'}
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
            ? 'SDK will detect Supabase automatically'
            : 'SDK will fall back to anonymous mode'}
        </pre>
      </div>

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
No configuration needed! Backend auto-discovers Supabase tokens.

# Production Mode  
NODE_ENV=production
EXTERNAL_JWT_ISSUER=${debugInfo.tokenClaims?.iss || 'https://your-project.supabase.co/auth/v1'}
EXTERNAL_JWT_AUDIENCE=${debugInfo.tokenClaims?.aud || 'authenticated'}`}
        </pre>
      </div>
    </div>
  );
}
