# Security Policy

## Supported versions

| Version | Supported |
| ------- | --------- |
| 1.x     | Yes       |

## Reporting a vulnerability

Please report security issues privately using one of these options:

- Open a [GitHub Security Advisory](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) for this repository (preferred if the feature is enabled).
- Or email **lexuanquy4198@gmail.com** with a clear subject line (e.g. `[security] mern-social-app`).

Please do not open a public issue for undisclosed vulnerabilities.

We will acknowledge receipt as soon as practical and work with you on a fix and disclosure timeline.

## After a past leak of secrets

If credentials were ever committed to git, rotate them (database passwords, JWT signing secrets, OAuth client secrets) and treat the old values as compromised.
