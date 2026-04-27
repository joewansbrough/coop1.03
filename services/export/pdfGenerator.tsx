import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register fonts if needed (optional for standard fonts)

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

// Helper to strip HTML tags for PDF rendering (since react-pdf doesn't support HTML)
const stripHtml = (html: string) => {
  if (!html) return '';
  return html
    .replace(/<[^>]*>?/gm, ' ') // Remove tags
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

interface PDFMinutesProps {
  data: any;
  event: any;
}

export const MinutesPDF: React.FC<PDFMinutesProps> = ({ data, event }) => {
  const { formData, attendees, motions, meetingType } = data;

  const getMeetingLabel = (type: string) => {
    switch (type) {
      case 'quick': return 'Quick Meeting';
      case 'regular': return 'Regular Board Meeting';
      case 'agm': return 'Annual General Meeting';
      case 'special': return 'Special General Meeting';
      default: return 'Meeting Minutes';
    }
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
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Meeting Information</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Location:</Text>
            <Text style={styles.value}>{formData.location || event.location}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Time:</Text>
            <Text style={styles.value}>{formData.startTime || event.time} - {formData.endTime || 'N/A'}</Text>
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

        {/* Attendance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance</Text>
          <Text style={{ marginBottom: 5, fontWeight: 'bold' }}>Directors/Members Present:</Text>
          <Text style={{ marginBottom: 10 }}>
            {attendees.map((a: any) => `${a.name}${a.position ? ` (${a.position})` : ''}`).join(', ')}
          </Text>
          {formData.directorsAbsent && formData.directorsAbsent.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Regrets/Absent:</Text>
              <Text style={styles.value}>
                {Array.isArray(formData.directorsAbsent) ? formData.directorsAbsent.join(', ') : formData.directorsAbsent}
              </Text>
            </View>
          )}
          {formData.guests && formData.guests.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Guests/Attendees:</Text>
              <Text style={styles.value}>
                {Array.isArray(formData.guests) ? formData.guests.join(', ') : formData.guests}
              </Text>
            </View>
          )}
          {formData.scrutineers && formData.scrutineers.length > 0 && (
            <View style={styles.row}>
              <Text style={styles.label}>Scrutineers:</Text>
              <Text style={styles.value}>
                {Array.isArray(formData.scrutineers) ? formData.scrutineers.join(', ') : formData.scrutineers}
              </Text>
            </View>
          )}
        </View>

        {/* Reports */}
        {(formData.boardReport || formData.financeReport || formData.committeeReports) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reports & Discussion</Text>
            {formData.boardReport && (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Board Report:</Text>
                <Text style={styles.richText}>{stripHtml(formData.boardReport)}</Text>
              </View>
            )}
            {formData.financeReport && (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Financial Report:</Text>
                <Text style={styles.richText}>{stripHtml(formData.financeReport)}</Text>
              </View>
            )}
            {formData.committeeReports && (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Committee Reports:</Text>
                <Text style={styles.richText}>{stripHtml(formData.committeeReports)}</Text>
              </View>
            )}
          </View>
        )}

        {/* Motions */}
        {motions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Motions & Resolutions</Text>
            {motions.map((m: any, i: number) => (
              <View key={i} style={styles.motionCard}>
                <Text style={{ fontWeight: 'bold', marginBottom: 4 }}>Motion #{i + 1}</Text>
                <Text style={{ marginBottom: 6 }}>{stripHtml(m.description)}</Text>
                <Text style={{ fontSize: 9, color: '#64748b' }}>
                  Moved by: {m.mover} | Seconded by: {m.seconder} | Result: {m.result?.toUpperCase() || 'PENDING'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* Action Items */}
        {formData.actionItems && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Action Items</Text>
            <Text style={styles.richText}>{stripHtml(formData.actionItems)}</Text>
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
