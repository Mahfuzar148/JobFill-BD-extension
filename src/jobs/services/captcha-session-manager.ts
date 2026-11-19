// JobFill BD - Human-in-the-Loop CAPTCHA & Challenge Session Manager
// Coordinates safe pausing of extraction workflows when an anti-bot challenge is detected.
// Guides the user to complete verification directly on the official portal.
// Never interacts with challenge widgets, never extracts tokens, and never automates solving.

import { ChallengeClassification, ChallengeDetectionResult, detectPageChallenge } from './captcha-detector';
import { recordExtensionDiagnostic } from '../../security/diagnostics';

export interface CaptchaSessionState {
  sessionId: string;
  sourceId: string;
  sourceName: string;
  portalUrl: string;
  challengeClassification: ChallengeClassification;
  challengeProvider?: string;
  detectedAt: number;
  pausedAt: number;
  resumable: boolean;
  verificationCheckedAt?: number | null;
  verificationCleared?: boolean;
  reason?: string;
}

const STORAGE_KEY_CAPTCHA_SESSIONS = 'jobfill_active_captcha_sessions_v1';
const activeMemorySessions = new Map<string, CaptchaSessionState>();

function loadPersistedSessions(): Map<string, CaptchaSessionState> {
  if (typeof localStorage === 'undefined') return activeMemorySessions;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CAPTCHA_SESSIONS);
    if (raw) {
      const list: CaptchaSessionState[] = JSON.parse(raw);
      for (const s of list) {
        if (s && s.sourceId) {
          activeMemorySessions.set(s.sourceId, s);
        }
      }
    }
  } catch {
    // ignore
  }
  return activeMemorySessions;
}

function persistSessions(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    const list = Array.from(activeMemorySessions.values());
    localStorage.setItem(STORAGE_KEY_CAPTCHA_SESSIONS, JSON.stringify(list));
  } catch {
    // ignore
  }
}

// Initial load
loadPersistedSessions();

export class CaptchaSessionManager {
  /**
   * Pauses an extraction workflow safely when a CAPTCHA or challenge is encountered.
   */
  public static recordChallengePaused(
    sourceId: string,
    sourceName: string,
    portalUrl: string,
    challenge: ChallengeDetectionResult
  ): CaptchaSessionState {
    const now = Date.now();
    const session: CaptchaSessionState = {
      sessionId: `cap_${sourceId}_${now}`,
      sourceId,
      sourceName,
      portalUrl,
      challengeClassification: challenge.classification,
      challengeProvider: challenge.challengeProvider,
      detectedAt: now,
      pausedAt: now,
      resumable: true,
      reason: challenge.reason || 'Human verification challenge active on portal.',
      verificationCleared: false,
    };

    activeMemorySessions.set(sourceId, session);
    persistSessions();

    recordExtensionDiagnostic('background_task_run', {
      source: `captcha_paused_${sourceId}`,
      detail: challenge.classification,
    });

    return session;
  }

  public static getActiveSession(sourceId: string): CaptchaSessionState | null {
    loadPersistedSessions();
    return activeMemorySessions.get(sourceId) || null;
  }

  public static getAllActiveSessions(): CaptchaSessionState[] {
    loadPersistedSessions();
    return Array.from(activeMemorySessions.values());
  }

  public static clearSession(sourceId: string): void {
    activeMemorySessions.delete(sourceId);
    persistSessions();
  }

  public static clearAllSessions(): void {
    activeMemorySessions.clear();
    persistSessions();
  }

  /**
   * Evaluates an active portal tab/DOM to verify whether the challenge has been solved
   * by the human user and the portal is genuinely displaying authorized content.
   *
   * Only returns canResume=true when:
   * 1. NO challenge is detected in the document.
   * 2. The page is not displaying an error or access restriction.
   */
  public static evaluateTabForResume(doc: Document): {
    canResume: boolean;
    reason: string;
    challengeClassification: ChallengeClassification;
  } {
    if (!doc) {
      return {
        canResume: false,
        reason: 'Unable to inspect page document.',
        challengeClassification: 'UNKNOWN_CHALLENGE',
      };
    }

    const check = detectPageChallenge(doc);
    if (check.isBlocked) {
      return {
        canResume: false,
        reason:
          check.reason ||
          'Human verification challenge is still active on this page. Please complete it in your browser first.',
        challengeClassification: check.classification,
      };
    }

    return {
      canResume: true,
      reason: 'Challenge successfully cleared. Page is ready for extraction resume.',
      challengeClassification: 'NO_CHALLENGE_DETECTED',
    };
  }
}
