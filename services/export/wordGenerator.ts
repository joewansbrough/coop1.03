import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, AlignmentType, HeadingLevel, Header, Footer, ImageRun } from 'docx';
import { saveAs } from 'file-saver';

const BRAND = {
  font: 'DM Sans',
  text: '0f172a',
  body: '475569',
  muted: '64748b',
  subtle: '94a3b8',
  card: 'f8fafc',
  section: 'f1f5f9',
  teal: '0D9488',
};

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
          font: BRAND.font,
          color: BRAND.body,
          size: 21,
        }));
      }
    }
  });

  return result.length > 0 ? result : [new TextRun("")];
};

const boldParagraph = (text: string, options: any = {}) => new Paragraph({
  ...options,
  children: [new TextRun({ text, bold: true, font: BRAND.font, color: BRAND.text, size: 21 })],
});

const sectionHeading = (text: string) => new Paragraph({
  heading: HeadingLevel.HEADING_2,
  shading: { fill: BRAND.section },
  border: {
    left: {
      color: BRAND.teal,
      space: 6,
      style: BorderStyle.SINGLE,
      size: 16,
    },
  },
  spacing: { before: 260, after: 120 },
  indent: { left: 120 },
  keepNext: true,
  children: [
    new TextRun({
      text,
      bold: true,
      font: BRAND.font,
      color: BRAND.text,
      size: 20,
      allCaps: true,
    }),
  ],
});

const cardHeading = (text: string) => boldParagraph(text, {
  shading: { fill: BRAND.card },
  border: {
    left: {
      color: BRAND.teal,
      space: 4,
      style: BorderStyle.SINGLE,
      size: 12,
    },
  },
  indent: { left: 180 },
  spacing: { before: 120, after: 80 },
  keepNext: true,
});

const labelRun = (text: string) => new TextRun({
  text,
  bold: true,
  font: BRAND.font,
  color: BRAND.muted,
  size: 20,
});

const valueRun = (text: string) => new TextRun({
  text,
  font: BRAND.font,
  color: BRAND.text,
  size: 21,
});

const bodyParagraph = (text: string, options: any = {}) => new Paragraph({
  ...options,
  children: [valueRun(text)],
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
    styles: {
      default: {
        document: {
          run: {
            font: BRAND.font,
            color: BRAND.body,
            size: 21,
          },
          paragraph: {
            spacing: { after: 120 },
          },
        },
      },
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: BRAND.font,
            bold: true,
            color: BRAND.text,
            size: 45,
          },
          paragraph: {
            spacing: { before: 120, after: 140 },
          },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: {
            font: BRAND.font,
            bold: true,
            color: BRAND.text,
            size: 20,
            allCaps: true,
          },
        },
      ],
    },
    sections: [
      {
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "coopHUB BC",
                    bold: true,
                    color: BRAND.teal,
                    font: BRAND.font,
                    size: 28,
                  }),
                  new TextRun({
                    text: " | Oak Bay Housing Co-op",
                    bold: true,
                    color: BRAND.text,
                    font: BRAND.font,
                    size: 22,
                  }),
                ],
                border: {
                  bottom: {
                    color: BRAND.teal,
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
                    color: BRAND.subtle,
                    font: BRAND.font,
                  }),
                  new TextRun({
                    children: ["PAGE_NUMBER"],
                    size: 16,
                    color: BRAND.subtle,
                    font: BRAND.font,
                  }),
                  new TextRun({
                    text: " of ",
                    size: 16,
                    color: BRAND.subtle,
                    font: BRAND.font,
                  }),
                  new TextRun({
                    children: ["TOTAL_PAGES"],
                    size: 16,
                    color: BRAND.subtle,
                    font: BRAND.font,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          // Title
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({
                text: getMeetingLabel(meetingType),
                bold: true,
                font: BRAND.font,
                color: BRAND.text,
                size: 45,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
            children: [
              new TextRun({
                text: formData.meetingDate || event.date.split('T')[0],
                bold: true,
                font: BRAND.font,
                color: BRAND.teal,
                size: 20,
              }),
            ],
          }),

          // Meeting Info Section
          sectionHeading("MEETING INFORMATION"),
          new Paragraph({
            children: [
              labelRun("Location: "),
              valueRun(formData.location || event.location),
            ],
          }),
          new Paragraph({
            children: [
              labelRun("Time: "),
              valueRun(`${formData.startTime || event.time} - ${formData.endTime || 'N/A'}`),
            ],
          }),
          new Paragraph({
            children: [
              labelRun("Chairperson: "),
              valueRun(formData.chair || 'N/A'),
            ],
          }),
          new Paragraph({
            children: [
              labelRun("Minute Taker: "),
              valueRun(formData.minuteTaker || 'N/A'),
            ],
            spacing: { after: 300 },
          }),

          ...(linkedDocuments.length > 0 ? [
            sectionHeading("LINKED DOCUMENTS"),
            ...linkedDocuments.map((linkedDocument: any, index: number) => new Paragraph({
              children: [
                labelRun(`Document ${index + 1}: `),
                valueRun(linkedDocument.title || 'N/A'),
              ],
            })),
            new Paragraph({ text: "", spacing: { after: 200 } }),
          ] : []),

          // Attendance
          sectionHeading("ATTENDANCE"),
          boldParagraph("Directors/Members Present:", { keepNext: true }),
          bodyParagraph(attendees.map((a: any) => `${a.name}${a.position ? ` (${a.position})` : ''}`).join(', '), { spacing: { after: 200 } }),
          ...(formData.directorsAbsent && formData.directorsAbsent.length > 0 ? [
            new Paragraph({
              children: [
                labelRun("Regrets/Absent: "),
                valueRun(Array.isArray(formData.directorsAbsent) ? formData.directorsAbsent.join(', ') : formData.directorsAbsent),
              ],
            })
          ] : []),
          ...(formData.guests && formData.guests.length > 0 ? [
            new Paragraph({
              children: [
                labelRun("Guests/Attendees: "),
                valueRun(Array.isArray(formData.guests) ? formData.guests.join(', ') : formData.guests),
              ],
            })
          ] : []),
          ...(formData.scrutineers && formData.scrutineers.length > 0 ? [
            new Paragraph({
              children: [
                labelRun("Scrutineers: "),
                valueRun(Array.isArray(formData.scrutineers) ? formData.scrutineers.join(', ') : formData.scrutineers),
              ],
            })
          ] : []),
          new Paragraph({ text: "", spacing: { after: 300 } }),

          // Reports
          ...((formData.boardReport || formData.financeReport || formData.committeeReports) ? [
            sectionHeading("REPORTS & DISCUSSION"),
            ...(formData.boardReport ? [
              cardHeading("Board Report"),
              new Paragraph({ children: parseHtmlToDocx(formData.boardReport), shading: { fill: BRAND.card }, spacing: { after: 200 }, keepLines: true }),
            ] : []),
            ...(formData.financeReport ? [
              cardHeading("Financial Report"),
              new Paragraph({ children: parseHtmlToDocx(formData.financeReport), shading: { fill: BRAND.card }, spacing: { after: 200 }, keepLines: true }),
            ] : []),
            ...(formData.committeeReports ? [
              cardHeading("Committee Reports"),
              new Paragraph({ children: parseHtmlToDocx(formData.committeeReports), shading: { fill: BRAND.card }, spacing: { after: 200 }, keepLines: true }),
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
                  new TextRun({ text: `Moved by: ${m.mover} | Seconded by: ${m.seconder} | Result: ${m.result?.toUpperCase() || 'PENDING'}`, italics: true, size: 18, color: BRAND.muted, font: BRAND.font }),
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
              bodyParagraph(item.description || 'No action described.', { keepLines: true }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: `Responsible: ${Array.isArray(item.responsible) && item.responsible.length > 0 ? item.responsible.join(', ') : 'Unassigned'} | Complete by: ${formatDateOnly(item.dueDate)}`,
                    italics: true,
                    size: 18,
                    color: BRAND.muted,
                    font: BRAND.font,
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
