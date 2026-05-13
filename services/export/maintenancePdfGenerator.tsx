import React from 'react';
import { Document, Page, StyleSheet, Text, View } from '@react-pdf/renderer';
import type { MaintenanceRequest, Tenant, Unit } from '../../types';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#334155' },
  header: { borderBottomWidth: 2, borderBottomColor: '#14b8a6', paddingBottom: 12, marginBottom: 20 },
  eyebrow: { fontSize: 8, color: '#0d9488', textTransform: 'uppercase', letterSpacing: 1.8, marginBottom: 4 },
  title: { fontSize: 20, fontWeight: 'bold', color: '#0f172a' },
  subtitle: { fontSize: 9, color: '#64748b', marginTop: 4 },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 10, fontWeight: 'bold', color: '#0f172a', backgroundColor: '#f1f5f9', padding: 6, textTransform: 'uppercase', marginBottom: 8 },
  grid: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  box: { flex: 1, backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, padding: 10 },
  label: { fontSize: 7, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 },
  value: { fontSize: 11, color: '#0f172a', fontWeight: 'bold' },
  body: { lineHeight: 1.5 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: { backgroundColor: '#ccfbf1', color: '#0f766e', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase' },
  note: { borderLeftWidth: 3, borderLeftColor: '#14b8a6', backgroundColor: '#f8fafc', padding: 10, marginBottom: 8 },
  noteMeta: { fontSize: 8, color: '#64748b', marginBottom: 4, fontWeight: 'bold' },
  attachment: { borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: '#f8fafc', padding: 10, marginBottom: 8 },
  attachmentName: { fontSize: 9, color: '#0f766e', fontWeight: 'bold', marginBottom: 4 },
  muted: { color: '#64748b' },
  footer: { position: 'absolute', bottom: 28, left: 40, right: 40, borderTopWidth: 1, borderTopColor: '#e2e8f0', paddingTop: 8, fontSize: 8, color: '#94a3b8', flexDirection: 'row', justifyContent: 'space-between' },
});

const formatDate = (value?: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

type MaintenanceRequestPDFProps = {
  request: MaintenanceRequest;
  unit?: Unit;
  tenant?: Tenant;
  exportedBy?: string;
};

const getAttachmentFileName = (attachment: any, index: number) =>
  String(attachment?.fileName || attachment?.storageKey || attachment?.url || attachment?.storageUrl || `Photo ${index + 1}`);

const getAttachmentVisualDescription = (request: MaintenanceRequest, attachment: any, attachmentCount: number) =>
  String(attachment?.visualDescription || (attachmentCount === 1 ? request.visualDescription || '' : '')).trim();

export const MaintenanceRequestPDF: React.FC<MaintenanceRequestPDFProps> = ({ request, unit, tenant, exportedBy }) => {
  const attachments = Array.isArray(request.attachments)
    ? request.attachments.filter((item: any) => item?.fileName || item?.url || item?.storageUrl || item?.visualDescription)
    : [];

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Maintenance Work Order</Text>
        <Text style={styles.title}>{request.title || 'Maintenance Request'}</Text>
        <Text style={styles.subtitle}>Request ID: {request.id} | Exported {formatDateTime(new Date().toISOString())}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Request Summary</Text>
        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.label}>Status</Text>
            <Text style={styles.value}>{request.status}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Priority</Text>
            <Text style={styles.value}>{request.priority}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Filed</Text>
            <Text style={styles.value}>{formatDate(request.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.grid}>
          <View style={styles.box}>
            <Text style={styles.label}>Location</Text>
            <Text style={styles.value}>{unit ? `Unit ${unit.number}` : request.unitId}</Text>
          </View>
          <View style={styles.box}>
            <Text style={styles.label}>Submitted By</Text>
            <Text style={styles.value}>{tenant ? `${tenant.firstName} ${tenant.lastName}` : request.requestedBy || 'System User'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Service Types</Text>
        <View style={styles.tagRow}>
          {request.category.map((category) => <Text key={category} style={styles.tag}>{category}</Text>)}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.body}>{request.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Photo Documentation</Text>
        {attachments.length > 0 ? attachments.map((attachment: any, index: number) => {
          const visualDescription = getAttachmentVisualDescription(request, attachment, attachments.length);
          return (
            <View key={attachment.id || getAttachmentFileName(attachment, index)} style={styles.attachment}>
              <Text style={styles.attachmentName}>{getAttachmentFileName(attachment, index)}</Text>
              <Text style={styles.body}>
                <Text style={styles.muted}>Image description: </Text>
                {visualDescription || 'No AI visual description was saved for this photo.'}
              </Text>
            </View>
          );
        }) : (
          <Text style={styles.body}>No photos are attached to this request.</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Activity Log</Text>
        {(request.notes || []).length > 0 ? (request.notes || []).map((note) => (
          <View key={note.id} style={styles.note}>
            <Text style={styles.noteMeta}>{note.author} | {formatDateTime(note.date)}</Text>
            <Text style={styles.body}>{note.content}</Text>
          </View>
        )) : (
          <Text style={styles.body}>No activity has been logged yet.</Text>
        )}
      </View>

      <View style={styles.footer}>
        <Text>coopHUB BC maintenance record</Text>
        <Text>{exportedBy ? `Exported by ${exportedBy}` : 'Authorized export'}</Text>
      </View>
      </Page>
    </Document>
  );
};
