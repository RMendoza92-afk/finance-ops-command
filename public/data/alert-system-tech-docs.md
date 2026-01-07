# FLI Claims Dashboard - Alert System Technical Documentation

**Last Updated:** January 2026  
**Version:** 1.0

---

## Overview

The FLI Claims Dashboard includes an integrated alert system for sending notifications via SMS and Email. Both services are implemented as Supabase Edge Functions and can be triggered from the dashboard UI or programmatically.

---

## SMS Service (Twilio)

### Edge Function
**Path:** `supabase/functions/send-review-sms/index.ts`

### Required Environment Secrets

| Secret Name | Description | Format |
|-------------|-------------|--------|
| `TWILIO_ACCOUNT_SID` | Twilio Account SID | `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx` |
| `TWILIO_AUTH_TOKEN` | Twilio Auth Token | String |
| `TWILIO_PHONE_NUMBER` | Sender phone number | E.164 format: `+1XXXXXXXXXX` |

### Request Payload

```typescript
interface SMSRequest {
  to: string;              // Required - Recipient phone (E.164: +1XXXXXXXXXX)
  matterId?: string;       // Matter/Claim identifier
  claimant?: string;       // Claimant name
  exposure?: number;       // Total exposure amount
  reserves?: number;       // Reserve amount
  painLevel?: number;      // Pain level (1-5)
  daysOpen?: number;       // Days the matter has been open
  phase?: string;          // Current litigation phase
  actionRequired?: string; // Action required description
  customNote?: string;     // Custom message to append
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "messageSid": "SMxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

**Error (500):**
```json
{
  "error": "Error message description"
}
```

### Example Invocation

```typescript
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase.functions.invoke('send-review-sms', {
  body: {
    to: '+15551234567',
    matterId: 'LIT-2026-001',
    claimant: 'John Doe',
    exposure: 150000,
    actionRequired: 'Review settlement offer'
  }
});
```

### SMS Message Format

Messages are constructed dynamically based on provided fields:
```
🚨 FLI Alert

📋 Matter: {matterId}
👤 Claimant: {claimant}
💰 Exposure: ${formatted_amount}
📊 Reserves: ${formatted_amount}
⚠️ Pain Level: P{painLevel}
📅 Days Open: {daysOpen}
📍 Phase: {phase}

🎯 Action: {actionRequired}

📝 Note: {customNote}

- FLI Claims Dashboard
```

---

## Email Service (Resend)

### Edge Function
**Path:** `supabase/functions/send-alert-email/index.ts`

### Required Environment Secrets

| Secret Name | Description |
|-------------|-------------|
| `RESEND_API_KEY` | Resend API key from https://resend.com/api-keys |

### Sender Configuration

**Default:** `FLI Claims Dashboard <onboarding@resend.dev>`

> ⚠️ **Production Note:** For production use, configure a verified domain at https://resend.com/domains and update the `from` address in the edge function.

### Request Payload

```typescript
interface AlertEmailRequest {
  to: string;              // Required - Primary recipient email
  cc?: string[];           // Optional - CC recipients
  matterId?: string;       // Matter/Claim identifier
  claimant?: string;       // Claimant name
  exposure?: number;       // Total exposure amount
  reserves?: number;       // Reserve amount
  painLevel?: number;      // Pain level (1-5)
  daysOpen?: number;       // Days the matter has been open
  phase?: string;          // Current litigation phase
  actionRequired?: string; // Action required description
  customNote?: string;     // Custom note to include
}
```

### Response

**Success (200):**
```json
{
  "success": true,
  "emailId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

**Error (500):**
```json
{
  "error": "Error message description"
}
```

### Example Invocation

```typescript
import { supabase } from "@/integrations/supabase/client";

const { data, error } = await supabase.functions.invoke('send-alert-email', {
  body: {
    to: 'reviewer@company.com',
    cc: ['manager@company.com', 'legal@company.com'],
    matterId: 'LIT-2026-001',
    claimant: 'John Doe',
    exposure: 150000,
    reserves: 75000,
    painLevel: 4,
    actionRequired: 'Review settlement offer by EOD'
  }
});
```

### Email Template

The email is rendered as HTML with the following sections:
- **Header:** Red banner with "⚠️ FLI Review Alert"
- **Matter Details:** Matter ID and claimant in highlighted box
- **Key Metrics:** Table of exposure, reserves, pain level, days open, phase
- **Action Required:** Yellow highlighted box (if provided)
- **Custom Note:** Blue highlighted box (if provided)
- **Footer:** Automated alert disclaimer

---

## CORS Configuration

Both edge functions include CORS headers for browser access:

```typescript
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
```

Both handle OPTIONS preflight requests:
```typescript
if (req.method === "OPTIONS") {
  return new Response(null, { headers: corsHeaders });
}
```

---

## Currency Formatting

Both services use consistent currency formatting:

```typescript
const formatCurrency = (amount: number): string => {
  if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
  return `$${amount.toLocaleString()}`;
};
```

---

## Service Limits & Pricing

### Twilio SMS
- **Free Trial:** Limited credits for testing
- **Production:** Pay-per-message (~$0.0079/SMS in US)
- **Rate Limits:** 1 message/second (standard), higher with upgrade
- **Documentation:** https://www.twilio.com/docs/sms

### Resend Email
- **Free Tier:** 3,000 emails/month, 100 emails/day
- **Pro Tier:** Higher limits with paid plans
- **Rate Limits:** Varies by plan
- **Documentation:** https://resend.com/docs

---

## Troubleshooting

### Common SMS Issues

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| "Invalid phone number" | Wrong format | Ensure E.164 format (+1XXXXXXXXXX) |
| "Authentication failed" | Invalid credentials | Verify TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN |
| "Unverified number" | Trial account limitation | Verify recipient number in Twilio console |

### Common Email Issues

| Issue | Possible Cause | Solution |
|-------|----------------|----------|
| "RESEND_API_KEY not configured" | Missing secret | Add API key in Lovable Cloud secrets |
| "Domain not verified" | Using unverified sender | Verify domain at resend.com/domains |
| Emails going to spam | Using default sender | Configure verified custom domain |

---

## Security Considerations

1. **Secrets Management:** All API keys are stored as encrypted environment secrets, not in code
2. **Input Validation:** Phone numbers and emails are validated before sending
3. **CORS:** Configured to allow browser requests; restrict in production if needed
4. **No PII Logging:** Sensitive data is not logged; only success/failure status

---

## Architecture Diagram

```
┌─────────────────┐     ┌──────────────────────────┐     ┌─────────────┐
│  Dashboard UI   │────▶│  Supabase Edge Function  │────▶│   Twilio    │
│  (React/TS)     │     │  send-review-sms         │     │   SMS API   │
└─────────────────┘     └──────────────────────────┘     └─────────────┘
        │
        │               ┌──────────────────────────┐     ┌─────────────┐
        └──────────────▶│  Supabase Edge Function  │────▶│   Resend    │
                        │  send-alert-email        │     │  Email API  │
                        └──────────────────────────┘     └─────────────┘
```

---

## Contact

For issues or questions about this integration, contact the development team.
