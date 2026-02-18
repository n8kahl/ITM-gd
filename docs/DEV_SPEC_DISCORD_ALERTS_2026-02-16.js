const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageNumber, PageBreak, LevelFormat
} = require("docx");

// ── Design tokens ──
const EMERALD = "10B981";
const DARK_BG = "0F1117";
const DARK_CARD = "1A1D26";
const CHAMPAGNE = "F3E5AB";
const WHITE = "FFFFFF";
const GRAY = "9CA3AF";
const LIGHT_GRAY = "E5E7EB";
const RED_ACCENT = "EF4444";

const PAGE_WIDTH = 12240;
const PAGE_HEIGHT = 15840;
const MARGIN = 1440;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2; // 9360

const thinBorder = { style: BorderStyle.SINGLE, size: 1, color: "2D3748" };
const borders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };
const noBorders = {
  top: { style: BorderStyle.NONE, size: 0 },
  bottom: { style: BorderStyle.NONE, size: 0 },
  left: { style: BorderStyle.NONE, size: 0 },
  right: { style: BorderStyle.NONE, size: 0 },
};

function cell(text, opts = {}) {
  const { bold, width, shading, font, size, alignment, color } = opts;
  return new TableCell({
    borders: opts.borders !== undefined ? opts.borders : borders,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    children: [
      new Paragraph({
        alignment: alignment || AlignmentType.LEFT,
        children: [
          new TextRun({
            text,
            bold: bold || false,
            font: font || "Arial",
            size: size || 20,
            color: color || "333333",
          }),
        ],
      }),
    ],
  });
}

function heading(text, level) {
  return new Paragraph({
    heading: level,
    spacing: { before: level === HeadingLevel.HEADING_1 ? 360 : 240, after: 160 },
    children: [new TextRun({ text, bold: true, font: "Arial", size: level === HeadingLevel.HEADING_1 ? 32 : level === HeadingLevel.HEADING_2 ? 26 : 22, color: "111827" })],
  });
}

function para(text, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.afterSpacing || 120 },
    alignment: opts.alignment || AlignmentType.LEFT,
    children: [
      new TextRun({
        text,
        font: opts.font || "Arial",
        size: opts.size || 20,
        color: opts.color || "374151",
        bold: opts.bold || false,
        italics: opts.italics || false,
      }),
    ],
  });
}

function richPara(runs, opts = {}) {
  return new Paragraph({
    spacing: { after: opts.afterSpacing || 120 },
    alignment: opts.alignment || AlignmentType.LEFT,
    children: runs.map(r => new TextRun({
      text: r.text,
      font: r.font || "Arial",
      size: r.size || 20,
      color: r.color || "374151",
      bold: r.bold || false,
      italics: r.italics || false,
      break: r.break || undefined,
    })),
  });
}

function bulletItem(text, reference) {
  return new Paragraph({
    numbering: { reference, level: 0 },
    spacing: { after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 20, color: "374151" })],
  });
}

function codeBlock(lines) {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders,
            shading: { fill: "F3F4F6", type: ShadingType.CLEAR },
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: lines.map((line, i) =>
              new Paragraph({
                spacing: { after: i < lines.length - 1 ? 40 : 0 },
                children: [new TextRun({ text: line, font: "Courier New", size: 17, color: "1F2937" })],
              })
            ),
          }),
        ],
      }),
    ],
  });
}

function divider() {
  return new Table({
    width: { size: CONTENT_WIDTH, type: WidthType.DXA },
    columnWidths: [CONTENT_WIDTH],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: {
              top: { style: BorderStyle.NONE, size: 0 },
              bottom: { style: BorderStyle.SINGLE, size: 2, color: EMERALD },
              left: { style: BorderStyle.NONE, size: 0 },
              right: { style: BorderStyle.NONE, size: 0 },
            },
            margins: { top: 80, bottom: 80 },
            children: [new Paragraph({ children: [] })],
          }),
        ],
      }),
    ],
  });
}

function statusBadge(label, color) {
  return new Table({
    width: { size: 2400, type: WidthType.DXA },
    columnWidths: [2400],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            borders: { top: { style: BorderStyle.SINGLE, size: 1, color }, bottom: { style: BorderStyle.SINGLE, size: 1, color }, left: { style: BorderStyle.SINGLE, size: 1, color }, right: { style: BorderStyle.SINGLE, size: 1, color } },
            shading: { fill: color, type: ShadingType.CLEAR },
            margins: { top: 40, bottom: 40, left: 80, right: 80 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: label, font: "Arial", size: 18, bold: true, color: WHITE })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── Build document ──
const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [{
          level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
      {
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      },
    ],
  },
  styles: {
    default: { document: { run: { font: "Arial", size: 20 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "111827" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "111827" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 22, bold: true, font: "Arial", color: "111827" },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 } },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_WIDTH, height: PAGE_HEIGHT },
          margin: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: "TradeITM  |  Dev Spec  |  Discord Alerts", font: "Arial", size: 16, color: GRAY, italics: true }),
              ],
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
                new TextRun({ text: "Page ", font: "Arial", size: 16, color: GRAY }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 16, color: GRAY }),
                new TextRun({ text: "  |  Confidential", font: "Arial", size: 16, color: GRAY }),
              ],
            }),
          ],
        }),
      },
      children: [
        // ── Title block ──
        new Paragraph({ spacing: { after: 40 }, children: [] }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 80 },
          children: [new TextRun({ text: "DEV SPEC", font: "Arial", size: 40, bold: true, color: EMERALD })],
        }),
        new Paragraph({
          alignment: AlignmentType.LEFT,
          spacing: { after: 40 },
          children: [new TextRun({ text: "Discord Webhook Alert Enhancements", font: "Arial", size: 28, color: "111827" })],
        }),
        divider(),

        // ── Meta table ──
        new Paragraph({ spacing: { after: 120 }, children: [] }),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2200, 7160],
          rows: [
            new TableRow({ children: [
              cell("Date", { bold: true, width: 2200, shading: "F9FAFB" }),
              cell("February 16, 2026", { width: 7160 }),
            ]}),
            new TableRow({ children: [
              cell("Author", { bold: true, width: 2200, shading: "F9FAFB" }),
              cell("Claude (AI-Maintained)", { width: 7160 }),
            ]}),
            new TableRow({ children: [
              cell("Status", { bold: true, width: 2200, shading: "F9FAFB" }),
              cell("Draft - Pending Approval", { width: 7160, color: "D97706" }),
            ]}),
            new TableRow({ children: [
              cell("Scope", { bold: true, width: 2200, shading: "F9FAFB" }),
              cell("2 changes: Contact Form alert, New Chat alert", { width: 7160 }),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 200 }, children: [] }),

        // ══════════════════════════════════════════════
        // CHANGE 1
        // ══════════════════════════════════════════════
        heading("Change 1: Contact Us Form Discord Alert", HeadingLevel.HEADING_1),

        heading("Summary", HeadingLevel.HEADING_2),
        para("When a visitor submits the Contact Us form (via ContactModal), a Discord alert fires to the team webhook with the visitor\u2019s name, email, phone (if provided), and message. This path already exists in the codebase but needs to be verified end-to-end and cleaned up for the \u201Ccontact\u201D submission type specifically."),

        heading("Current State", HeadingLevel.HEADING_2),
        bulletItem("ContactModal submits to addContactSubmission() in lib/supabase.ts.", "bullets"),
        bulletItem("addContactSubmission() inserts into contact_submissions, then calls the notify-team-lead edge function.", "bullets"),
        bulletItem("notify-team-lead builds a Discord embed and POSTs it to the discord_webhook_url stored in app_settings.", "bullets"),
        bulletItem("For type: 'contact', the embed includes Name, Email, Phone, Source, and Message fields.", "bullets"),
        bulletItem("The embed color is green (3899126) and the title is \u201CNew Contact Inquiry\u201D.", "bullets"),

        heading("Required Changes", HeadingLevel.HEADING_2),
        para("This flow is already wired. The following items need verification and minor cleanup:"),

        heading("1. Verify the wiring is complete", HeadingLevel.HEADING_3),
        bulletItem("Confirm ContactModal passes submission_type: 'contact' to addContactSubmission().", "bullets"),
        bulletItem("Confirm addContactSubmission() passes type: 'contact' to the notify-team-lead edge function payload.", "bullets"),
        bulletItem("Confirm the discord_webhook_url key is populated in app_settings for the production project.", "bullets"),

        heading("2. Embed payload for Contact submissions", HeadingLevel.HEADING_3),
        para("The Discord embed for type: 'contact' should contain the following fields:"),

        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2800, 3200, 3360],
          rows: [
            new TableRow({ children: [
              cell("Field", { bold: true, width: 2800, shading: EMERALD, color: WHITE }),
              cell("Source", { bold: true, width: 3200, shading: EMERALD, color: WHITE }),
              cell("Notes", { bold: true, width: 3360, shading: EMERALD, color: WHITE }),
            ]}),
            new TableRow({ children: [
              cell("Name", { width: 2800 }),
              cell("payload.name", { width: 3200 }),
              cell("Truncated to 256 chars", { width: 3360 }),
            ]}),
            new TableRow({ children: [
              cell("Email", { width: 2800 }),
              cell("payload.email", { width: 3200 }),
              cell("Truncated to 256 chars", { width: 3360 }),
            ]}),
            new TableRow({ children: [
              cell("Phone", { width: 2800 }),
              cell("payload.phone", { width: 3200 }),
              cell("Optional; shown only if provided", { width: 3360 }),
            ]}),
            new TableRow({ children: [
              cell("Source", { width: 2800 }),
              cell("payload.source", { width: 3200 }),
              cell("Page URL or referral source", { width: 3360 }),
            ]}),
            new TableRow({ children: [
              cell("Message", { width: 2800 }),
              cell("payload.message", { width: 3200 }),
              cell("Truncated to 800 chars", { width: 3360 }),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 120 }, children: [] }),

        heading("3. Embed format", HeadingLevel.HEADING_3),
        para("Title: \u201CNew Contact Inquiry\u201D with the envelope emoji. Color: green (3899126). Timestamp included. No admin panel link needed unless the submission_id is available, in which case the existing link to /admin/leads?highlight={id} remains."),

        heading("Files Touched", HeadingLevel.HEADING_2),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [5400, 3960],
          rows: [
            new TableRow({ children: [
              cell("File", { bold: true, width: 5400, shading: "F9FAFB" }),
              cell("Action", { bold: true, width: 3960, shading: "F9FAFB" }),
            ]}),
            new TableRow({ children: [
              cell("components/ui/contact-modal.tsx", { width: 5400, size: 18 }),
              cell("Verify submission_type passed", { width: 3960, size: 18 }),
            ]}),
            new TableRow({ children: [
              cell("lib/supabase.ts (addContactSubmission)", { width: 5400, size: 18 }),
              cell("Verify type: 'contact' in payload", { width: 3960, size: 18 }),
            ]}),
            new TableRow({ children: [
              cell("supabase/functions/notify-team-lead/index.ts", { width: 5400, size: 18 }),
              cell("Verify/clean up contact embed path", { width: 3960, size: 18 }),
            ]}),
          ],
        }),

        heading("Risk Assessment", HeadingLevel.HEADING_2),
        para("Low risk. The infrastructure exists; this is a verification pass. No new API endpoints or database changes required."),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════════════════════════════════════
        // CHANGE 2
        // ══════════════════════════════════════════════
        heading("Change 2: New Chat Start Discord Alert", HeadingLevel.HEADING_1),

        heading("Summary", HeadingLevel.HEADING_2),
        para("Every time a new chat conversation is created (not reopened, not escalated\u2014just the initial creation), send a Discord alert containing the visitor\u2019s email, their initial message, and a direct link to the admin chat view for that conversation."),

        heading("Current State", HeadingLevel.HEADING_2),
        bulletItem("The handle-chat-message edge function already calls sendDiscordNotification() when conversation.isNewConversation is true (line 274).", "bullets"),
        bulletItem("The ENABLE_AUTO_ESCALATIONS flag is currently set to true (line 87), but the escalation-specific notification paths are gated behind sentiment/trigger checks.", "bullets"),
        bulletItem("The existing sendDiscordNotification() function builds an embed with title, description (including name, email, and admin link), lead score, and message history.", "bullets"),
        bulletItem("The current embed includes a \u201CView & Respond\u201D link pointing to /admin/chat?id={conversationId}.", "bullets"),

        heading("Required Changes", HeadingLevel.HEADING_2),

        heading("1. Simplify the new-chat notification embed", HeadingLevel.HEADING_3),
        para("The embed fired on conversation.isNewConversation should be reformatted to serve as a clean \u201Cnew chat started\u201D notice rather than an escalation-style alert. The revised embed should contain:"),

        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [2400, 3200, 3760],
          rows: [
            new TableRow({ children: [
              cell("Field", { bold: true, width: 2400, shading: EMERALD, color: WHITE }),
              cell("Value", { bold: true, width: 3200, shading: EMERALD, color: WHITE }),
              cell("Notes", { bold: true, width: 3760, shading: EMERALD, color: WHITE }),
            ]}),
            new TableRow({ children: [
              cell("Title", { width: 2400 }),
              cell("\u201CNew Chat Started\u201D", { width: 3200 }),
              cell("Chat bubble emoji prefix", { width: 3760 }),
            ]}),
            new TableRow({ children: [
              cell("Color", { width: 2400 }),
              cell("3447003 (Blue)", { width: 3200 }),
              cell("Matches existing new-conversation color", { width: 3760 }),
            ]}),
            new TableRow({ children: [
              cell("Email", { width: 2400 }),
              cell("visitor_email or \u201CNot provided\u201D", { width: 3200 }),
              cell("Shown in description line", { width: 3760 }),
            ]}),
            new TableRow({ children: [
              cell("Initial Message", { width: 2400 }),
              cell("First visitor message", { width: 3200 }),
              cell("Embed field, truncated to 500 chars", { width: 3760 }),
            ]}),
            new TableRow({ children: [
              cell("Admin Link", { width: 2400 }),
              cell("/admin/chat?id={conversationId}", { width: 3200 }),
              cell("Clickable \u201CView & Respond\u201D link in description", { width: 3760 }),
            ]}),
            new TableRow({ children: [
              cell("Timestamp", { width: 2400 }),
              cell("ISO timestamp", { width: 3200 }),
              cell("Auto-included by Discord", { width: 3760 }),
            ]}),
          ],
        }),

        new Paragraph({ spacing: { after: 120 }, children: [] }),

        heading("2. Remove escalation framing from new-chat path", HeadingLevel.HEADING_3),
        para("The sendDiscordNotification() function currently uses escalation-oriented logic (lead score display, high-value color coding, escalation titles). For the new-conversation path specifically, strip out the lead score field and the high-value/escalation title variants. The notification should always use the blue color and the \u201CNew Chat Started\u201D title when triggered by isNewConversation."),

        heading("3. Ensure email availability", HeadingLevel.HEADING_3),
        para("At the point where sendDiscordNotification() is called for new conversations (line 274), the visitor email may not yet be extracted. The function already receives visitorEmail as a parameter from conversation.visitor_email. If email is not available at conversation creation time, display \u201CNot yet provided\u201D in the embed. No gating on email is needed\u2014the alert fires regardless."),

        heading("4. Keep the admin chat link", HeadingLevel.HEADING_3),
        para("The embed description should include the direct link: \u201CView & Respond\u201D pointing to {APP_URL}/admin/chat?id={conversationId}. This allows the admin to click directly into the conversation from Discord."),

        heading("Proposed Embed Structure", HeadingLevel.HEADING_2),
        codeBlock([
          "{",
          "  embeds: [{",
          '    title: "\uD83D\uDCAC New Chat Started",',
          '    description: "**{visitorName}** started a conversation\\n',
          '      \uD83D\uDCE7 {visitorEmail || \\"Not yet provided\\"}\\n\\n',
          '      \uD83D\uDD17 [**View & Respond**]({chatUrl})",',
          "    color: 3447003,",
          "    fields: [",
          "      {",
          '        name: "\uD83D\uDCAC Initial Message",',
          '        value: "{firstMessage (truncated to 500 chars)}",',
          "        inline: false",
          "      }",
          "    ],",
          "    timestamp: new Date().toISOString()",
          "  }]",
          "}",
        ]),

        heading("Files Touched", HeadingLevel.HEADING_2),
        new Table({
          width: { size: CONTENT_WIDTH, type: WidthType.DXA },
          columnWidths: [5400, 3960],
          rows: [
            new TableRow({ children: [
              cell("File", { bold: true, width: 5400, shading: "F9FAFB" }),
              cell("Action", { bold: true, width: 3960, shading: "F9FAFB" }),
            ]}),
            new TableRow({ children: [
              cell("supabase/functions/handle-chat-message/index.ts", { width: 5400, size: 18 }),
              cell("Modify sendDiscordNotification() and its call site at line 274", { width: 3960, size: 18 }),
            ]}),
          ],
        }),

        heading("Risk Assessment", HeadingLevel.HEADING_2),
        para("Low-medium risk. The notification path already fires; we are simplifying its payload. The main consideration is that email may not be available on the first message, which is handled by the \u201CNot yet provided\u201D fallback. No database schema changes needed."),

        new Paragraph({ children: [new PageBreak()] }),

        // ══════════════════════════════════════════════
        // TESTING
        // ══════════════════════════════════════════════
        heading("Testing Plan", HeadingLevel.HEADING_1),

        heading("Change 1: Contact Form Alert", HeadingLevel.HEADING_2),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Confirm discord_webhook_url is set in app_settings.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Open the site and trigger the Contact Us modal.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Submit with name, email, phone, and a message.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Verify Discord channel receives an embed with all fields populated correctly.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Submit without phone to confirm it is omitted gracefully.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 120 },
          children: [new TextRun({ text: "Verify the admin panel link works (if submission_id is present).", font: "Arial", size: 20, color: "374151" })],
        }),

        heading("Change 2: New Chat Alert", HeadingLevel.HEADING_2),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Open the public chat widget and send a first message to create a new conversation.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Verify Discord receives the \u201CNew Chat Started\u201D embed with the initial message and \u201CNot yet provided\u201D for email.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Click the \u201CView & Respond\u201D link in the Discord embed and confirm it opens the correct conversation in /admin/chat.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Provide an email in a follow-up message and verify no duplicate notification fires.", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 80 },
          children: [new TextRun({ text: "Reopen a resolved conversation and verify no new-chat alert fires (only new conversations trigger it).", font: "Arial", size: 20, color: "374151" })],
        }),
        new Paragraph({
          numbering: { reference: "numbers", level: 0 },
          spacing: { after: 120 },
          children: [new TextRun({ text: "Verify the embed does NOT contain lead score or escalation-style titles.", font: "Arial", size: 20, color: "374151" })],
        }),

        divider(),

        heading("Out of Scope", HeadingLevel.HEADING_1),
        bulletItem("Escalation-based Discord alerts (currently disabled by ENABLE_AUTO_ESCALATIONS for escalation paths; no changes to that logic).", "bullets"),
        bulletItem("Trade share Discord alerts (separate webhook, unchanged).", "bullets"),
        bulletItem("Worker health alerts (backend service, unchanged).", "bullets"),
        bulletItem("Cohort application alerts (already working via notify-team-lead with type: 'cohort_application').", "bullets"),
        bulletItem("Database schema changes (none required).", "bullets"),

        new Paragraph({ spacing: { after: 200 }, children: [] }),
        divider(),

        para("End of spec.", { italics: true, color: GRAY }),
      ],
    },
  ],
});

// ── Write file ──
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("/sessions/nice-vigilant-wright/mnt/ITM-gd/docs/DEV_SPEC_DISCORD_ALERTS_2026-02-16.docx", buffer);
  console.log("Done: DEV_SPEC_DISCORD_ALERTS_2026-02-16.docx");
});
