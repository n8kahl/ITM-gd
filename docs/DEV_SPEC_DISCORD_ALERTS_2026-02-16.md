# DEV SPEC: Discord Webhook Alert Enhancements

**Date:** February 16, 2026
**Author:** Claude (AI-Maintained)
**Status:** Draft — Pending Approval
**Scope:** 2 changes: Contact Form alert, New Chat alert

---

## Change 1: Contact Us Form Discord Alert

### Summary

When a visitor submits the Contact Us form (via ContactModal), a Discord alert fires to the team webhook with the visitor's name, email, phone (if provided), and message. This path already exists in the codebase and has been verified end-to-end.

### Current State

- ContactModal submits to `addContactSubmission()` in `lib/supabase.ts`.
- `addContactSubmission()` inserts into `contact_submissions`, then calls the `notify-team-lead` edge function.
- `notify-team-lead` builds a Discord embed and POSTs it to the `discord_webhook_url` stored in `app_settings`.
- For `type: 'contact'`, the embed includes Name, Email, Phone, Source, and Message fields.
- The embed color is green (3899126) and the title is "📬 New Contact Inquiry".

### Required Changes

This flow is already wired. The following items need verification and minor cleanup:

**1. Verify the wiring is complete**

- Confirm ContactModal passes `submission_type: 'contact'` to `addContactSubmission()`.
- Confirm `addContactSubmission()` passes `type: 'contact'` to the `notify-team-lead` edge function payload.
- Confirm the `discord_webhook_url` key is populated in `app_settings` for the production project.

**2. Embed payload for Contact submissions**

| Field | Source | Notes |
|-------|--------|-------|
| Name | `payload.name` | Truncated to 256 chars |
| Email | `payload.email` | Truncated to 256 chars |
| Phone | `payload.phone` | Optional; shown only if provided |
| Source | `payload.source` | Page URL or referral source |
| Message | `payload.message` | Truncated to 800 chars |

**3. Embed format**

Title: "📬 New Contact Inquiry". Color: green (3899126). Timestamp included. No admin panel link needed unless the `submission_id` is available, in which case the existing link to `/admin/leads?highlight={id}` remains.

### Files Touched

| File | Action |
|------|--------|
| `components/ui/contact-modal.tsx` | Verify `submission_type` passed |
| `lib/supabase.ts` (`addContactSubmission`) | Verify `type: 'contact'` in payload |
| `supabase/functions/notify-team-lead/index.ts` | Verify/clean up contact embed path |

### Risk Assessment

Low risk. The infrastructure exists; this is a verification pass. No new API endpoints or database changes required.

---

## Change 2: New Chat Start Discord Alert

### Summary

Every time a new chat conversation is created (not reopened, not escalated—just the initial creation), send a Discord alert containing the visitor's email, their initial message, and a direct link to the admin chat view for that conversation.

### Current State

- The `handle-chat-message` edge function already calls `sendDiscordNotification()` when `conversation.isNewConversation` is true (line 274).
- The `ENABLE_AUTO_ESCALATIONS` flag is currently set to `true` (line 87), but the escalation-specific notification paths are gated behind sentiment/trigger checks.
- The existing `sendDiscordNotification()` function previously used escalation-oriented logic (lead score display, high-value color coding, escalation titles).

### Required Changes

**1. Simplify the new-chat notification embed**

The embed fired on `conversation.isNewConversation` has been reformatted to serve as a clean "new chat started" notice. The revised embed contains:

| Field | Value | Notes |
|-------|-------|-------|
| Title | "💬 New Chat Started" | Chat bubble emoji prefix |
| Color | 3447003 (Blue) | Consistent for all new conversations |
| Email | `visitor_email` or "Not yet provided" | Shown in description line |
| Initial Message | First visitor message | Embed field, truncated to 500 chars |
| Admin Link | `/admin/chat?id={conversationId}` | Clickable "View & Respond" link in description |
| Timestamp | ISO timestamp | Auto-included by Discord |

**2. Remove escalation framing from new-chat path**

The `sendDiscordNotification()` function no longer uses escalation-oriented logic. For the new-conversation path, the lead score field and the high-value/escalation title variants have been stripped. The notification always uses the blue color and the "New Chat Started" title.

**3. Ensure email availability**

If email is not available at conversation creation time, the embed displays "Not yet provided". No gating on email—the alert fires regardless.

**4. Admin chat link**

The embed description includes the direct link: "View & Respond" pointing to `{APP_URL}/admin/chat?id={conversationId}`. The admin chat page reads the `id` query param and auto-selects the matching conversation, so clicking through from Discord loads the correct chat immediately.

### Proposed Embed Structure

```json
{
  "embeds": [{
    "title": "💬 New Chat Started",
    "description": "**{visitorName}** started a conversation\n📧 {visitorEmail || \"Not yet provided\"}\n\n🔗 [**View & Respond**]({chatUrl})",
    "color": 3447003,
    "fields": [
      {
        "name": "💬 Initial Message",
        "value": "{firstMessage (truncated to 500 chars)}",
        "inline": false
      }
    ],
    "timestamp": "2026-02-16T..."
  }]
}
```

### Files Touched

| File | Action |
|------|--------|
| `supabase/functions/handle-chat-message/index.ts` | Modified `sendDiscordNotification()` and its call site at line 274 |

### Risk Assessment

Low-medium risk. The notification path already fires; we simplified its payload. The main consideration is that email may not be available on the first message, which is handled by the "Not yet provided" fallback. No database schema changes needed.

---

## Testing Plan

### Change 1: Contact Form Alert

1. Confirm `discord_webhook_url` is set in `app_settings`.
2. Open the site and trigger the Contact Us modal.
3. Submit with name, email, phone, and a message.
4. Verify Discord channel receives an embed with all fields populated correctly.
5. Submit without phone to confirm it is omitted gracefully.
6. Verify the admin panel link works (if `submission_id` is present).

### Change 2: New Chat Alert

1. Open the public chat widget and send a first message to create a new conversation.
2. Verify Discord receives the "New Chat Started" embed with the initial message and "Not yet provided" for email.
3. Click the "View & Respond" link in the Discord embed and confirm it opens the correct conversation in `/admin/chat`.
4. Provide an email in a follow-up message and verify no duplicate notification fires.
5. Reopen a resolved conversation and verify no new-chat alert fires (only new conversations trigger it).
6. Verify the embed does NOT contain lead score or escalation-style titles.

---

## Out of Scope

- Escalation-based Discord alerts (escalation notification paths are commented out; no changes to that logic).
- Trade share Discord alerts (separate webhook, unchanged).
- Worker health alerts (backend service, unchanged).
- Cohort application alerts (already working via `notify-team-lead` with `type: 'cohort_application'`).
- Database schema changes (none required).
