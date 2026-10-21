import { RoomServiceClient, TrackSource } from 'livekit-server-sdk';

/**
 * Returns an authenticated RoomServiceClient instance pointing to the LiveKit SFU.
 */
export function getLiveKitRoomServiceClient(): RoomServiceClient | null {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const rawUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

  if (!apiKey || !apiSecret || !rawUrl) {
    return null;
  }

  const url = rawUrl.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
  return new RoomServiceClient(url, apiKey, apiSecret);
}

export type ParticipantTarget =
  | string
  | {
      targetParticipantId?: string;
      targetName?: string;
    };

/**
 * Resolves a participant in a LiveKit room by their identity or display name.
 */
async function resolveParticipant(
  client: RoomServiceClient,
  room: string,
  target: ParticipantTarget
) {
  const targetId = typeof target === 'string' ? target : target.targetParticipantId;
  const targetName = typeof target === 'string' ? target : target.targetName;

  // 1. Direct identity lookup if targetId is given
  if (targetId) {
    try {
      const p = await client.getParticipant(room, targetId);
      if (p) return p;
    } catch {}
  }

  // 2. Direct identity lookup if targetName is given
  if (targetName && targetName !== targetId) {
    try {
      const p = await client.getParticipant(room, targetName);
      if (p) return p;
    } catch {}
  }

  // 3. Fallback: list participants and match by identity or name (case-insensitive & trimmed)
  try {
    const list = await client.listParticipants(room);
    const idClean = (targetId || '').trim().toLowerCase();
    const nameClean = (targetName || '').trim().toLowerCase();

    return (
      list.find((p) => {
        const pId = p.identity.trim().toLowerCase();
        const pName = (p.name || '').trim().toLowerCase();
        if (idClean && pId === idClean) return true;
        if (nameClean && pName === nameClean) return true;
        if (nameClean && pId === nameClean) return true;
        if (idClean && pName === idClean) return true;
        return false;
      }) || null
    );
  } catch (err) {
    console.warn(`Failed to list participants in room ${room}:`, err);
    return null;
  }
}

/**
 * Updates an attendee's publish permissions at the LiveKit SFU server level.
 * When canPublish is false, the LiveKit SFU will strictly reject any attempted media publication.
 */
export async function updateParticipantPublishPermissions(
  room: string,
  target: ParticipantTarget,
  permissions: {
    canPublishMic?: boolean;
    canPublishCamera?: boolean;
    canPublishAll?: boolean;
    revokeAll?: boolean;
  }
): Promise<boolean> {
  const client = getLiveKitRoomServiceClient();
  if (!client) return false;

  try {
    const participant = await resolveParticipant(client, room, target);
    if (!participant) {
      const desc = typeof target === 'string' ? target : `${target.targetName} (${target.targetParticipantId})`;
      console.warn(`Participant ${desc} not found in LiveKit room ${room}`);
      return false;
    }

    const identity = participant.identity;

    if (permissions.revokeAll) {
      // 1. Mute any active published tracks at SFU
      if (participant.tracks) {
        for (const track of participant.tracks) {
          if (!track.muted && track.sid) {
            await client.mutePublishedTrack(room, identity, track.sid, true).catch(() => {});
          }
        }
      }
      // 2. Strict SFU rejection
      await client.updateParticipant(room, identity, {
        permission: {
          canPublish: false,
          canPublishSources: [],
          canSubscribe: true,
          canPublishData: true,
        },
      });
      return true;
    }

    if (permissions.canPublishAll) {
      // Unmute all tracks at SFU level
      if (participant.tracks) {
        for (const track of participant.tracks) {
          if (track.sid) {
            await client.mutePublishedTrack(room, identity, track.sid, false).catch(() => {});
          }
        }
      }
      await client.updateParticipant(room, identity, {
        permission: {
          canPublish: true,
          canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
          canSubscribe: true,
          canPublishData: true,
        },
      });
      return true;
    }

    // Determine allowed track sources
    let sources: TrackSource[] = [];
    if (participant.permission?.canPublishSources && participant.permission.canPublishSources.length > 0) {
      sources = [...participant.permission.canPublishSources];
    }

    if (permissions.canPublishMic === true) {
      if (!sources.includes(TrackSource.MICROPHONE)) {
        sources.push(TrackSource.MICROPHONE);
      }
      // Explicitly UNMUTE audio tracks at SFU level so SFU forwards attendee audio!
      if (participant.tracks) {
        for (const track of participant.tracks) {
          if (track.source === TrackSource.MICROPHONE && track.sid) {
            await client.mutePublishedTrack(room, identity, track.sid, false).catch(() => {});
          }
        }
      }
    } else if (permissions.canPublishMic === false) {
      sources = sources.filter((s) => s !== TrackSource.MICROPHONE);
      // Mute audio track on SFU
      if (participant.tracks) {
        for (const track of participant.tracks) {
          if (track.source === TrackSource.MICROPHONE && !track.muted && track.sid) {
            await client.mutePublishedTrack(room, identity, track.sid, true).catch(() => {});
          }
        }
      }
    }

    if (permissions.canPublishCamera === true) {
      if (!sources.includes(TrackSource.CAMERA)) {
        sources.push(TrackSource.CAMERA);
      }
      // Explicitly UNMUTE video tracks at SFU level so SFU forwards attendee video frames!
      if (participant.tracks) {
        for (const track of participant.tracks) {
          if (track.source === TrackSource.CAMERA && track.sid) {
            await client.mutePublishedTrack(room, identity, track.sid, false).catch(() => {});
          }
        }
      }
    } else if (permissions.canPublishCamera === false) {
      sources = sources.filter((s) => s !== TrackSource.CAMERA);
      // Mute video track on SFU
      if (participant.tracks) {
        for (const track of participant.tracks) {
          if (track.source === TrackSource.CAMERA && !track.muted && track.sid) {
            await client.mutePublishedTrack(room, identity, track.sid, true).catch(() => {});
          }
        }
      }
    }

    const canPublish = sources.length > 0;

    await client.updateParticipant(room, identity, {
      permission: {
        canPublish,
        canPublishSources: sources,
        canSubscribe: true,
        canPublishData: true,
      },
    });

    return true;
  } catch (err) {
    console.warn(`Failed to update LiveKit permissions for target in ${room}:`, err);
    return false;
  }
}

/**
 * Updates SFU permissions for all participants when Webinar Mode is turned ON or OFF.
 * In Webinar Mode: All non-hosts have canPublish: false.
 * In Open Mode: All attendees have canPublish: true.
 */
export async function setRoomWebinarModeSFU(
  room: string,
  webinarModeEnabled: boolean,
  hostIdentitiesOrNames: string[] = []
): Promise<boolean> {
  const client = getLiveKitRoomServiceClient();
  if (!client) return false;

  try {
    const participants = await client.listParticipants(room);
    const hostSet = new Set(
      hostIdentitiesOrNames.map((h) => h.toLowerCase().trim()).filter(Boolean)
    );

    for (const p of participants) {
      const isHost =
        hostSet.has(p.identity.toLowerCase().trim()) ||
        (p.name && hostSet.has(p.name.toLowerCase().trim()));

      if (isHost) continue; // Hosts always retain full publishing capabilities

      if (webinarModeEnabled) {
        // Mute active tracks at the SFU level
        if (p.tracks) {
          for (const track of p.tracks) {
            if (!track.muted && track.sid) {
              await client.mutePublishedTrack(room, p.identity, track.sid, true).catch(() => {});
            }
          }
        }
        // Strict SFU permission revoke: canPublish = false
        await client.updateParticipant(room, p.identity, {
          permission: {
            canPublish: false,
            canPublishSources: [],
            canSubscribe: true,
            canPublishData: true,
          },
        }).catch(() => {});
      } else {
        // Restore standard open meeting publishing
        if (p.tracks) {
          for (const track of p.tracks) {
            if (track.sid) {
              await client.mutePublishedTrack(room, p.identity, track.sid, false).catch(() => {});
            }
          }
        }
        await client.updateParticipant(room, p.identity, {
          permission: {
            canPublish: true,
            canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE, TrackSource.SCREEN_SHARE],
            canSubscribe: true,
            canPublishData: true,
          },
        }).catch(() => {});
      }
    }
    return true;
  } catch (err) {
    console.warn(`Failed to update room webinar mode SFU permissions for ${room}:`, err);
    return false;
  }
}

/**
 * Mutes all attendee audio tracks at the SFU server level.
 */
export async function muteAllAttendeesSFU(
  room: string,
  hostIdentitiesOrNames: string[] = []
): Promise<boolean> {
  const client = getLiveKitRoomServiceClient();
  if (!client) return false;

  try {
    const participants = await client.listParticipants(room);
    const hostSet = new Set(
      hostIdentitiesOrNames.map((h) => h.toLowerCase().trim()).filter(Boolean)
    );

    for (const p of participants) {
      const isHost =
        hostSet.has(p.identity.toLowerCase().trim()) ||
        (p.name && hostSet.has(p.name.toLowerCase().trim()));
      if (isHost) continue;

      if (p.tracks) {
        for (const track of p.tracks) {
          if (track.source === TrackSource.MICROPHONE && !track.muted && track.sid) {
            await client.mutePublishedTrack(room, p.identity, track.sid, true).catch(() => {});
          }
        }
      }

      // Remove MICROPHONE from canPublishSources
      let sources = p.permission?.canPublishSources ? [...p.permission.canPublishSources] : [];
      sources = sources.filter((s) => s !== TrackSource.MICROPHONE);
      await client.updateParticipant(room, p.identity, {
        permission: {
          canPublish: sources.length > 0,
          canPublishSources: sources,
          canSubscribe: true,
          canPublishData: true,
        },
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Stops all attendee video tracks at the SFU server level.
 */
export async function stopAllAttendeesVideoSFU(
  room: string,
  hostIdentitiesOrNames: string[] = []
): Promise<boolean> {
  const client = getLiveKitRoomServiceClient();
  if (!client) return false;

  try {
    const participants = await client.listParticipants(room);
    const hostSet = new Set(
      hostIdentitiesOrNames.map((h) => h.toLowerCase().trim()).filter(Boolean)
    );

    for (const p of participants) {
      const isHost =
        hostSet.has(p.identity.toLowerCase().trim()) ||
        (p.name && hostSet.has(p.name.toLowerCase().trim()));
      if (isHost) continue;

      if (p.tracks) {
        for (const track of p.tracks) {
          if (track.source === TrackSource.CAMERA && !track.muted && track.sid) {
            await client.mutePublishedTrack(room, p.identity, track.sid, true).catch(() => {});
          }
        }
      }

      // Remove CAMERA from canPublishSources
      let sources = p.permission?.canPublishSources ? [...p.permission.canPublishSources] : [];
      sources = sources.filter((s) => s !== TrackSource.CAMERA);
      await client.updateParticipant(room, p.identity, {
        permission: {
          canPublish: sources.length > 0,
          canPublishSources: sources,
          canSubscribe: true,
          canPublishData: true,
        },
      }).catch(() => {});
    }
    return true;
  } catch {
    return false;
  }
}
