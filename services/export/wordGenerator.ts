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

export const generateMinutesWord = async (data: any, event: any) => {
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
          new Paragraph({
            text: "MEETING INFORMATION",
            heading: HeadingLevel.HEADING_2,
            shading: { fill: "f1f5f9" },
          }),
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

          // Attendance
          new Paragraph({
            text: "ATTENDANCE",
            heading: HeadingLevel.HEADING_2,
            shading: { fill: "f1f5f9" },
          }),
          new Paragraph({
            text: "Directors/Members Present:",
            bold: true,
          }),
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
            new Paragraph({
              text: "REPORTS & DISCUSSION",
              heading: HeadingLevel.HEADING_2,
              shading: { fill: "f1f5f9" },
            }),
            ...(formData.boardReport ? [
              new Paragraph({ text: "Board Report", bold: true }),
              new Paragraph({ children: parseHtmlToDocx(formData.boardReport), spacing: { after: 200 } }),
            ] : []),
            ...(formData.financeReport ? [
              new Paragraph({ text: "Financial Report", bold: true }),
              new Paragraph({ children: parseHtmlToDocx(formData.financeReport), spacing: { after: 200 } }),
            ] : []),
            ...(formData.committeeReports ? [
              new Paragraph({ text: "Committee Reports", bold: true }),
              new Paragraph({ children: parseHtmlToDocx(formData.committeeReports), spacing: { after: 200 } }),
            ] : []),
          ] : []),

          // Motions
          ...(motions.length > 0 ? [
            new Paragraph({
              text: "MOTIONS & RESOLUTIONS",
              heading: HeadingLevel.HEADING_2,
              shading: { fill: "f1f5f9" },
            }),
            ...motions.flatMap((m: any, i: number) => [
              new Paragraph({ text: `Motion #${i + 1}`, bold: true }),
              new Paragraph({ children: parseHtmlToDocx(m.description) }),
              new Paragraph({
                children: [
                  new TextRun({ text: `Moved by: ${m.mover} | Seconded by: ${m.seconder} | Result: ${m.result?.toUpperCase() || 'PENDING'}`, italics: true, size: 18, color: "64748b" }),
                ],
                spacing: { after: 200 },
              })
            ])
          ] : []),

          // Action Items
          ...(formData.actionItems ? [
            new Paragraph({
              text: "ACTION ITEMS",
              heading: HeadingLevel.HEADING_2,
              shading: { fill: "f1f5f9" },
            }),
            new Paragraph({ children: parseHtmlToDocx(formData.actionItems) }),
          ] : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Minutes_${formData.meetingDate || event.date.split('T')[0]}.docx`);
};
