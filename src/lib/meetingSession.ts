const tokenKey = (room: string) => `jummp_host_capability_${room}`;

export function saveHostCapability(room: string, token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(tokenKey(room), token);
}

export function getHostCapability(room: string): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(tokenKey(room));
}

export async function createAnonymousMeeting(): Promise<{ room: string; hostToken: string }> {
  const response = await fetch('/api/meet/session', { method: 'POST' });
  const data = await response.json();
  if (!response.ok || !data.room || !data.hostToken) {
    throw new Error(data.error || 'Unable to create the meeting');
  }
  saveHostCapability(data.room, data.hostToken);
  return data;
}

export async function verifyHostCapability(room: string, token: string): Promise<boolean> {
  const response = await fetch('/api/meet/session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, hostToken: token }),
  });
  return response.ok;
}
