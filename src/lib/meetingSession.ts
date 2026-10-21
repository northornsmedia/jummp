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

const admissionKey = (room: string) => `jummp_guest_admission_${room}`;

export function saveAdmissionCapability(room: string, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(admissionKey(room), token);
  } catch {}
}

export function getAdmissionCapability(room: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(admissionKey(room));
  } catch {
    return null;
  }
}

export async function promoteParticipantToHost(
  room: string,
  hostToken: string,
  targetParticipantId: string,
  targetName: string
): Promise<string> {
  const response = await fetch('/api/meet/promote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ room, hostToken, targetParticipantId, targetName }),
  });
  const data = await response.json();
  if (!response.ok || !data.hostToken) {
    throw new Error(data.error || 'Failed to promote participant to host');
  }
  return data.hostToken;
}

