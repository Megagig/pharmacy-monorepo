# Diagnostic Module Deployment Guide

## Overview

This guide covers the deployment of the AI-Powered Diagnostics & Therapeutics module for the PharmacyCopilot SaaS platform. The module provides comprehensive clinical decision support through AI analysis, lab integration, and drug interaction checking.

## Prerequisites

### System Requirements

- **Node.js**: 18.x or higher
- **MongoDB**: 6.0 or higher
- **Redis**: 7.0 or higher (optional, for caching)
- **Memory**: Minimum 4GB RAM (8GB recommended for production)
- **Storage**: Minimum 20GB free space
- **Network**: Stable internet connection for external API access

### External API Access

The module requires access to the following external services:

- **OpenRouter API**: For AI diagnostic analysis
- **RxNorm API**: For drug information and interactions
- **OpenFDA API**: For drug safety information
- **FHIR Endpoints**: For lab system integration (optional)
- **LOINC API**: For lab test code mapping (optional)

## Environment Configuration

### Environment Variables

Create or update your `.env` file with the following variables:

```bash
# Environment
NODE_ENV=production

# AI Configuration
OPENROUTER_API_KEY=sk-or-your-api-key-here
OPENROUTER_API_URL=https://openrouter.ai/api/v1
AI_MODEL=deepseek/deepseek-chat-v3.1
AI_MAX_TOKENS=4000
AI_TEMPERATURE=0.1
AI_TIMEOUT=60000
AI_RETRY_ATTEMPTS=3
AI_REQUESTS_PER_MINUTE=60
AI_TOKENS_PER_HOUR=100000

# External APIs
RXNORM_API_URL=https://rxnav.nlm.nih.gov/REST
OPENFDA_API_URL=https://api.fda.gov
OPENFDA_API_KEY=your-openfda-key-here
FHIR_API_URL=https://your-fhir-server.com/fhir
FHIR_API_KEY=your-fhir-key-here
LOINC_API_URL=https://fhir.loinc.org

# Cache Configuration
CACHE_ENABLED=true
CACHE_MAX_SIZE=209715200
CACHE_DEFAULT_TTL=3600000
REDIS_URL=redis://localhost:6379

# Database Configuration
DB_POOL_SIZE=15
DB_QUERY_TIMEOUT=30000
DB_INDEXING_STRATEGY=background

# Security Configuration
ENCRYPTION_ENABLED=true
AUDIT_LOGGING=true
RATE_LIMITING_ENABLED=true
API_KEY_ENCRYPTION_KEY=your-32-character-encryption-key

# Monitoring Configuration
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=15000
ALERT_RESPONSE_TIME=5000
ALERT_ERROR_RATE=0.05
ALERT_MEMORY_USAGE=0.8

# Feature Flags
FEATURE_AI_DIAGNOSTICS=true
FEATURE_LAB_INTEGRATION=true
FEATURE_DRUG_INTERACTIONS=true
FEATURE_FHIR_INTEGRATION=false
FEATURE_ADVANCED_ANALYTICS=false
```

### Environment-Specific Configurations

#### Development Environment

```bash
NODE_ENV=development
AI_MAX_TOKENS=2000
AI_REQUESTS_PER_MINUTE=30
CACHE_MAX_SIZE=52428800
DB_POOL_SIZE=5
HEALTH_CHECK_INTERVAL=60000
```

#### Staging Environment

```bash
NODE_ENV=staging
AI_MAX_TOKENS=3000
AI_REQUESTS_PER_MINUTE=45
CACHE_MAX_SIZE=104857600
DB_POOL_SIZE=8
HEALTH_CHECK_INTERVAL=30000
```

#### Production Environment

```bash
NODE_ENV=production
AI_MAX_TOKENS=4000
AI_REQUESTS_PER_MINUTE=60
CACHE_MAX_SIZE=209715200
DB_POOL_SIZE=15
HEALTH_CHECK_INTERVAL=15000
```

## Deployment Steps

### 1. Pre-Deployment Checklist

- [ ] Verify all environment variables are set
- [ ] Confirm external API access and credentials
- [ ] Check database connectivity and permissions
- [ ] Ensure sufficient system resources
- [ ] Backup existing database
- [ ] Review security configurations

### 2. Database Migration

Run the database migrations to set up the diagnostic module:

```bash
# Check migration status
npm run migration:status

# Run pending migrations
npm run migration:run

# Validate migration integrity
npm run migration:validate
```

### 3. Index Creation

Create recommended database indexes for optimal performance:

```bash
# Create indexes in background (production)
npm run db:create-indexes

# Monitor index creation progress
npm run db:index-status
```

### 4. Cache Initialization

Initialize and warm up the cache system:

```bash
# Initialize cache
npm run cache:init

# Warm up frequently accessed data
npm run cache:warmup
```

### 5. Health Check Verification

Verify all services are healthy before going live:

```bash
# Run comprehensive health check
npm run health:check

# Test external API connectivity
npm run health:external-apis

# Validate AI service integration
npm run health:ai-service
```

### 6. Security Validation

Ensure all security measures are properly configured:

```bash
# Run security audit
npm run security:audit

# Test rate limiting
npm run security:test-rate-limits

# Validate encryption
npm run security:test-encryption
```

## Post-Deployment Verification

### 1. Functional Testing

Test core diagnostic functionality:

```bash
# Run diagnostic workflow tests
npm run test:diagnostic-workflow

# Test AI integration
npm run test:ai-integration

# Test lab integration
npm run test:lab-integration

# Test drug interaction checking
npm run test:drug-interactions
```

### 2. Performance Testing

Verify system performance under load:

```bash
# Run load tests
npm run test:load

# Monitor performance metrics
npm run monitor:performance

# Check memory usage
npm run monitor:memory
```

### 3. Security Testing

Validate security implementations:

```bash
# Run penetration tests
npm run test:security

# Test input sanitization
npm run test:sanitization

# Validate access controls
npm run test:rbac
```

## Monitoring and Alerting

### Health Check Endpoints

The module provides several health check endpoints:

- `GET /api/health` - Overall system health
- `GET /api/health/diagnostic` - Diagnostic module health
- `GET /api/health/ai` - AI service health
- `GET /api/health/external` - External API health
- `GET /api/health/cache` - Cache system health

### Monitoring Metrics

Key metrics to monitor:

- **Response Times**: API response times should be < 5 seconds
- **Error Rates**: Should be < 5% for all endpoints
- **AI Processing Time**: Should be < 20 seconds for typical cases
- **Cache Hit Rate**: Should be > 70% for optimal performance
- **Memory Usage**: Should be < 80% of available memory
- **Database Connections**: Monitor pool utilization

### Alerting Thresholds

Configure alerts for:

- Response time > 5 seconds
- Error rate > 5%
- Memory usage > 80%
- Cache hit rate < 50%
- AI service failures
- External API failures

## Backup and Recovery

### Database Backup

```bash
# Create backup
mongodump --db PharmacyCopilot --collection diagnosticrequests --out /backup/diagnostic-$(date +%Y%m%d)

# Restore from backup
mongorestore --db PharmacyCopilot /backup/diagnostic-20241201
```

### Configuration Backup

```bash
# Export configuration
npm run config:export > config-backup-$(date +%Y%m%d).json

# Import configuration
npm run config:import config-backup-20241201.json
```

### Cache Backup

```bash
# Export cache data
npm run cache:export > cache-backup-$(date +%Y%m%d).json

# Import cache data
npm run cache:import cache-backup-20241201.json
```

## Rollback Procedures

### Emergency Rollback

If critical issues are detected:

1. **Immediate Actions**:

   ```bash
   # Disable AI diagnostics feature
   npm run feature:disable ai_diagnostics

   # Switch to manual workflow
   npm run workflow:manual-mode
   ```

2. **Database Rollback**:

   ```bash
   # Rollback specific migration
   npm run migration:rollback create_diagnostic_collections

   # Restore from backup
   mongorestore --drop --db PharmacyCopilot /backup/pre-deployment
   ```

3. **Service Restart**:
   ```bash
   # Restart with previous configuration
   pm2 restart PharmacyCopilot-backend --update-env
   ```

### Gradual Rollback

For non-critical issues:

1. **Feature Flag Rollback**:

   ```bash
   # Gradually disable features
   npm run feature:rollout ai_diagnostics 50  # 50% rollout
   npm run feature:rollout ai_diagnostics 0   # Complete disable
   ```

2. **Configuration Rollback**:
   ```bash
   # Revert to previous configuration
   npm run config:revert
   ```

## Troubleshooting

### Common Issues

#### AI Service Connection Issues

```bash
# Test AI service connectivity
curl -X POST https://openrouter.ai/api/v1/chat/completions \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"deepseek/deepseek-chat-v3.1","messages":[{"role":"user","content":"test"}]}'

# Check API key validity
npm run ai:test-connection
```

#### Database Performance Issues

```bash
# Check slow queries
db.diagnosticrequests.find().explain("executionStats")

# Monitor index usage
db.diagnosticrequests.getIndexes()

# Check connection pool
db.serverStatus().connections
```

#### Memory Issues

```bash
# Check memory usage
free -h
ps aux --sort=-%mem | head

# Monitor Node.js memory
node --expose-gc app.js
```

#### Cache Issues

```bash
# Check Redis connection
redis-cli ping

# Monitor cache statistics
redis-cli info memory

# Clear cache if needed
npm run cache:clear
```

### Log Analysis

Important log locations:

- Application logs: `/var/log/PharmacyCopilot/app.log`
- Error logs: `/var/log/PharmacyCopilot/error.log`
- Audit logs: `/var/log/PharmacyCopilot/audit.log`
- Performance logs: `/var/log/PharmacyCopilot/performance.log`

### Performance Optimization

If performance issues are detected:

1. **Database Optimization**:

   ```bash
   # Analyze query performance
   npm run db:analyze-queries

   # Optimize indexes
   npm run db:optimize-indexes
   ```

2. **Cache Optimization**:

   ```bash
   # Analyze cache performance
   npm run cache:analyze

   # Adjust cache settings
   npm run cache:optimize
   ```

3. **AI Service Optimization**:

   ```bash
   # Adjust AI parameters
   npm run ai:optimize-params

   # Enable request batching
   npm run ai:enable-batching
   ```

## Security Considerations

### API Key Management

- Store API keys securely using environment variables
- Rotate API keys regularly (recommended: every 30 days)
- Monitor API key usage and set up alerts for unusual activity
- Use different API keys for different environments

### Data Encryption

- Enable encryption for sensitive data at rest
- Use TLS 1.3 for all external API communications
- Implement proper key management and rotation
- Audit encryption implementations regularly

### Access Control

- Implement proper RBAC for diagnostic features
- Use workspace isolation for multi-tenant security
- Monitor and log all access attempts
- Implement rate limiting to prevent abuse

### Audit Logging

- Enable comprehensive audit logging
- Store audit logs securely with integrity protection
- Implement log retention policies
- Regular audit log analysis and monitoring

## Maintenance

### Regular Maintenance Tasks

#### Daily

- Monitor system health and performance metrics
- Check error logs for any issues
- Verify external API connectivity
- Monitor cache performance

#### Weekly

- Review performance trends
- Analyze audit logs
- Check for security alerts
- Update monitoring dashboards

#### Monthly

- Rotate API keys
- Review and update security configurations
- Analyze usage patterns and optimize accordingly
- Update documentation as needed

#### Quarterly

- Comprehensive security audit
- Performance optimization review
- Disaster recovery testing
- Update external API integrations

### Scaling Considerations

As usage grows, consider:

1. **Horizontal Scaling**:
   - Add more application instances
   - Implement load balancing
   - Use Redis cluster for caching

2. **Database Scaling**:
   - Implement read replicas
   - Consider sharding for large datasets
   - Optimize queries and indexes

3. **AI Service Scaling**:
   - Implement request queuing
   - Use multiple AI service providers
   - Implement intelligent routing

## Support and Documentation

### Additional Resources

- [API Documentation](./API_DOCUMENTATION.md)
- [Security Guide](./SECURITY_GUIDE.md)
- [Performance Tuning](./PERFORMANCE_TUNING.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)

### Support Contacts

- **Technical Support**: support@PharmacyCopilot.com
- **Security Issues**: security@PharmacyCopilot.com
- **Emergency Contact**: +1-800-PHARMA-HELP

### Version Information

- **Module Version**: 1.0.0
- **API Version**: v1
- **Last Updated**: December 2024
- **Compatibility**: PharmacyCopilot Platform v2.0+
