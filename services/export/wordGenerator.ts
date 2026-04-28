import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, AlignmentType, HeadingLevel, Header, Footer, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

// Helper to parse simple HTML to docx TextRuns
const parseHtmlToDocx = (html: string) => {
  if (!html) return [new TextRun("")];
  
  // Replace common block tags with spaces to avoid smashing words together
  let sanitized = html
    .replace(/<\/p>|<br\/?>|<div>/gi, '\n')
    .replace(/&nbsp;/g, ' ');

  const result: TextRun[] = [];
  // Simple regex-based parser for <strong>/<b> and <em>/<i>
  const parts = sanitized.split(/(<[^>]+>)/g);
  
  let isBold = false;
  let isItalic = true; // Wait, no, false

  isItalic = false;

  parts.forEach(part => {
    if (part.match(/<strong| <b/i)) {
      isBold = true;
    } else if (part.match(/<\/strong>|<\/b>/i)) {
      isBold = false;
    } else if (part.match(/<em| <i/i)) {
      isItalic = true;
    } else if (part.match(/<\/em>|<\/i>/i)) {
      isItalic = false;
    } else if (!part.startsWith('<')) {
      // It's text
      if (part.trim() || part.includes('\n')) {
        result.push(new TextRun({
          text: part,
          bold: isBold,
          italics: isItalic,
        }));
      }
    }
  });

  return result.length > 0 ? result : [new TextRun("")];
};

const boldParagraph = (text: string, options: any = {}) => new Paragraph({
  ...options,
  children: [new TextRun({ text, bold: true })],
});

const sectionHeading = (text: string) => new Paragraph({
  text,
  heading: HeadingLevel.HEADING_2,
  shading: { fill: "f1f5f9" },
  keepNext: true,
});

const cardHeading = (text: string) => boldParagraph(text, {
  shading: { fill: "f8fafc" },
  border: {
    left: {
      color: "0d9488",
      space: 4,
      style: BorderStyle.SINGLE,
      size: 12,
    },
  },
  indent: { left: 180 },
  spacing: { before: 120, after: 80 },
  keepNext: true,
});

export const generateMinutesWord = async (data: any, event: any) => {
  const { formData, attendees, motions, meetingType } = data;
  const linkedDocuments = Array.isArray(formData.linkedDocuments)
    ? formData.linkedDocuments
    : formData.linkedDocument
      ? [formData.linkedDocument]
      : [];
  const actionItems = Array.isArray(formData.actionItemsList)
    ? formData.actionItemsList.filter((item: any) => item?.description?.trim() || item?.responsible?.length || item?.dueDate)
    : [];

  const getMeetingLabel = (type: string) => {
    switch (type) {
      case 'quick': return 'Quick Meeting';
      case 'regular': return 'Regular Board Meeting';
      case 'agm': return 'Annual General Meeting';
      case 'special': return 'Special General Meeting';
      default: return 'Meeting Minutes';
    }
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

  const doc = new Document({
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "🍃 OAK BAY HOUSING CO-OP",
                    bold: true,
                    color: "0d9488",
                    size: 28,
                  }),
                ],
                border: {
                  bottom: {
                    color: "14b8a6",
                    space: 1,
                    style: BorderStyle.SINGLE,
                    size: 12,
                  },
                },
                spacing: { after: 200 },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: "✓ Electronically Approved Community Record | Page ",
                    size: 16,
                    color: "94a3b8",
                  }),
                  new TextRun({
                    children: ["PAGE_NUMBER"],
                    size: 16,
                    color: "94a3b8",
                  }),
                  new TextRun({
                    text: " of ",
                    size: 16,
                    color: "94a3b8",
                  }),
                  new TextRun({
                    children: ["TOTAL_PAGES"],
                    size: 16,
                    color: "94a3b8",
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            text: getMeetingLabel(meetingType),
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: formData.meetingDate || event.date.split('T')[0],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),

          // Meeting Info Section
          sectionHeading("MEETING INFORMATION"),
          new Paragraph({
            children: [
              new TextRun({ text: "Location: ", bold: true }),
              new TextRun(formData.location || event.location),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Time: ", bold: true }),
              new TextRun(`${formData.startTime || event.time} - ${formData.endTime || 'N/A'}`),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Chairperson: ", bold: true }),
              new TextRun(formData.chair || 'N/A'),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Minute Taker: ", bold: true }),
              new TextRun(formData.minuteTaker || 'N/A'),
            ],
            spacing: { after: 300 },
          }),

          ...(linkedDocuments.length > 0 ? [
            sectionHeading("LINKED DOCUMENTS"),
            ...linkedDocuments.map((linkedDocument: any, index: number) => new Paragraph({
              children: [
                new TextRun({ text: `Document ${index + 1}: `, bold: true }),
                new TextRun(linkedDocument.title || 'N/A'),
              ],
            })),
            new Paragraph({ text: "", spacing: { after: 200 } }),
          ] : []),

          // Attendance
          sectionHeading("ATTENDANCE"),
          boldParagraph("Directors/Members Present:", { keepNext: true }),
          new Paragraph({
            text: attendees.map((a: any) => `${a.name}${a.position ? ` (${a.position})` : ''}`).join(', '),
            spacing: { after: 200 },
          }),
          ...(formData.directorsAbsent && formData.directorsAbsent.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({ text: "Regrets/Absent: ", bold: true }),
                new TextRun(Array.isArray(formData.directorsAbsent) ? formData.directorsAbsent.join(', ') : formData.directorsAbsent),
              ],
            })
          ] : []),
          ...(formData.guests && formData.guests.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({ text: "Guests/Attendees: ", bold: true }),
                new TextRun(Array.isArray(formData.guests) ? formData.guests.join(', ') : formData.guests),
              ],
            })
          ] : []),
          ...(formData.scrutineers && formData.scrutineers.length > 0 ? [
            new Paragraph({
              children: [
                new TextRun({ text: "Scrutineers: ", bold: true }),
                new TextRun(Array.isArray(formData.scrutineers) ? formData.scrutineers.join(', ') : formData.scrutineers),
              ],
            })
          ] : []),
          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Reports
          ...((formData.boardReport || formData.financeReport || formData.committeeReports) ? [
            sectionHeading("REPORTS & DISCUSSION"),
            ...(formData.boardReport ? [
              cardHeading("Board Report"),
              new Paragraph({ children: parseHtmlToDocx(formData.boardReport), shading: { fill: "f8fafc" }, spacing: { after: 200 }, keepLines: true }),
            ] : []),
            ...(formData.financeReport ? [
              cardHeading("Financial Report"),
              new Paragraph({ children: parseHtmlToDocx(formData.financeReport), shading: { fill: "f8fafc" }, spacing: { after: 200 }, keepLines: true }),
            ] : []),
            ...(formData.committeeReports ? [
              cardHeading("Committee Reports"),
              new Paragraph({ children: parseHtmlToDocx(formData.committeeReports), shading: { fill: "f8fafc" }, spacing: { after: 200 }, keepLines: true }),
            ] : []),
          ] : []),

          // Motions
          ...(motions.length > 0 ? [
            sectionHeading("MOTIONS & RESOLUTIONS"),
            ...motions.flatMap((m: any, i: number) => [
              cardHeading(`Motion #${i + 1}`),
              new Paragraph({ children: parseHtmlToDocx(m.description), keepLines: true }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Moved by: ${m.mover} | Seconded by: ${m.seconder} | Result: ${m.result?.toUpperCase() || 'PENDING'}`, italics: true, size: 18, color: "64748b" }),
                ],
                spacing: { after: 200 },
              })
            ])
          ] : []),

          // Action Items
          ...(actionItems.length > 0 ? [
            sectionHeading("ACTION ITEMS"),
            ...actionItems.flatMap((item: any, i: number) => [
              cardHeading(`Action Item #${i + 1}`),
              new Paragraph({ text: item.description || 'No action described.', keepLines: true }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Responsible: ${Array.isArray(item.responsible) && item.responsible.length > 0 ? item.responsible.join(', ') : 'Unassigned'} | Complete by: ${formatDateOnly(item.dueDate)}`,
                    italics: true,
                    size: 18,
                    color: "64748b",
                  }),
                ],
              }),
              new Paragraph({ text: "" }),
            ]),
          ] : formData.actionItems ? [
            sectionHeading("ACTION ITEMS"),
            new Paragraph({ children: parseHtmlToDocx(formData.actionItems) }),
          ] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Minutes_${formData.meetingDate || event.date.split('T')[0]}.docx`);
};
