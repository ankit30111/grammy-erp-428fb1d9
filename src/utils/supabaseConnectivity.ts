const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://oacdhvmpkuadlyvvvbpq.supabase.co";
const HEALTH_ENDPOINT = `${SUPABASE_URL}/auth/v1/health`;

export interface ConnectivityResult {
  reachable: boolean;
  online: boolean;
  supabaseHost: string;
  origin: string;
  timestamp: string;
  errorMessage?: string;
}

export async function checkSupabaseConnectivity(): Promise<ConnectivityResult> {
  const base: Omit<ConnectivityResult, 'reachable' | 'errorMessage'> = {
    online: typeof navigator !== 'undefined' ? navigator.onLine : true,
    supabaseHost: new URL(SUPABASE_URL).host,
    origin: typeof window !== 'undefined' ? window.location.origin : 'unknown',
    timestamp: new Date().toISOString(),
  };

  if (!base.online) {
    return { ...base, reachable: false, errorMessage: 'Browser reports offline (no internet connection).' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    await fetch(HEALTH_ENDPOINT, { mode: 'no-cors', signal: controller.signal });
    clearTimeout(timer);
    return { ...base, reachable: true };
  } catch (err: any) {
    const msg = err?.name === 'AbortError'
      ? 'Request timed out after 5 seconds.'
      : `Network error: ${err?.message || 'Failed to fetch'}`;
    return { ...base, reachable: false, errorMessage: msg };
  }
}

export function formatDiagnostics(r: ConnectivityResult): string {
  return [
    `Grammy ERP — Backend Connectivity Diagnostics`,
    `Time: ${r.timestamp}`,
    `Online: ${r.online}`,
    `Reachable: ${r.reachable}`,
    `Supabase Host: ${r.supabaseHost}`,
    `App Origin: ${r.origin}`,
    `User-Agent: ${navigator.userAgent}`,
    r.errorMessage ? `Error: ${r.errorMessage}` : '',
  ].filter(Boolean).join('\n');
}

export function getHealthUrl(): string {
  return HEALTH_ENDPOINT;
}
