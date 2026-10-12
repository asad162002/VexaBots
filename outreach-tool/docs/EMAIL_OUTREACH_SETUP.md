# Email Outreach Setup Guide for Vexabots Outreach Tool

## Overview
This guide covers everything needed to set up email outreach capabilities in the Vexabots outreach tool, including domain setup, email service providers, domain warming, deliverability best practices, and what to build in the tool. All options are evaluated with free tier feasibility in mind.

---

## 1. Current State vs. Competitors

### What competitors offer (and this tool lacks):
- **Email sequences/automation** - Apollo, Outreach, Salesloft have multi-channel sequences
- **Email integration** - Gmail/Outlook sync with send/receive tracking
- **Built-in dialer** - Click-to-call with recording and CRM logging
- **Meeting scheduling** - Integrated calendar booking (SavvyCal, Calendly)
- **LinkedIn automation** - Automated connection requests and DMs (Expandi, LeadConnect)
- **AI writing assistance** - AI-powered email drafting/personalization
- **Email verification** - Pre-send validation to reduce bounce rates
- **Domain warming** - Gradual reputation building for new sending domains
- **CRM sync** - Two-way sync with Salesforce/HubSpot/Pipedrive

### What this tool already has:
- Google Maps lead scraping/import (competitors don't have native scraping)
- Tech stack data (running Google/FB ads detection)
- Apollo enrichment data (phone, LinkedIn, revenue, employee count)
- Assignment workflow with per-member limits
- ICP scoring with per-criteria breakdown
- Status history audit trail
- Activity logging (manual only - no automation)

---

## 2. Email Service Providers (Free Tier Options)

### 2.1 Resend (Recommended for development)
- **Free tier:** 100 emails/day (~$3,000/month)
- **Integration:** Built-in Next.js integration, works from API routes
- **Pros:** Developer-friendly, fast, modern, good docs
- **Cons:** No built-in warming, no email templates UI
- **Setup:**
  ```bash
  npm install resend
  ```
- **Code example:**
  ```javascript
  import { Resend } from 'resend';
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: 'onboarding@yourdomain.com',
    to: 'lead@example.com',
    subject: 'Your personalized message',
    html: '<p>Hello from Vexabots</p>',
  });
  ```
- **API key:** Get from https://resend.com/api-keys

### 2.2 Mailgun (Free tier with caveats)
- **Free tier:** 100 emails/day for 90 days (trial), then pay-as-you-go
- **Integration:** REST API or SMTP
- **Pros:** Good deliverability guides, extensive docs
- **Cons:** Trial period is limited, not truly free long-term

### 2.3 MailerSend
- **Free tier:** 12,000 emails/month
- **Integration:** REST API, SMTP, native integrations
- **Pros:** Generous free tier, good template support
- **Cons:** Interface less developer-friendly than Resend

### 2.4 Gmail SMTP (Personal account)
- **Free tier:** 500 emails/day (consumer), 2,000 for Workspace
- **Requirements:** Must use OAuth2, requires "Gmail API" or "Less secure apps" (now deprecated)
- **Best approach:** Use OAuth2 with Google's SMTP relay
- **Setup steps:**
  1. Enable Gmail API in Google Cloud Console
  2. Create OAuth credentials
  3. Use `nodemailer` with OAuth2 token
- **Code:**
  ```bash
  npm install nodemailer
  ```
  ```javascript
  // Requires OAuth2 setup first
  const nodemailer = require('nodemailer');
  // ... OAuth2 transporter config
  ```

### 2.5 Brevo (formerly Sendinblue)
- **Free tier:** 300 emails/day (unlimited contacts, no templates)
- **Integration:** REST API
- **Pros:** Generous daily limit, no credit card for free tier
- **Cons:** Interface can be slow, templates locked behind paid plans

### 2.6 SMTP2GO
- **Free tier:** 500 emails/month, 1,000/day with paid
- **Integration:** SMTP relay
- **Pros:** Good deliverability, easy setup
- **Cons:** Low monthly free limit

---

## 3. Domain Setup

### 3.1 Getting a domain (free/low-cost options)
- **Freenom** (free domains): .tk, .ml, .ga, .cf, .gq (unreliable, often flagged as spam)
- **Namecheap**: ~$5-10/year for .com, good reputation
- **Porkbun**: ~$5-8/year, clean interface
- **Recommendation:** Buy a .com domain for at least $5/year. Free domains will hurt deliverability.

### 3.2 DNS Records Needed
For your sending domain (e.g., `outreach.yourdomain.com`), you need:

1. **SPF Record** (TXT):
   ```
   v=spf1 include:resend.com ~all
   ```
   (Or replace resend.com with your provider)

2. **DKIM Record** (TXT):
   - Provided by your email service provider
   - Resend: Go to Domains -> Add Domain -> Get DKIM record
   - Paste the CNAME record they provide

3. **DMARC Record** (TXT):
   ```
   v=DMARC1; p=quarantine; rua=mailto:dmarc@yourdomain.com; fo=1; ri=86400
   ```
   - Start with `p=quarantine` (not `p=reject` until you have good reputation)
   - `rua` is the forensic report email (you can forward to your personal email)

4. **Return-Path (Bounce Address)**:
   - Resend handles this automatically if you verify the domain

### 3.3 Setting up in Resend (step by step)
1. Go to https://resend.com/domains
2. Click "Add Domain"
3. Enter your domain (e.g., `outreach.yourdomain.com`)
4. Copy the SPF TXT record they provide
5. Add it to your DNS provider (Namecheap, Cloudflare, etc.)
6. Copy the DKIM CNAME records (usually 3)
7. Add them to your DNS
8. Add the DMARC TXT record
9. Wait for DNS propagation (can take 1 hour to 48 hours, usually < 4 hours)
10. Resend will show "Verified" once DNS propagates

---

## 4. Domain Warming (Step-by-Step)

**Purpose:** Build sender reputation gradually so email providers trust your domain.

### Warm-up Schedule (14 days, Resend/Mailgun recommended approach)

| Day | Emails to Send | Notes |
|-----|---------------|-------|
| 1   | 5-10          | Start very low, manually |
| 2   | 10-15         | Check deliverability |
| 3   | 20-30         | |
| 4   | 30-50         | |
| 5   | 50-75         | |
| 6   | 75-100        | |
| 7   | 100-150       | |
| 8   | 150-200       | |
| 9   | 200-300       | |
| 10  | 300-500       | |
| 11  | 500-750       | |
| 12  | 750-1,000     | |
| 13  | 1,000-1,500   | |
| 14  | 1,500+        | Full volume |

### Free warming tools:
- **Mailgun Warmup**: Built-in if you use Mailgun
- **Instantly.ai**: 14-day warmup sequence (paid, $30/month)
- **Warmup Inbox**: Free tier (limited)
- **Mailwarm**: $25/month (popular but paid)

### Manual warming process (free):
1. Start with 5-10 emails/day to your own inboxes (Gmail, Outlook)
2. Reply to them, mark as important, move to inbox (simulate engagement)
3. After 3 days, send to real leads but very low volume
4. If you get replies/opens, gradually increase
5. Monitor deliverability with:
   - **Mail-Tester.com** (free, 5 tests/day) - checks spam score
   - ** Google Postmaster Tools** (free, requires 100+ emails/day volume)
   - ** MXToolbox** (free DNS/blacklist checking)

---

## 5. Email Deliverability Best Practices

### Content rules:
1. Use a real person name in "From" (e.g., "Asad from Vexabots", not "Vexabots Team")
2. Subject line under 50 characters
3. First sentence should make sense without context (many email clients truncate)
4. One clear call-to-action
5. Don't use spam trigger words:
   - "Free" "Act now" "Limited time" "Guarantee" "Click here" "Buy now" "Cash bonus" "One hundred percent" "100% free"
6. Include a plain-text version
7. Use a real email signature with name, title, company, phone
8. Link to your real company website

### Technical rules:
1. Always use a dedicated sending domain (not Gmail/Outlook personal address)
2. Enable tracking with a custom tracking domain (Resend supports this)
3. Set up proper SPF/DKIM/DMARC (see Section 3)
4. Keep sending volume consistent (don't spike)
5. Clean your email list before sending (remove bounces, invalid emails)
6. Use double opt-in or validated email sources

### What NOT to do:
- Don't buy email lists (they're garbage)
- Don't send attachments (huge deliverability hit)
- Don't use all caps or excessive exclamation marks
- Don't send from a subdomain you just created yesterday with no history

---

## 6. What to Build in the Vexabots Tool

### MVP (Minimum Viable Product):
1. **Email template editor** in the UI
   - Simple textarea with subject + body (HTML or plain text)
   - Save templates as presets
   - Variables for personalization: `{{lead.name}}`, `{{lead.owner_name}}`, `{{lead.company}}`
2. **Email sending UI** on lead detail page
   - "Send Email" button next to "Call Now"
   - Opens modal with template selection or blank compose
   - Sends via Resend API (or whatever provider you connect)
3. **Email tracking** (basic)
   - Log emails in the activity feed (already built)
   - Store sent timestamp, subject, template used
4. **Connection management**
   - Settings page section to connect email provider
   - Store API key in environment variable (`.env.local`)
   - Simple form: API Key input, From Email, From Name, Domain

### Phase 2 (After MVP):
1. Email sequences (multi-step follow-up campaigns)
2. Open/click tracking (via Resend webhooks or tracking pixel)
3. Reply detection (when prospect replies, stop sequence)
4. Calendar integration (check availability, schedule meetings)
5. A/B testing for email templates
6. Domain warming scheduler in the UI

### Integration code (Next.js API route):
```typescript
// pages/api/send-email.ts (or /app/api/send-email/route.ts)
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  const { to, subject, html, fromName, fromEmail } = await request.json();

  const { data, error } = await resend.emails.send({
    from: `${fromName} <${fromEmail}>`,
    to: [to],
    subject,
    html,
  });

  if (error) return Response.json({ error }, { status: 400 });
  return Response.json({ data });
}
```

---

## 7. Quick Start Checklist

### Week 1: Foundation
- [ ] Buy a domain (Namecheap, $5-10/year)
- [ ] Sign up for Resend (free 100/day)
- [ ] Add domain to Resend, copy DNS records
- [ ] Add SPF, DKIM, DMARC records to your DNS
- [ ] Wait for DNS propagation, verify in Resend
- [ ] Store `RESEND_API_KEY` in `.env.local`

### Week 2: Testing
- [ ] Send test emails to yourself (use Mail-Tester.com to check spam score)
- [ ] Build basic email template editor UI
- [ ] Build "Send Email" button on lead detail page
- [ ] Wire up API route to Resend
- [ ] Test sending, verify in activity log

### Week 3: Warm-up
- [ ] Send 5-10 emails/day to your own mailboxes
- [ ] Engage with them (open, reply, archive)
- [ ] Gradually increase to 50/day over 2 weeks
- [ ] Start sending to real leads at low volume
- [ ] Monitor deliverability with Google Postmaster Tools

### Week 4+: Scale
- [ ] Increase sending volume per the warmup schedule
- [ ] Once at 500/day consistently, you're "warm"
- [ ] Can now send campaign-level emails
- [ ] Consider upgrading to MailerSend or SendGrid paid plan for higher volumes

---

## 8. Costs Breakdown (Low to High Volume)

| Tool | Free Tier | Paid Tier (approx) | Best For |
|------|-----------|-------------------|----------|
| Resend | 100/day ($0) | $0.004/email ($40/10k) | Development, small volume |
| MailerSend | 12k/month ($0) | $15/100k emails | Growing teams |
| Gmail SMTP | 500/day (via personal) | N/A (free with Google account) | Very small volume, personal use |
| Brevo | 300/day ($0) | $25/month ($6.5/1k over limit) | Medium volume |
| Mailgun | 100/day trial ($0) | $0.80/1k emails | Production deliverability |
| SendGrid | 60-day trial only | $20/month (100k emails) | Enterprise |

**For BROKE budget (zero API spend):** Use Gmail SMTP + your personal Google account (500 emails/day free). Downside: less professional, lower deliverability for cold outreach.

**For first real campaign:** Resend free tier (100/day) + proper domain setup.

---

## 9. LinkedIn Leads --> Email Workflow

Since you mentioned using LinkedIn lead emails:

1. **Import LinkedIn leads** with email field (already have LinkedIn Leads dashboard)
2. **Verify emails** before sending (consider adding a basic validator):
  - Free option: Simple regex check (not reliable)
  - Better: Use a verification API (but costs money, e.g., Abstract API, Hunter)
  - Best free approach: Send low-volume test first, track bounces
3. **Personalize using enrichment data:**
   - `owner_name`, `owner_role`, `owner_linkedin_url` from the lead record
   - `apollo_revenue`, `apollo_employees`, `apollo_description` for context
   - Build email templates with these variables
4. **Track responses:**
   - Log "Email Sent" activity automatically
   - Manually log "Email Replied" when you get a response
   - Set follow-up reminders based on response cadence

### Email template examples for LinkedIn leads:

**Template 1 (Cold Introduction):**
```
Subject: Quick question about [COMPANY]

Hi [OWNER_NAME],

I came across [COMPANY] on LinkedIn and saw you're in [OWNER_ROLE]. I help businesses at Vexabots build AI assistants that handle customer inquiries automatically.

Would you be open to a 5-minute call this week to see if we could help [COMPANY] reduce support costs?

Best,
[YOUR NAME]
Co-founder, Vexabots
```

**Template 2 (Follow-up):**
```
Subject: Following up on AI assistant for [COMPANY]

Hi [OWNER_NAME],

Following up on my email about AI assistants for [COMPANY]. We just helped [SIMILAR COMPANY] reduce their customer support volume by 40% with an AI assistant that handles common queries automatically.

Would a 10-minute call next week make sense to see if this could apply to [COMPANY]?

Best,
[YOUR_NAME]
```

---

## 10. Resources
- Resend docs: https://resend.com/docs
- Domain warming guide (Mailgun): https://www.mailgun.com/blog/deliverability/domain-warmup-reputation-stretch-before-you-send/
- B2B cold email deliverability (Clay): https://www.clay.com/blog/b2b-cold-email-deliverability
- Gmail SMTP with OAuth2 (Google docs): https://developers.google.com/gmail/api/guides/smtp
- Email warm-up best practices (Truelist): https://truelist.io/blog/how-to-warm-up-an-email-domain
- Free SMTP servers comparison: https://www.emailtooltester.com/en/blog/free-smtp-servers/
