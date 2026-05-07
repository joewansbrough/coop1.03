import type { MeetingAnalysis } from '../types.ts';

type MeetingAnalysisFormPatchInput = {
  meetingType: 'quick' | 'regular' | 'agm' | 'special';
  analysis: Partial<MeetingAnalysis>;
  previousFormData: Record<string, any>;
};

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const paragraphsToHtml = (value?: string) =>
  String(value || '')
    .split(/\n{2,}|\n/)
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => `<p>${escapeHtml(item)}</p>`)
    .join('');

const listToHtml = (items: string[] = []) =>
  items
    .filter(Boolean)
    .map(item => `<p>${escapeHtml(item)}</p>`)
    .join('');

const topicBriefingsToMinutesHtml = (analysis: Partial<MeetingAnalysis>) =>
  Array.isArray(analysis.topicBriefings)
    ? analysis.topicBriefings.map((briefing) => {
      const minutesText = briefing.recommendedMinuteText || briefing.discussionSummary || briefing.context;
      return paragraphsToHtml(minutesText);
    }).join('')
    : '';

export const buildMeetingAnalysisFormPatch = ({
  meetingType,
  analysis,
  previousFormData,
}: MeetingAnalysisFormPatchInput): Record<string, string> => {
  const decisionsHtml = listToHtml(analysis.decisions || []);
  const risksHtml = listToHtml(analysis.risksOrFollowUps || []);
  const confidenceHtml = listToHtml(analysis.confidenceNotes || []);
  const topicBriefingsHtml = topicBriefingsToMinutesHtml(analysis);
  const summaryHtml = paragraphsToHtml(analysis.professionalSummary);
  const shouldUseTopicMinutes = topicBriefingsHtml && !analysis.professionalSummary;

  if (meetingType === 'quick') {
    return {
      discussionOverview: topicBriefingsHtml || summaryHtml || previousFormData.discussionOverview,
      keyDecisions: decisionsHtml || previousFormData.keyDecisions,
      ...(risksHtml || confidenceHtml ? { nextSteps: `${risksHtml}${confidenceHtml}` } : {}),
    };
  }

  const summaryPatch =
    meetingType === 'special'
      ? { newBusiness: analysis.professionalSummary || previousFormData.newBusiness }
      : meetingType === 'agm'
        ? { managementReport: analysis.professionalSummary || previousFormData.managementReport }
        : { boardReport: analysis.professionalSummary || previousFormData.boardReport };

  return {
    ...summaryPatch,
    ...(shouldUseTopicMinutes && meetingType === 'regular' ? { committeeReports: topicBriefingsHtml } : {}),
    ...(decisionsHtml ? { keyDecisions: decisionsHtml } : {}),
    ...(risksHtml || confidenceHtml ? { nextSteps: `${risksHtml}${confidenceHtml}` } : {}),
  };
};
