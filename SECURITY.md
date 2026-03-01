# Security Policy

## 🔒 Supported Versions

We take security seriously. The following versions are currently being supported with security updates:

| Version | Supported          |
| ------- | ------------------ |
| main    | :white_check_mark: |

## 🚨 Reporting a Vulnerability

We appreciate the responsible disclosure of security vulnerabilities. If you discover a security issue, please follow these steps:

### 1️⃣ Do Not
- **Do not** open a public GitHub issue
- **Do not** disclose the vulnerability publicly until it has been addressed

### 2️⃣ Do
- **Report the vulnerability** by opening a GitHub Security Advisory (preferred) or contacting the maintainers privately
- Provide detailed information about the vulnerability:
  - Description of the issue
  - Steps to reproduce
  - Potential impact
  - Suggested fix (if you have one)

### 3️⃣ What to Expect
- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will assess the vulnerability and determine its severity
- **Timeline**: We aim to provide a fix or timeline within 7 days
- **Credit**: If you wish, we will credit you in the security advisory and release notes

## 🛡️ Security Best Practices

When deploying this application:

### Environment Variables
- **Never commit `.env` files** to version control
- **Change default credentials** immediately after deployment
- **Use strong passwords** for admin accounts
- **Rotate API keys** regularly

### API Security
- **Enable HTTPS** in production
- **Configure CORS** properly for your domain
- **Implement rate limiting** to prevent abuse
- **Validate all inputs** on the backend

### Database Security
- **Use parameterized queries** (already implemented with Pandas)
- **Encrypt sensitive data** at rest
- **Backup regularly** and test restore procedures
- **Limit database access** to only necessary services

### Frontend Security
- **Implement CSP** (Content Security Policy) headers
- **Sanitize user inputs** to prevent XSS
- **Use HTTPS only** cookies for authentication
- **Keep dependencies updated**

### Deployment Security
- **Use a firewall** to restrict access
- **Keep system packages updated**
- **Monitor logs** for suspicious activity
- **Use least privilege** principle for service accounts
- **Enable security headers** (HSTS, X-Frame-Options, etc.)

## 🔐 Known Security Considerations

### Current Implementation
This project is designed for demonstration purposes with the following considerations:

1. **In-Memory User Storage**: Users are stored in a JSON file. For production:
   - Migrate to a proper database (PostgreSQL, MySQL)
   - Implement proper session management
   - Add JWT or OAuth authentication

2. **API Keys in Environment**: Ensure `.env` is never committed:
   - Use secrets management systems (AWS Secrets Manager, Azure Key Vault)
   - Rotate keys regularly
   - Monitor API usage

3. **File Uploads**: Currently limited to CSV uploads:
   - Validate file types and sizes
   - Scan uploads for malware
   - Store uploads outside web root

## 📚 Security Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Flask Security Considerations](https://flask.palletsprojects.com/en/latest/security/)
- [Python Security Best Practices](https://python.readthedocs.io/en/latest/library/security_warnings.html)

## 🆘 Contact

For urgent security matters, please contact the maintainers through:
- GitHub Security Advisory (preferred)
- Private email to repository maintainers

---

**Thank you for helping keep Smart City Resource Optimization System secure! 🛡️**
