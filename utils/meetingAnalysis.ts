import type { MeetingAnalysis, MeetingAnalysisActionItem, Notification } from '../types';
import { createNotification } from './notifications.js';

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean);

export const createDemoMeetingAnalysis = (rawNotes: string, meetingId?: string): MeetingAnalysis => {
  const sentences = splitSentences(rawNotes);
  const actionCandidates = sentences.filter(sentence =>
    /\b(action|todo|follow up|follow-up|assign|assigned|will|needs?|due|by next|committee)\b/i.test(sentence),
  );
  const decisionCandidates = sentences.filter(sentence =>
    /\b(decided|approved|agreed|resolved|consensus|voted|carried)\b/i.test(sentence),
  );
  const motionCandidates = sentences.filter(sentence =>
    /\b(motion|moved|seconded|resolution)\b/i.test(sentence),
  );

  const actionItems = (actionCandidates.length ? actionCandidates : sentences.slice(0, 2)).map((sentence, index) => ({
    id: `demo-action-${Date.now()}-${index}`,
    description: sentence.replace(/^(action|todo|follow up|follow-up)\s*[:\-]\s*/i, ''),
    priority: /\b(urgent|high|emergency|asap)\b/i.test(sentence) ? 'High' as const : 'Medium' as const,
    sourceSnippet: sentence,
  }));

  return {
    id: `demo-meeting-analysis-${Date.now()}`,
    meetingId,
    rawNotes,
    professionalSummary: sentences.slice(0, 4).join(' ') || rawNotes,
    decisions: decisionCandidates,
    motionsMentioned: motionCandidates,
    actionItems,
    risksOrFollowUps: sentences.filter(sentence => /\b(risk|concern|blocked|waiting|follow up|follow-up)\b/i.test(sentence)),
    createdBy: 'demo-admin',
    createdAt: new Date().toISOString(),
  };
};

export const mapMeetingActionsToNotifications = ({
  cooperativeId,
  meetingId,
  actions,
}: {
  cooperativeId: string;
  meetingId?: string;
  actions: MeetingAnalysisActionItem[];
}): Notification[] => actions.map(action => createNotification({
  cooperativeId,
  audience: 'admin',
  type: 'governance',
  severity: action.priority === 'High' ? 'high' : action.priority === 'Medium' ? 'medium' : 'info',
  title: action.committee ? `${action.committee} action item` : 'Meeting action item',
  body: `${action.description}${action.dueDate ? ` Due ${action.dueDate}.` : ''}`,
  entityType: 'meeting-analysis',
  entityId: meetingId,
  actionUrl: meetingId ? `/calendar/${meetingId}` : '/calendar',
}));
