# TradeIntheMoney Homepage Chat Audit (2026-02-16)

## Scope
This audit covers the public homepage chat widget (`/`) that is a hybrid of AI responses and live human resolution.

Audit timestamp: **2026-02-16 21:47:23 UTC**.

Data sources used:
- Frontend widget integration: `/Users/natekahl/ITM-gd/app/page.tsx`, `/Users/natekahl/ITM-gd/components/ui/chat-widget.tsx`
- Admin/human ops UI: `/Users/natekahl/ITM-gd/app/admin/chat/page.tsx`, `/Users/natekahl/ITM-gd/app/admin/knowledge-base/page.tsx`
- Deployed production edge function (version 31): `handle-chat-message` (retrieved from Supabase)
- Live Supabase tables: `chat_conversations`, `chat_messages`, `knowledge_base`, `app_settings`

---

## 1) Current Hybrid Behavior (Live)

### Traffic/state snapshot
- Total conversations: **31**
- AI-handled conversations: **19** (61.3%)
- Human-handled conversations: **12** (38.7%)
- Status split: **6 active**, **1 resolved**, **24 archived**

### Message mix snapshot
- Total messages: **160**
- Visitor messages: **68**
- Team messages: **67**
- System messages: **25**
- AI-generated messages: **60**
- Human team messages (`sender_type='team' AND ai_generated=false`): **21**

### Escalation state snapshot
- Active escalated conversations (`status='active' AND escalation_reason IS NOT NULL`): **2**
- Active conversations with pending escalation in metadata: **4**
- Total conversations with pending escalation metadata set: **10**

Top escalation reasons observed historically:
- `Visitor requested human agent` (4)
- `Manually claimed by admin` (3)
- `Low AI confidence - human verification needed` (3)
- Frustration sentiment reasons (2)

---

## 2) How AI Builds Answers (Production)

Runtime answer assembly in deployed `handle-chat-message`:
1. Saves visitor message.
2. Runs sentiment analysis (`gpt-4o`).
3. Runs escalation trigger checks.
4. Searches KB (`search_knowledge_base`, fallback to `search_knowledge_base_fallback`, then top-priority active entries).
5. Injects selected KB entries as `Q: ... / A: ...` context into the LLM prompt.
6. Generates AI response (`gpt-4o`) and parses `[CONFIDENCE: HIGH/MEDIUM/LOW]`.
7. Stores referenced KB IDs in `chat_messages.knowledge_base_refs`.

Live usage evidence:
- AI messages total: **60**
- AI messages with KB refs: **30**
- Average AI confidence (stored): **0.955**

Most referenced KB entries:
- `What is the difference between Core, Pro, and Execute?` (27)
- `How much does it cost?` (26)
- `Do you have proof?` (25)

---

## 3) Active KB Q/A Inventory (What AI References)

Below are the currently active KB entries in production (`knowledge_base.is_active=true`), shown as primary Q and core A payload.

### Pricing
1. **Q:** How much does it cost?
   **A:** Core $199/mo, Pro $299/mo, Execute $499/mo; 30-day action-based guarantee.
2. **Q:** What is the difference between Core, Pro, and Execute?
   **A:** Core = foundation, Pro = adds LEAPS/swing strategy, Execute = premium/high-conviction NDX + LEAPS.

### Features
3. **Q:** How does it work?
   **A:** Instant Discord access, 1-3 daily setups, exact entry/stop/target, real-time notifications, educational rationale.
4. **Q:** What makes you different?
   **A:** Execution-focused education, verified performance framing, selective serious-trader community positioning.

### Proof
5. **Q:** Do you have proof?
   **A:** Cites 87% win rate over 8+ years, 100%+ target, and sample win callouts.
6. **Q:** What do members say?
   **A:** Testimonial-style member outcomes tied to tier framing.

### FAQ
7. **Q:** Money back guarantee?
   **A:** 30-day action-based guarantee with follow-the-alerts condition.
8. **Q:** How many alerts per day?
   **A:** 1-3 setups/day during 9:30am-4pm ET; tier-specific coverage.
9. **Q:** How much money do I need?
   **A:** Suggests $1,000 minimum, $5,000+ ideal; risk management emphasized.
10. **Q:** Do I need experience?
    **A:** Beginner-friendly with education; advanced value for experienced traders.

### Technical
11. **Q:** What platform?
    **A:** Works with any options-capable broker; TradeITM provides setup details, user executes in own broker.

### Mentorship (Precision Cohort)
12. **Q:** What is the Precision Cohort?
    **A:** $1,500/year annual mentorship, limited to 20, positioned as transformation vs signal-following.
13. **Q:** What are the four pillars?
    **A:** Live strategy sessions, trade architecture, portfolio engineering, mindset mastery.
14. **Q:** How is Precision Cohort different?
    **A:** Monthly tiers = alerts; cohort = personalized trader development.
15. **Q:** How do I apply for Precision Cohort?
    **A:** Qualification questions + application process; metadata marks this as high-value and auto-escalation intent.

### Escalation-intent KB entries
16. **Q:** ready to join
    **A:** `[ESCALATE] High-value lead ready to purchase.`
17. **Q:** execute tier
    **A:** `[ESCALATE] High-value Execute tier interest detected.`
18. **Q:** speak to human
    **A:** `[ESCALATE] Visitor requested human team member.`

---

## 4) Escalation Rules (Current Production Logic)

All escalation paths are currently active in the deployed function and are **email-gated**.

### Trigger rules
Escalate when any of the following is true:
1. Sentiment model returns `frustrated` or `angry`.
2. Explicit human-request keywords (e.g., "speak to human", "agent", "representative").
3. High-intent purchase keywords (e.g., "ready to join", "want to buy", "$499").
4. High-value tier keywords (currently coded as "execute" and related phrases).
5. Mentorship/cohort intent keywords (cohort, mentorship, annual, $1,500).
6. Frustration keywords in plain text (e.g., scam, fake, waste).
7. Extended conversation (`>4` visitor messages in history).
8. Billing/refund/cancel keywords.
9. AI confidence `< 0.7` after response generation.

### Email gate behavior
1. If visitor email is missing:
   - Set `metadata.pending_escalation` with reason/lead score/handoff message.
   - Ask for email in chat.
   - Keep conversation AI-handled until email is captured.
2. If visitor email exists (or arrives in next message):
   - Set `ai_handled=false`.
   - Set `escalation_reason` and `lead_score`.
   - Clear `pending_escalation`.
   - Add system handoff messages.
   - Notify team via Discord webhook.

### Manual human takeover
- Admin can force takeover from `/admin/chat`:
  - Sets `ai_handled=false`
  - Sets `escalation_reason='Manually claimed by admin'`

---

## 5) Important Audit Findings

1. **Production code differs from repo code**
- Deployed `handle-chat-message` (v31) has escalation always enabled and hardcoded prompt.
- Repo file `/Users/natekahl/ITM-gd/supabase/functions/handle-chat-message/index.ts` includes `ENABLE_AUTO_ESCALATIONS=false` and different flow.

2. **`ai_system_prompt` setting exists but is not used by deployed function**
- `app_settings.ai_system_prompt` is populated.
- Deployed function currently uses a hardcoded in-function system prompt (not DB-driven).

3. **Tier naming drift (`Execute` vs `Executive`)**
- KB and deployed escalation logic still use `Execute` terminology.
- Frontend/admin language mostly uses `Executive`.

4. **Pending escalation residue exists in active threads**
- Multiple active conversations still carry `metadata.pending_escalation`.
- This can create queue ambiguity and mixed state in admin triage.

5. **KB references are only attached to ~50% of AI-generated messages**
- 30 of 60 AI-generated messages include `knowledge_base_refs`.
- Some AI/system outputs (handoff/email prompts) do not reference KB by design.

---

## 6) Recommended Escalation Policy (Operational)

If you want a clean, explicit policy for your team:
1. **Immediate human escalation**
   - Human requested, billing/refund issue, angry/frustrated sentiment, or confidence < 0.7.
2. **High-value fast-track**
   - Purchase-intent, executive-tier intent, mentorship/cohort intent.
3. **Email collection requirement**
   - If no email, request email before handoff and mark as pending.
4. **SLA**
   - Active escalated threads first, then pending-email threads, then AI-only threads with lead score >= 7.
5. **Close-loop hygiene**
   - On manual takeover, clear stale `pending_escalation` metadata.

