import type { MeetingAnalysis, MeetingAnalysisActionItem, Notification } from '../types';
import { createNotification } from './notifications.js';

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean);

const stripPrefix = (sentence: string) =>
  sentence.replace(/^(action|todo|follow up|follow-up|decision|motion|topic)\s*[:\-]\s*/i, '').trim();

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
    description: stripPrefix(sentence),
    priority: /\b(urgent|high|emergency|asap)\b/i.test(sentence) ? 'High' as const : 'Medium' as const,
    sourceSnippet: sentence,
  }));

  const topicSources = sentences.length ? sentences.slice(0, 4) : [rawNotes];
  const topicBriefings = topicSources.map((sentence, index) => {
    const topic = stripPrefix(sentence).split(/[.:;-]/)[0]?.slice(0, 80) || `Meeting Topic ${index + 1}`;
    return {
      topic,
      context: `The notes identify ${topic.toLowerCase()} as a matter discussed by the meeting participants.`,
      discussionSummary: `${stripPrefix(sentence)} The matter should be recorded as a concise board discussion item, with any operational impact separated from formal decisions.`,
      implications: 'Follow-up may be required if the notes do not identify an owner, deadline, budget impact, or approval status.',
      recommendedMinuteText: `The meeting discussed ${topic.toLowerCase()}. Members reviewed the relevant considerations and noted any required follow-up for the responsible person or committee.`,
    };
  });

  return {
    id: `demo-meeting-analysis-${Date.now()}`,
    meetingId,
    rawNotes,
    professionalSummary: `The meeting reviewed ${topicBriefings.map(item => item.topic).join(', ')}. Discussion focused on clarifying responsibilities, confirming decisions where noted, and identifying follow-up items for the appropriate committee or board member.`,
    topicBriefings,
    decisions: decisionCandidates.map(sentence => stripPrefix(sentence)),
    motionsMentioned: motionCandidates.map(sentence => stripPrefix(sentence)),
    actionItems,
    risksOrFollowUps: sentences
      .filter(sentence => /\b(risk|concern|blocked|waiting|follow up|follow-up)\b/i.test(sentence))
      .map(sentence => stripPrefix(sentence)),
    confidenceNotes: ['Demo analysis expands terse notes into professional draft language. Review names, dates, motions, and approvals before saving.'],
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
