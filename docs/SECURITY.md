# Security Guidelines

## Sensitive Information Protection

This document outlines how to properly handle sensitive information in the Lost Children Charity Platform project.

### Environment Variables and API Keys

**NEVER commit the following to Git:**

- `.env` files containing real API keys
- `local.properties` with actual Google Maps API keys
- Database connection strings with real credentials
- Stripe API keys (live or test)
- Any file containing passwords, tokens, or secrets

### Properly Secured Files

The following files are already excluded in `.gitignore`:

#### Web Platform (Next.js/Vercel)
- `web/.env*` - All environment variable files
- `web/.vercel/` - Vercel deployment configuration

#### Android Application
- `android/local.properties` - Contains SDK path and API keys
- `android/app/google-services.json` - Firebase configuration (if used)
- `*.keystore`, `*.jks` - Signing certificates

#### General Security Patterns
- `**/*secret*` - Any file with "secret" in the name
- `**/*key*.json` - JSON files containing keys
- `**/certs/` - Certificate directories
- `*.pem`, `*.p12`, `*.p8` - Certificate files

### Setting Up Environment Variables

#### For Web Development:
1. Copy `web/env.example.template` to `web/.env.local`
2. Replace placeholder values with your actual API keys
3. Never commit the `.env.local` file

#### For Android Development:
1. Copy `android/local.properties.example` to `android/local.properties`
2. Update the SDK path and add your Google Maps API key
3. Never commit the `local.properties` file

### API Key Management

#### Google Maps API Key
- Create separate keys for development and production
- Restrict API key usage to specific domains/applications
- Use different keys for web and Android platforms

#### Stripe API Keys
- Always use test keys (`pk_test_`, `sk_test_`) during development
- Never use live keys in development or staging environments
- Store live keys only in production environment variables

#### Database Credentials
- Use separate databases for development, staging, and production
- Never use production database credentials in development
- Use connection pooling and proper authentication

### Vercel Deployment Security

When deploying to Vercel:
1. Set environment variables in Vercel dashboard
2. Use Vercel's secret management for sensitive values
3. Enable domain restrictions for API keys
4. Use preview environments for testing

### Android Security Best Practices

1. **API Key Protection:**
   - Use `local.properties` for development keys
   - Use build variants for different environments
   - Implement certificate pinning for production

2. **App Signing:**
   - Keep signing keys secure and backed up
   - Use separate keys for debug and release builds
   - Never commit keystore files to version control

### Monitoring and Alerts

1. **GitHub Security:**
   - Enable Dependabot security updates
   - Use GitHub's secret scanning
   - Review any flagged potential secrets immediately

2. **API Key Rotation:**
   - Regularly rotate API keys
   - Monitor API key usage for unusual activity
   - Implement key expiration where possible

### What to Do If Keys Are Compromised

1. **Immediate Actions:**
   - Revoke the compromised keys immediately
   - Generate new keys
   - Update all environments with new keys
   - Review access logs for suspicious activity

2. **For Stripe Keys:**
   - Contact Stripe support immediately
   - Review all transactions
   - Update webhook endpoints

3. **For Google Maps Keys:**
   - Regenerate the API key
   - Update restrictions and quotas
   - Monitor usage for suspicious activity

### Code Review Checklist

Before committing code, ensure:
- [ ] No hardcoded API keys or secrets
- [ ] All sensitive files are in `.gitignore`
- [ ] Environment variables use placeholder values in examples
- [ ] No database credentials in code
- [ ] No personal information in comments

### Emergency Contacts

If you discover a security issue:
1. Do not commit the compromised information
2. Contact the development team immediately
3. Follow the incident response procedure
4. Document the incident for future prevention

---

**Remember:** When in doubt, don't commit it. It's better to ask the team than to accidentally expose sensitive information. 