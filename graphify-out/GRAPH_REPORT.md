# Graph Report - C:\Users\Joe\Desktop\Coop103\coop1.03  (2026-04-26)

## Corpus Check
- 59 files · ~79,563 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 271 nodes · 228 edges · 77 communities detected
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 22 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 54|Community 54]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 61|Community 61]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]
- [[_COMMUNITY_Community 73|Community 73]]
- [[_COMMUNITY_Community 74|Community 74]]
- [[_COMMUNITY_Community 75|Community 75]]
- [[_COMMUNITY_Community 76|Community 76]]

## God Nodes (most connected - your core abstractions)
1. `showAlert()` - 6 edges
2. `showNotification()` - 6 edges
3. `Personal Information Protection Act (PIPA)` - 6 edges
4. `persistUpdate()` - 5 edges
5. `showAlert()` - 5 edges
6. `Board of Directors` - 5 edges
7. `get()` - 4 edges
8. `isFolderWithinRoot()` - 3 edges
9. `showAlert()` - 3 edges
10. `showAlert()` - 3 edges

## Surprising Connections (you probably didn't know these)
- `startServer()` --calls--> `get()`  [INFERRED]
  C:\Users\Joe\Desktop\Coop103\coop1.03\server.ts → C:\Users\Joe\Desktop\Coop103\coop1.03\Testing Scenarios\verify_demo_persistence_cjs.mjs
- `isFolderWithinRoot()` --calls--> `get()`  [INFERRED]
  C:\Users\Joe\Desktop\Coop103\coop1.03\api\drive.ts → C:\Users\Joe\Desktop\Coop103\coop1.03\Testing Scenarios\verify_demo_persistence_cjs.mjs
- `isFolderWithinRoot()` --calls--> `driveClient()`  [INFERRED]
  C:\Users\Joe\Desktop\Coop103\coop1.03\api\drive.ts → C:\Users\Joe\Desktop\Coop103\coop1.03\services\googleDrive.ts
- `getBaseUrl()` --calls--> `get()`  [INFERRED]
  C:\Users\Joe\Desktop\Coop103\coop1.03\api\index.ts → C:\Users\Joe\Desktop\Coop103\coop1.03\Testing Scenarios\verify_demo_persistence_cjs.mjs
- `if()` --calls--> `showAlert()`  [INFERRED]
  C:\Users\Joe\Desktop\Coop103\coop1.03\pages\EventDetail.tsx → C:\Users\Joe\Desktop\Coop103\coop1.03\pages\Waitlist.tsx

## Hyperedges (group relationships)
- **PIPA Compliance Framework** — 1290_pipa_overview_of_contents_pipa, 1310_ten_principles_of_personal_information_protection_accountability, 1510_pipa_record_keeping_tips_data_retention, 1570_a_guide_to_b_privacy_officer [INFERRED 0.95]
- **Board Governance Structure** — 1580_board_of_directors_job_description_sample_board_of_directors, 1600_board__president_and_vice_president_job_description_sample_president, 1660_board_treasurer_job_description_sample_treasurer, 1620__chair_job_description_sample_chair [EXTRACTED 1.00]
- **General Meeting Governance** — 210_agm, 290_sagm, 300_sgm, 2830_quorum, 040_rules_of_order [INFERRED 0.95]
- **Membership Termination Appeal Process** — 370_appeal_of_membership_termination_checklist_termination_appeal_checklist, 380_appeal_of_membership_termination_agenda_sample_copy_termination_appeal_agenda, 400_appeal_of_membership_termination_breach_notice_sample_termination_appeal_breach_notice, 420_appeal_of_membership_termination_conduct_notice_sample_termination_appeal_conduct_notice [EXTRACTED 1.00]
- **Removal of Director Process** — 440_removal_of_director_meeting_checklist_removal_of_director_checklist, 460_removal_of_director_meeting_notice_sample_removal_of_director_notice, 480_removal_of_director_meeting_agenda_sample_removal_of_director_agenda [EXTRACTED 1.00]
- **Member Life Transition Procedures** — 2380_flowchart_procedure_when_a_member_is_placed_in_care_member_placed_in_care_flowchart, 2382_flowchart_procedure_when_a_member_dies_member_death_flowchart, 2390_community_care_guidelines_community_care_committee_guidelines [INFERRED 0.85]
- **Election Governance Flow** — 680_preparing_for_the_election_election_workflow, 690_nominations_committee_committee_job_description, 770_candidates_declaration_candidate_eligibility, 840_arrears_report_disqualification_criteria [EXTRACTED 1.00]
- **Member Involvement Framework** — 2480_good_policies_policy_guidelines, 2490_end_of_participation_participation_myths, 2500_beyond_participation_member_involvement [INFERRED 0.90]

## Communities

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (6): isFolderWithinRoot(), driveClient(), getAuthClient(), getBaseUrl(), startServer(), get()

### Community 1 - "Community 1"
Cohesion: 0.17
Nodes (6): createPicker(), handleDownload(), handleOpenPicker(), handleSaveReview(), handleSimulatedUpload(), showAlert()

### Community 2 - "Community 2"
Cohesion: 0.17
Nodes (0): 

### Community 3 - "Community 3"
Cohesion: 0.18
Nodes (2): formatEventDateOnly(), parseEventDate()

### Community 4 - "Community 4"
Cohesion: 0.22
Nodes (0): 

### Community 5 - "Community 5"
Cohesion: 0.42
Nodes (8): addExpense(), addNote(), confirmStatusChange(), handleReopen(), handleStatusChange(), persistUpdate(), showAlert(), toggleCategory()

### Community 6 - "Community 6"
Cohesion: 0.39
Nodes (7): createPicker(), handleMoveIn(), handleMoveOut(), handleOpenPicker(), handleSeedPreventative(), handleTransfer(), showNotification()

### Community 7 - "Community 7"
Cohesion: 0.43
Nodes (6): handleAddCommittee(), handleAssignMember(), handleScheduleMeeting(), handleSendMessage(), handleUploadMinute(), showAlert()

### Community 8 - "Community 8"
Cohesion: 0.25
Nodes (8): Cooperative Association Act, Model Rules 2.0, Acknowledgement of Receipt of Rules and Occupancy Agreement, Board of Directors, Board President and Vice President, Board Treasurer, Ethical Conduct Declaration, Democratic Member Control

### Community 9 - "Community 9"
Cohesion: 0.38
Nodes (3): approveQuote(), handleSubmit(), showAlert()

### Community 10 - "Community 10"
Cohesion: 0.29
Nodes (7): Personal Information Protection Act (PIPA), Accountability Principle, Consent Principle, Confidentiality Agreement Sample, Privacy Officer Role, Staff Confidentiality Agreement, Member Selection Process

### Community 11 - "Community 11"
Cohesion: 0.29
Nodes (7): Rules of Order, Annual General Meeting (AGM), Cooperative Association Act (BC), Ordinary Resolution, Special Resolution, Semi-Annual General Meeting (SAGM), Special General Meeting (SGM)

### Community 12 - "Community 12"
Cohesion: 0.33
Nodes (0): 

### Community 13 - "Community 13"
Cohesion: 0.33
Nodes (6): Checklist: Appeal of Membership Termination, Agenda: Appeal of Membership Termination, Notice: Termination Appeal (Breach of Material Condition), Notice: Termination Appeal (Conduct Detrimental), Entity: CHF BC, Entity: Personal Information Protection Act (PIPA)

### Community 14 - "Community 14"
Cohesion: 0.33
Nodes (6): Overview: Information Meeting, Invitation: Information Meeting, Overview: Town Hall Meeting, Agenda: Board of Directors Meeting, Checklist: First Board Meeting After AGM, Concept: Asset Management Plan

### Community 15 - "Community 15"
Cohesion: 0.5
Nodes (2): handleComplete(), handleNext()

### Community 16 - "Community 16"
Cohesion: 0.5
Nodes (3): if(), handleAddApplication(), showAlert()

### Community 17 - "Community 17"
Cohesion: 0.5
Nodes (0): 

### Community 18 - "Community 18"
Cohesion: 0.67
Nodes (2): handleAttend(), showAlert()

### Community 19 - "Community 19"
Cohesion: 0.5
Nodes (0): 

### Community 20 - "Community 20"
Cohesion: 0.5
Nodes (0): 

### Community 21 - "Community 21"
Cohesion: 0.5
Nodes (0): 

### Community 22 - "Community 22"
Cohesion: 0.5
Nodes (4): Election Preparation Workflow, Nominations Committee Job Description, Candidate's Declaration and Eligibility, Arrears Report and Disqualification

### Community 23 - "Community 23"
Cohesion: 0.67
Nodes (0): 

### Community 24 - "Community 24"
Cohesion: 0.67
Nodes (0): 

### Community 25 - "Community 25"
Cohesion: 1.0
Nodes (2): calculateAverageDaysOpen(), Reports()

### Community 26 - "Community 26"
Cohesion: 0.67
Nodes (0): 

### Community 27 - "Community 27"
Cohesion: 0.67
Nodes (0): 

### Community 28 - "Community 28"
Cohesion: 0.67
Nodes (3): Co-op Marketing Strategies, Membership Application Form, Interviewer's Guide

### Community 29 - "Community 29"
Cohesion: 0.67
Nodes (3): Meeting Minutes, Board of Directors, Fiduciary Duty

### Community 30 - "Community 30"
Cohesion: 0.67
Nodes (3): Checklist: Removal of Director, Notice: Removal of Director Meeting, Agenda: Removal of Director Meeting

### Community 31 - "Community 31"
Cohesion: 0.67
Nodes (3): Flowchart: Member Placed in Care Procedure, Flowchart: Member Death Procedure, Guidelines: Community Care Committee

### Community 32 - "Community 32"
Cohesion: 0.67
Nodes (3): Policy: Parking, Rationale: Parking Policy Discussion Notes, Invitation: Town Hall Meeting (Parking Policy)

### Community 33 - "Community 33"
Cohesion: 0.67
Nodes (3): Pet Policy Sample, Pet Policy Rationale, Good Policies Guidelines

### Community 34 - "Community 34"
Cohesion: 1.0
Nodes (0): 

### Community 35 - "Community 35"
Cohesion: 1.0
Nodes (0): 

### Community 36 - "Community 36"
Cohesion: 1.0
Nodes (0): 

### Community 37 - "Community 37"
Cohesion: 1.0
Nodes (0): 

### Community 38 - "Community 38"
Cohesion: 1.0
Nodes (0): 

### Community 39 - "Community 39"
Cohesion: 1.0
Nodes (0): 

### Community 40 - "Community 40"
Cohesion: 1.0
Nodes (0): 

### Community 41 - "Community 41"
Cohesion: 1.0
Nodes (0): 

### Community 42 - "Community 42"
Cohesion: 1.0
Nodes (0): 

### Community 43 - "Community 43"
Cohesion: 1.0
Nodes (0): 

### Community 44 - "Community 44"
Cohesion: 1.0
Nodes (0): 

### Community 45 - "Community 45"
Cohesion: 1.0
Nodes (0): 

### Community 46 - "Community 46"
Cohesion: 1.0
Nodes (0): 

### Community 47 - "Community 47"
Cohesion: 1.0
Nodes (0): 

### Community 48 - "Community 48"
Cohesion: 1.0
Nodes (0): 

### Community 49 - "Community 49"
Cohesion: 1.0
Nodes (2): Seven Myths of Participation, Real Member Involvement

### Community 50 - "Community 50"
Cohesion: 1.0
Nodes (2): Sustainability Policy Principles, Sustainability Sample Actions

### Community 51 - "Community 51"
Cohesion: 1.0
Nodes (2): Record of Ballot - Removal of Director, Record of Ballot - Appeal of Termination

### Community 52 - "Community 52"
Cohesion: 1.0
Nodes (0): 

### Community 53 - "Community 53"
Cohesion: 1.0
Nodes (0): 

### Community 54 - "Community 54"
Cohesion: 1.0
Nodes (0): 

### Community 55 - "Community 55"
Cohesion: 1.0
Nodes (0): 

### Community 56 - "Community 56"
Cohesion: 1.0
Nodes (0): 

### Community 57 - "Community 57"
Cohesion: 1.0
Nodes (0): 

### Community 58 - "Community 58"
Cohesion: 1.0
Nodes (0): 

### Community 59 - "Community 59"
Cohesion: 1.0
Nodes (0): 

### Community 60 - "Community 60"
Cohesion: 1.0
Nodes (0): 

### Community 61 - "Community 61"
Cohesion: 1.0
Nodes (0): 

### Community 62 - "Community 62"
Cohesion: 1.0
Nodes (0): 

### Community 63 - "Community 63"
Cohesion: 1.0
Nodes (0): 

### Community 64 - "Community 64"
Cohesion: 1.0
Nodes (0): 

### Community 65 - "Community 65"
Cohesion: 1.0
Nodes (0): 

### Community 66 - "Community 66"
Cohesion: 1.0
Nodes (0): 

### Community 67 - "Community 67"
Cohesion: 1.0
Nodes (1): PIPA Audit Program

### Community 68 - "Community 68"
Cohesion: 1.0
Nodes (1): PIPA Record Keeping Tips

### Community 69 - "Community 69"
Cohesion: 1.0
Nodes (1): Office of the Information and Privacy Commissioner (OIPC)

### Community 70 - "Community 70"
Cohesion: 1.0
Nodes (1): Meeting Chair

### Community 71 - "Community 71"
Cohesion: 1.0
Nodes (1): CHF BC Delegate

### Community 72 - "Community 72"
Cohesion: 1.0
Nodes (1): Member Manual

### Community 73 - "Community 73"
Cohesion: 1.0
Nodes (1): Quorum

### Community 74 - "Community 74"
Cohesion: 1.0
Nodes (1): Member Complaint Form

### Community 75 - "Community 75"
Cohesion: 1.0
Nodes (1): Video Surveillance Discussion Notes

### Community 76 - "Community 76"
Cohesion: 1.0
Nodes (1): Register of Directors

## Knowledge Gaps
- **53 isolated node(s):** `Cooperative Association Act`, `Acknowledgement of Receipt of Rules and Occupancy Agreement`, `Accountability Principle`, `Consent Principle`, `PIPA Audit Program` (+48 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Community 34`** (2 nodes): `createQueryArraySetter()`, `App.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 35`** (2 nodes): `patch_api_coop.py`, `patch_api_file()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 36`** (2 nodes): `patch_api_tenant.py`, `patch_api_file()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 37`** (2 nodes): `patch_server_coop.py`, `patch_server_file()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 38`** (2 nodes): `HelpModal.tsx`, `goTo()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 39`** (2 nodes): `ScrollToTop.tsx`, `ScrollToTop()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 40`** (2 nodes): `AnnouncementDetail()`, `AnnouncementDetail.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 41`** (2 nodes): `Communications.tsx`, `handleCreateAnnouncement()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 42`** (2 nodes): `Login.tsx`, `handleGoogleLogin()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 43`** (2 nodes): `seed.ts`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 44`** (2 nodes): `auditUnit()`, `audit_unit_history.mjs`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 45`** (2 nodes): `verify_residency_logic.mjs`, `runTests()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 46`** (2 nodes): `fix_db.mjs`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 47`** (2 nodes): `fix_db_prisma.mjs`, `main()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 48`** (2 nodes): `test_assistant_api.ts`, `testAssistant()`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 49`** (2 nodes): `Seven Myths of Participation`, `Real Member Involvement`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 50`** (2 nodes): `Sustainability Policy Principles`, `Sustainability Sample Actions`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 51`** (2 nodes): `Record of Ballot - Removal of Director`, `Record of Ballot - Appeal of Termination`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 52`** (1 nodes): `compare_patch.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 53`** (1 nodes): `index.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 54`** (1 nodes): `patch_seed.py`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 55`** (1 nodes): `prisma.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 56`** (1 nodes): `types.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 57`** (1 nodes): `vite.config.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 58`** (1 nodes): `minutes.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 59`** (1 nodes): `AppAlert.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 60`** (1 nodes): `FilterBar.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 61`** (1 nodes): `MinutesBuilder.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 62`** (1 nodes): `ProfileModal.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 63`** (1 nodes): `StatCard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 64`** (1 nodes): `Dashboard.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 65`** (1 nodes): `geminiService.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 66`** (1 nodes): `demoData.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 67`** (1 nodes): `PIPA Audit Program`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 68`** (1 nodes): `PIPA Record Keeping Tips`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 69`** (1 nodes): `Office of the Information and Privacy Commissioner (OIPC)`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 70`** (1 nodes): `Meeting Chair`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 71`** (1 nodes): `CHF BC Delegate`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 72`** (1 nodes): `Member Manual`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 73`** (1 nodes): `Quorum`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 74`** (1 nodes): `Member Complaint Form`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 75`** (1 nodes): `Video Surveillance Discussion Notes`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Community 76`** (1 nodes): `Register of Directors`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **What connects `Cooperative Association Act`, `Acknowledgement of Receipt of Rules and Occupancy Agreement`, `Accountability Principle` to the rest of the system?**
  _53 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11 - nodes in this community are weakly interconnected._