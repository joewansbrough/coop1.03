import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts to support bold/italic
// Using standard PDF fonts is safer for broad compatibility, 
// butfontWeight bold needs to be explicitly handled if not using Font.register
Font.register({
  family: 'Helvetica-Bold',
  src: 'https://cdn.jsdelivr.net/gh/webfont-kit/helvetica-new@master/fonts/helvetica-bold.ttf'
});

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#334155', // slate-700
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: 2,
    borderBottomColor: '#14b8a6', // brand-500
    paddingBottom: 10,
    marginBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoIcon: {
    fontSize: 24,
    color: '#0d9488', // brand-600
  },
  coopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a', // slate-900
    textTransform: 'uppercase',
  },
  meetingTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748b', // slate-500
    textAlign: 'right',
  },
  section: {
    marginBottom: 15,
  },
  keepTogetherSection: {
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    backgroundColor: '#f1f5f9', // slate-100
    padding: 5,
    marginBottom: 8,
    textTransform: 'uppercase',
    color: '#0f172a',
  },
  row: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  label: {
    width: 120,
    fontWeight: 'bold',
    color: '#64748b',
  },
  value: {
    flex: 1,
  },
  richText: {
    lineHeight: 1.5,
    marginBottom: 10,
  },
  reportCard: {
    padding: 10,
    backgroundColor: '#f8fafc',
    borderLeft: 3,
    borderLeftColor: '#94a3b8',
    marginBottom: 10,
  },
  reportTitle: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#0f172a',
  },
  motionCard: {
    padding: 10,
    backgroundColor: '#f8fafc',
    borderLeft: 3,
    borderLeftColor: '#0d9488',
    marginBottom: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: 1,
    borderTopColor: '#e2e8f0',
    paddingTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 8,
    color: '#94a3b8',
  },
  approval: {
    fontWeight: 'bold',
    color: '#0d9488',
  }
});

// Helper to parse simple HTML to react-pdf components
const parseHtmlToPdf = (html: string) => {
  if (!html) return <Text></Text>;
  
  // Basic cleanup
  let sanitized = html
    .replace(/<\/p>|<div>/gi, '\n')
    .replace(/<br\/?>/gi, '\n')
    .replace(/&nbsp;/g, ' ');

  const parts = sanitized.split(/(<[^>]+>)/g);
  let isBold = false;
  let isItalic = false;

  return (
    <Text style={styles.richText}>
      {parts.map((part, index) => {
        if (part.match(/<strong|<b/i)) {
          isBold = true;
          return null;
        } else if (part.match(/<\/strong>|<\/b>/i)) {
          isBold = false;
          return null;
        } else if (part.match(/<em|<i/i)) {
          isItalic = true;
          return null;
        } else if (part.match(/<\/em>|<\/i>/i)) {
          isItalic = false;
          return null;
        } else if (!part.startsWith('<')) {
          return (
            <Text key={index} style={{ 
              fontWeight: isBold ? 'bold' : 'normal',
              fontStyle: isItalic ? 'italic' : 'normal'
            }}>
              {part}
            </Text>
          );
        }
        return null;
      })}
    </Text>
  );
};

interface PDFMinutesProps {
  data: any;
  event: any;
}

export const MinutesPDF: React.FC<PDFMinutesProps> = ({ data, event }) => {
  const formData = data.formData || data.data || {};
  const guestNames = Array.isArray(formData.guests) ? formData.guests.filter((name: string) => name?.trim()) : [];
  const attendeeRecords = (data.attendees || []).filter((attendee: any) => attendee?.name?.trim());
  const attendees = attendeeRecords.length > 0
    ? attendeeRecords
    : data.meetingType === 'quick'
      ? guestNames.map((name: string) => ({ name, position: '' }))
      : [];
  const motions = data.motions || [];
  const meetingType = data.meetingType;
  const linkedDocuments = Array.isArray(formData.linkedDocuments)
    ? formData.linkedDocuments
    : formData.linkedDocument
      ? [formData.linkedDocument]
      : [];
  const actionItems = Array.isArray(formData.actionItemsList)
    ? formData.actionItemsList.filter((item: any) => item?.description?.trim() || item?.responsible?.length || item?.dueDate)
    : [];
  const reports = [
    { title: 'Board Report', content: formData.boardReport },
    { title: 'Financial Report', content: formData.financeReport },
    { title: 'Committee Reports', content: formData.committeeReports },
  ].filter((report) => report.content);
  const hasElectionDetails = Boolean(
    formData.totalSeats ||
    formData.vacancies ||
    formData.candidates ||
    formData.nominations ||
    formData.electionResults ||
    formData.scrutineers?.length > 0 ||
    formData.ballotsDisposed
  );

  const getMeetingLabel = (type: string) => {
    switch (type) {
      case 'quick': return 'Quick Meeting';
      case 'regular': return 'Regular Board Meeting';
      case 'agm': return 'Annual General Meeting';
      case 'special': return 'Special General Meeting';
      default: return 'Meeting Minutes';
    }
  };

  const formatTime12h = (time?: string) => {
    if (!time) return 'N/A';
    const [hoursValue, minutesValue = '00'] = time.split(':');
    const hours = Number(hoursValue);
    if (Number.isNaN(hours)) return time;
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutesValue.padStart(2, '0')} ${suffix}`;
  };

  const formatDateOnly = (date?: string) => {
    if (!date) return 'No due date';
    const [year, month, day] = date.split('-').map(Number);
    if (!year || !month || !day) return date;
    return new Date(year, month - 1, day).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoIcon}>🍃</Text>
            <Text style={styles.coopName}>Oak Bay Housing Co-op</Text>
          </View>
          <View>
            <Text style={styles.meetingTitle}>{getMeetingLabel(meetingType)}</Text>
            <Text style={styles.meetingTitle}>{formData.meetingDate || event.date.split('T')[0]}</Text>
          </View>
        </View>

        {/* Meeting Details */}
        <View style={styles.keepTogetherSection} wrap={false}>
          <Text style={styles.sectionTitle}>Meeting Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.value}>{formData.location || event.location}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Start Time:</Text>
            <Text style={styles.value}>{formatTime12h(formData.startTime || event.time)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Chairperson:</Text>
            <Text style={styles.value}>{formData.chair || 'N/A'}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Minute Taker:</Text>
            <Text style={styles.value}>{formData.minuteTaker || 'N/A'}</Text>
          </View>
        </View>

        {linkedDocuments.length > 0 && (
          <View style={styles.keepTogetherSection} wrap={false}>
            <Text style={styles.sectionTitle}>Linked Documents</Text>
            {linkedDocuments.map((linkedDocument: any, index: number) => (
              <View key={linkedDocument.id || index} style={styles.row}>
                <Text style={styles.label}>Document {index + 1}:</Text>
                <Text style={styles.value}>{linkedDocument.title || 'N/A'}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Attendance */}
        <View style={styles.keepTogetherSection} wrap={false}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Directors/Members Present:</Text>
            <Text style={styles.value}>
              {attendees.map((a: any) => `${a.name}${a.position ? ` (${a.position})` : ''}`).join(', ') || 'N/A'}
            </Text>
          </View>
          {formData.directorsAbsent && formData.directorsAbsent.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Regrets/Absent:</Text>
              <Text style={styles.value}>
                {Array.isArray(formData.directorsAbsent) ? formData.directorsAbsent.join(', ') : formData.directorsAbsent}
              </Text>
            </View>
          )}
          {data.meetingType !== 'quick' && formData.guests && formData.guests.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Guests/Attendees:</Text>
              <Text style={styles.value}>
                {Array.isArray(formData.guests) ? formData.guests.join(', ') : formData.guests}
              </Text>
            </View>
          )}
        </View>

        {(formData.discussionOverview || formData.keyDecisions) && (
          <View style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Key Points</Text>
              {formData.discussionOverview && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportTitle}>Discussion Overview</Text>
                  {parseHtmlToPdf(formData.discussionOverview)}
                </View>
              )}
              {formData.keyDecisions && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportTitle}>Decisions Made</Text>
                  {parseHtmlToPdf(formData.keyDecisions)}
                </View>
              )}
            </View>
          </View>
        )}

        {formData.newBusiness && (
          <View style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Special Business</Text>
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>Purpose of Special Meeting</Text>
                {parseHtmlToPdf(formData.newBusiness)}
              </View>
            </View>
          </View>
        )}

        {formData.auditorReport && (
          <View style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Auditor's Report</Text>
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>Auditor's Report Summary</Text>
                {parseHtmlToPdf(formData.auditorReport)}
              </View>
            </View>
          </View>
        )}

        {hasElectionDetails && (
          <View style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Election of Directors</Text>
              {(formData.totalSeats || formData.vacancies || formData.candidates) && (
                <View style={styles.reportCard}>
                  {formData.totalSeats && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Total Seats:</Text>
                      <Text style={styles.value}>{formData.totalSeats}</Text>
                    </View>
                  )}
                  {formData.vacancies && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Vacancies:</Text>
                      <Text style={styles.value}>{formData.vacancies}</Text>
                    </View>
                  )}
                  {formData.candidates && (
                    <View style={styles.row}>
                      <Text style={styles.label}>Candidates:</Text>
                      <Text style={styles.value}>{formData.candidates}</Text>
                    </View>
                  )}
                </View>
              )}
              {!formData.totalSeats && !formData.vacancies && !formData.candidates && formData.nominations && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportTitle}>Nominations Received</Text>
                  {parseHtmlToPdf(formData.nominations)}
                </View>
              )}
              {!formData.totalSeats && !formData.vacancies && !formData.candidates && !formData.nominations && formData.electionResults && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportTitle}>Election Results</Text>
                  {parseHtmlToPdf(formData.electionResults)}
                </View>
              )}
              {!formData.totalSeats && !formData.vacancies && !formData.candidates && !formData.nominations && !formData.electionResults && formData.scrutineers?.length > 0 && (
                <View style={styles.reportCard}>
                  <Text style={styles.reportTitle}>Scrutineers</Text>
                  <Text>{Array.isArray(formData.scrutineers) ? formData.scrutineers.join(', ') : formData.scrutineers}</Text>
                </View>
              )}
              {!formData.totalSeats && !formData.vacancies && !formData.candidates && !formData.nominations && !formData.electionResults && !formData.scrutineers?.length && formData.ballotsDisposed && (
                <View style={styles.row}>
                  <Text style={styles.label}>Ballots Disposed:</Text>
                  <Text style={styles.value}>Approved</Text>
                </View>
              )}
            </View>
            {(formData.totalSeats || formData.vacancies || formData.candidates) && formData.nominations && (
              <View style={styles.reportCard} wrap={false}>
                <Text style={styles.reportTitle}>Nominations Received</Text>
                {parseHtmlToPdf(formData.nominations)}
              </View>
            )}
            {(formData.totalSeats || formData.vacancies || formData.candidates || formData.nominations) && formData.electionResults && (
              <View style={styles.reportCard} wrap={false}>
                <Text style={styles.reportTitle}>Election Results</Text>
                {parseHtmlToPdf(formData.electionResults)}
              </View>
            )}
            {(formData.totalSeats || formData.vacancies || formData.candidates || formData.nominations || formData.electionResults) && formData.scrutineers?.length > 0 && (
              <View style={styles.reportCard} wrap={false}>
                <Text style={styles.reportTitle}>Scrutineers</Text>
                <Text>{Array.isArray(formData.scrutineers) ? formData.scrutineers.join(', ') : formData.scrutineers}</Text>
              </View>
            )}
            {(formData.totalSeats || formData.vacancies || formData.candidates || formData.nominations || formData.electionResults || formData.scrutineers?.length > 0) && formData.ballotsDisposed && (
              <View style={styles.row}>
                <Text style={styles.label}>Ballots Disposed:</Text>
                <Text style={styles.value}>Approved</Text>
              </View>
            )}
          </View>
        )}

        {/* Reports */}
        {reports.length > 0 && (
          <View style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Reports & Discussion</Text>
              <View style={styles.reportCard}>
                <Text style={styles.reportTitle}>{reports[0].title}</Text>
                {parseHtmlToPdf(reports[0].content)}
              </View>
            </View>
            {reports.slice(1).map((report) => (
              <View key={report.title} style={styles.reportCard} wrap={false}>
                <Text style={styles.reportTitle}>{report.title}</Text>
                {parseHtmlToPdf(report.content)}
              </View>
            ))}
          </View>
        )}

        {/* Motions */}
        {motions.length > 0 && (
          <View style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Motions & Resolutions</Text>
              <View style={styles.motionCard}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Motion #1</Text>
                {parseHtmlToPdf(motions[0].description)}
                <Text style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
                  Moved by: {motions[0].mover} | Seconded by: {motions[0].seconder} | Result: {motions[0].result?.toUpperCase() || 'PENDING'}
                </Text>
              </View>
            </View>
            {motions.slice(1).map((m: any, i: number) => (
              <View key={i + 1} style={styles.motionCard} wrap={false}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Motion #{i + 2}</Text>
                {parseHtmlToPdf(m.description)}
                <Text style={{ fontSize: 9, color: '#64748b', marginTop: 4 }}>
                  Moved by: {m.mover} | Seconded by: {m.seconder} | Result: {m.result?.toUpperCase() || 'PENDING'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Items */}
        {actionItems.length > 0 ? (
          <View style={styles.section}>
            <View wrap={false}>
              <Text style={styles.sectionTitle}>Action Items</Text>
              <View style={styles.motionCard}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Action Item #1</Text>
                <Text style={{ marginBottom: 6 }}>{actionItems[0].description || 'No action described.'}</Text>
                <Text style={{ fontSize: 9, color: '#64748b' }}>
                  Responsible: {Array.isArray(actionItems[0].responsible) && actionItems[0].responsible.length > 0 ? actionItems[0].responsible.join(', ') : 'Unassigned'} | Complete by: {formatDateOnly(actionItems[0].dueDate)}
                </Text>
              </View>
            </View>
            {actionItems.slice(1).map((item: any, i: number) => (
              <View key={item.id || i + 1} style={styles.motionCard} wrap={false}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Action Item #{i + 2}</Text>
                <Text style={{ marginBottom: 6 }}>{item.description || 'No action described.'}</Text>
                <Text style={{ fontSize: 9, color: '#64748b' }}>
                  Responsible: {Array.isArray(item.responsible) && item.responsible.length > 0 ? item.responsible.join(', ') : 'Unassigned'} | Complete by: {formatDateOnly(item.dueDate)}
                </Text>
              </View>
            ))}
          </View>
        ) : formData.actionItems && (
          <View style={styles.section} wrap={false}>
            <Text style={styles.sectionTitle}>Action Items</Text>
            {parseHtmlToPdf(formData.actionItems)}
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text>Oak Bay Housing Co-op Minutes | {formData.meetingDate || event.date.split('T')[0]}</Text>
          <Text style={styles.approval}>✓ Electronically Approved Community Record</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};
