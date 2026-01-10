# Security Policy

This document describes the security support policy and responsible disclosure process for this project.

Security is treated as a first-class concern. Unsupported versions, unreported vulnerabilities, or unsafe disclosure practices are considered operational risks.

---

## Supported Versions

The following versions are currently supported with security updates:

| Version | Supported |
|--------|-----------|
| 5.1.x  | ✅ Yes     |
| 5.0.x  | ❌ No      |
| 4.0.x  | ✅ Yes     |
| < 4.0  | ❌ No      |

Only supported versions will receive security patches. Users running unsupported versions are expected to upgrade. Vulnerabilities reported against unsupported versions may be closed without remediation.

---

## Reporting a Vulnerability

### Responsible Disclosure

If you believe you have discovered a security vulnerability, **do not** open a public GitHub issue or disclose it publicly.

Instead, report it responsibly using the process below.

### How to Report

Send a detailed report to:

**security@yourcompany.com**  
(replace with the correct monitored address)

Reports should include, when possible:
- A clear description of the vulnerability
- Affected versions or components
- Steps to reproduce
- Potential impact
- Proof-of-concept code or screenshots (if available)

### Response Timeline

- An initial acknowledgment will be provided within **72 hours**
- Status updates will be provided at least once every **7 days**
- If accepted, a fix will be developed and released as soon as reasonably possible
- If declined, the reporter will be informed of the reasoning

### Disclosure & Credit

We aim to coordinate fixes and disclosure responsibly. Reporters may be credited for valid findings unless anonymity is requested.

---

## Security Scope & Expectations

- Third-party services, dependencies, and infrastructure integrations are expected to follow least-privilege access principles
- Secrets must be rotated promptly if exposure is suspected
- Production systems must maintain audit logs for security-sensitive operations
- Test and staging environments must not contact real users or external systems without explicit approval

Failure to adhere to these expectations may result in access revocation.

---

## Questions

Security questions should be directed to the contact above. General support issues should use standard project channels.
# Security Policy

## Supported Versions

Use this section to tell people about which versions of your project are
currently being supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 5.1.x   | :white_check_mark: |
| 5.0.x   | :x:                |
| 4.0.x   | :white_check_mark: |
| < 4.0   | :x:                |

## Reporting a Vulnerability

Use this section to tell people how to report a vulnerability.

Tell them where to go, how often they can expect to get an update on a
reported vulnerability, what to expect if the vulnerability is accepted or
declined, etc.
