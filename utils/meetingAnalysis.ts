import type { MeetingAnalysis, MeetingAnalysisActionItem, Notification } from '../types';
import { createNotification } from './notifications.js';

const splitSentences = (text: string) =>
  text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(item => item.trim())
    .filter(Boolean);

const stripPrefix = (sentence: string) =>
  sentence.replace(/^(action|todo|follow up|follow-up|decision|motion|topic)\s*[:\-]\s*/i, '').trim();

const toLower = (value: string) => value.toLowerCase();

const findLine = (lines: string[], pattern: RegExp) =>
  lines.find(line => pattern.test(line));

const toSentence = (value: string) => {
  const trimmed = stripPrefix(value).trim();
  if (!trimmed) return '';
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const humanizeTopic = (line: string) => {
  const cleaned = stripPrefix(line)
    .replace(/\bintroduced the idea of\b/i, 'proposed')
    .replace(/\bcreating\b/i, 'creating')
    .trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
};

const createProfessionalProjectAnalysis = (rawNotes: string, meetingId?: string): MeetingAnalysis | null => {
  const lines = splitSentences(rawNotes);
  if (lines.length < 2) return null;

  const proposalLine = findLine(lines, /\b(idea|proposal|proposed|introduced)\b/i);
  if (!proposalLine) return null;

  const seconderLine = findLine(lines, /\bseconded by\b/i);
  const layoutLine = findLine(lines, /\b(layout|design|visual|site plan|plan)\b/i);
  const contributionLine = findLine(lines, /\b(city|municipal|contribute|donate|no cost|free|grant)\b/i);
  const volunteerLine = findLine(lines, /\b(volunteer|volunteers|participation)\b/i);
  const committeeLine = findLine(lines, /\b(committee|working group|stood up|establish)\b/i);

  const proposalText = humanizeTopic(proposalLine);
  const seconder = seconderLine?.match(/\bseconded by\s+(.+)$/i)?.[1]?.trim();
  const topic = proposalText.replace(/\.$/, '');
  const topicLower = topic.toLowerCase();
  const supportingDetails = [
    layoutLine ? 'the need to consider the visual layout and site design' : '',
    contributionLine ? `${toLower(toSentence(contributionLine))}` : '',
    volunteerLine ? 'the need to identify volunteers to support planning and implementation' : '',
    committeeLine ? 'the need to establish a committee or working group to develop the plan' : '',
  ].filter(Boolean);

  const professionalSummary = [
    `${proposalText} ${seconder ? `The proposal was seconded by ${seconder}.` : ''}`.trim(),
    `Discussion focused on whether the idea should be developed into a more complete plan before any final approval or implementation decision is made.${supportingDetails.length ? ` Key considerations included ${supportingDetails.join('; ')}.` : ''}`,
    'The matter should be carried forward as a planning item, with responsibility assigned for developing a clear layout, confirming available municipal support, identifying volunteers, and returning to the meeting with a recommended approach.',
  ].join('\n\n');

  const topicBriefings = [{
    topic,
    context: `${proposalText} ${seconder ? `The proposal received a seconder from ${seconder}, indicating sufficient interest for further consideration.` : 'The notes indicate preliminary interest, but do not record a final decision.'}`.trim(),
    discussionSummary: `Members discussed ${topicLower} and identified practical planning considerations that would need to be resolved before proceeding. The notes indicate that visual layout, available contributions from the City, volunteer participation, and committee oversight were all raised as relevant factors.`,
    implications: 'Before implementation, the co-op should confirm the proposed location and layout, clarify any City contribution, recruit interested volunteers, and define the mandate of the committee or working group responsible for bringing back a plan.',
    recommendedMinuteText: `${proposalText} ${seconder ? `The proposal was seconded by ${seconder}.` : ''} Members discussed the need to develop the concept further, including the visual layout of the space, possible City support for trees at no cost, volunteer participation, and the creation of a committee or working group to prepare a plan for further review.`.trim(),
  }];

  const actionItems = [
    committeeLine ? {
      id: `demo-action-${Date.now()}-committee`,
      description: `Establish a committee or working group to develop the proposal for ${topicLower} and bring a plan back for review.`,
      committee: 'Planning Committee',
      priority: 'High' as const,
      sourceSnippet: committeeLine,
    } : null,
    layoutLine ? {
      id: `demo-action-${Date.now()}-layout`,
      description: `Prepare an initial visual layout or site concept for ${topicLower}.`,
      priority: 'Medium' as const,
      sourceSnippet: layoutLine,
    } : null,
    volunteerLine ? {
      id: `demo-action-${Date.now()}-volunteers`,
      description: 'Identify volunteers interested in supporting planning and potential implementation.',
      priority: 'Medium' as const,
      sourceSnippet: volunteerLine,
    } : null,
    contributionLine ? {
      id: `demo-action-${Date.now()}-city`,
      description: 'Confirm the City contribution, including the availability, type, and timing of trees offered at no cost.',
      priority: 'Medium' as const,
      sourceSnippet: contributionLine,
    } : null,
  ].filter(Boolean) as MeetingAnalysisActionItem[];

  return {
    id: `demo-meeting-analysis-${Date.now()}`,
    meetingId,
    rawNotes,
    professionalSummary,
    topicBriefings,
    decisions: [],
    motionsMentioned: seconder
      ? [`${proposalText} The proposal was seconded by ${seconder}. The notes do not record whether the motion was carried, defeated, tabled, or referred.`]
      : [],
    actionItems,
    risksOrFollowUps: [
      'Confirm whether the proposal was formally approved, referred to committee, or tabled for further discussion.',
      'Clarify the proposed location, layout, volunteer requirements, and any municipal contribution before implementation.',
    ],
    confidenceNotes: [
      'The notes identify a proposal and seconder, but do not state the final outcome of the motion.',
      'Committee name, membership, deadlines, budget implications, and approval status should be confirmed before finalizing the minutes.',
    ],
    createdBy: 'demo-admin',
    createdAt: new Date().toISOString(),
  };
};

export const createDemoMeetingAnalysis = (rawNotes: string, meetingId?: string): MeetingAnalysis => {
  const sentences = splitSentences(rawNotes);
  const professionalProjectAnalysis = createProfessionalProjectAnalysis(rawNotes, meetingId);
  if (professionalProjectAnalysis) return professionalProjectAnalysis;

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
