import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMeetingAnalysisFormPatch } from '../utils/meetingAnalysisFormMapping.ts';

test('quick meeting analysis keeps discussion overview separate from decisions', () => {
  const patch = buildMeetingAnalysisFormPatch({
    meetingType: 'quick',
    analysis: {
      professionalSummary: 'Members discussed the proposed community garden, including design considerations and volunteer needs.',
      topicBriefings: [
        {
          topic: 'Community garden',
          context: '',
          discussionSummary: '',
          implications: '',
          recommendedMinuteText: 'Bob proposed creating a community garden space at the front of the property. Members discussed site layout, possible City support for trees, volunteer participation, and forming a committee to bring back a plan.',
        },
      ],
      decisions: ['The proposal was referred to a committee for further planning.'],
      risksOrFollowUps: ['Confirm the committee mandate and proposed timeline.'],
      confidenceNotes: [],
    },
    previousFormData: {
      discussionOverview: '',
      keyDecisions: '',
      nextSteps: '',
    },
  });

  assert.match(patch.discussionOverview, /community garden space/);
  assert.match(patch.discussionOverview, /site layout/);
  assert.match(patch.keyDecisions, /referred to a committee/);
  assert.doesNotMatch(patch.keyDecisions, /Members discussed site layout/);
  assert.match(patch.nextSteps, /Confirm the committee mandate/);
});
