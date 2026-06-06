# Deployment Checklist

Use this checklist to ensure your AI-powered visa assessment backend is properly set up and deployed.

## 📋 Pre-Deployment Setup

### 1. Environment Configuration

- [ ] Copy `.env.example` to `.env`
- [ ] Set `DATABASE_URL` (PostgreSQL async connection string)
- [ ] Set `ANTHROPIC_API_KEY` (get from https://console.anthropic.com/)
- [ ] Set `RESEND_API_KEY` (get from https://resend.com/)
- [ ] Set `LEMONSQUEEZY_WEBHOOK_SECRET` (from LemonSqueezy dashboard)
- [ ] Set R2 credentials (if using Cloudflare R2)

### 2. Database Setup

- [ ] PostgreSQL is running (or `docker-compose up -d`)
- [ ] Database exists (or will be created automatically)
- [ ] Run: `alembic revision --autogenerate -m "Initial migration with AI fields"`
- [ ] Run: `alembic upgrade head`
- [ ] Verify tables exist: `psql -d visa_db -c "\dt"`

### 3. Dependencies

- [ ] Run: `pip install -r requirements.txt`
- [ ] Verify Anthropic SDK: `python -c "import anthropic; print(anthropic.__version__)"`
- [ ] Verify all imports work: `python -c "from services.ai_scorer import score_application"`

### 4. Testing

- [ ] Test AI scorer: `python test_ai_scorer.py`
- [ ] Verify API starts: `uvicorn main:app --reload`
- [ ] Check health endpoint: `curl http://localhost:8000/`
- [ ] View API docs: http://localhost:8000/docs
- [ ] Test full flow (see API_TESTING.md)

## 🚀 Production Deployment

### Security

- [ ] Change CORS `allow_origins` from `["*"]` to your frontend domain
- [ ] Enable HTTPS (required for webhooks)
- [ ] Set up rate limiting (add slowapi or similar)
- [ ] Use strong database password
- [ ] Rotate API keys regularly
- [ ] Set up firewall rules
- [ ] Enable database SSL connection

### Infrastructure

- [ ] Deploy to production host (Railway, Fly.io, AWS, etc.)
- [ ] Set up production PostgreSQL (managed database recommended)
- [ ] Configure environment variables in hosting platform
- [ ] Set up health check endpoint monitoring
- [ ] Configure auto-restart on crashes
- [ ] Set up log aggregation (Datadog, LogRocket, etc.)

### Database

- [ ] Run migrations on production database
- [ ] Set up automated backups (daily minimum)
- [ ] Configure connection pooling
- [ ] Add database monitoring
- [ ] Test rollback procedure

### Webhooks

- [ ] Deploy API to public URL (https://your-domain.com)
- [ ] Add webhook to LemonSqueezy: `https://your-domain.com/api/webhooks/lemonsqueezy`
- [ ] Test webhook with LemonSqueezy test mode
- [ ] Verify webhook signature validation works
- [ ] Monitor webhook delivery logs

### Email

- [ ] Verify sender domain in Resend
- [ ] Set up SPF/DKIM records
- [ ] Test email delivery
- [ ] Set up email delivery monitoring
- [ ] Configure bounce handling

### Monitoring

- [ ] Set up error tracking (Sentry, Rollbar)
- [ ] Configure performance monitoring (New Relic, Datadog)
- [ ] Set up uptime monitoring (Uptime Robot, Pingdom)
- [ ] Create alerts for API failures
- [ ] Monitor Anthropic API costs
- [ ] Track success/error rates

## 📊 Post-Deployment

### Verification

- [ ] Test end-to-end flow in production
- [ ] Verify emails are delivered
- [ ] Test payment webhook
- [ ] Check database is storing data correctly
- [ ] Verify CORS is working with frontend
- [ ] Test error handling (invalid API key, etc.)

### Performance

- [ ] Load test the API (100+ concurrent requests)
- [ ] Check database query performance
- [ ] Monitor API response times
- [ ] Verify Anthropic API latency
- [ ] Test under peak load

### Documentation

- [ ] Document production deployment process
- [ ] Create runbook for common issues
- [ ] Document rollback procedure
- [ ] Share API documentation with frontend team
- [ ] Create incident response plan

## 🔧 Maintenance

### Daily

- [ ] Check error logs
- [ ] Monitor API costs (Anthropic dashboard)
- [ ] Review failed email deliveries

### Weekly

- [ ] Review API performance metrics
- [ ] Check database size and backup status
- [ ] Analyze score distribution (are scores realistic?)
- [ ] Review user feedback on report quality

### Monthly

- [ ] Review and rotate API keys
- [ ] Audit database backups
- [ ] Review security logs
- [ ] Optimize database queries if needed
- [ ] Update dependencies (security patches)

## 🐛 Troubleshooting

### Common Production Issues

**High Anthropic API costs**
- Review number of requests
- Check for duplicate scoring calls
- Consider implementing caching
- Switch to Sonnet for non-critical requests

**Slow API responses**
- Check database connection pool
- Monitor Anthropic API latency
- Add caching layer (Redis)
- Optimize database queries

**Webhook failures**
- Verify webhook secret is correct
- Check webhook signature validation
- Review LemonSqueezy delivery logs
- Ensure endpoint is publicly accessible

**Email delivery issues**
- Check Resend API key
- Verify SPF/DKIM records
- Review bounce logs
- Check sender domain reputation

## 📈 Scaling

### When you reach 1,000+ reports/month

- [ ] Implement request caching
- [ ] Add Redis for session management
- [ ] Set up database read replicas
- [ ] Consider CDN for static assets
- [ ] Implement background job processing (Celery, Bull)

### When you reach 10,000+ reports/month

- [ ] Horizontal scaling (multiple API instances)
- [ ] Load balancer setup
- [ ] Database sharding
- [ ] Implement prompt caching
- [ ] Consider fine-tuned model

## ✅ Launch Checklist

Before announcing to users:

- [ ] All tests pass
- [ ] Production environment verified
- [ ] Monitoring is active
- [ ] Backup system tested
- [ ] Error tracking configured
- [ ] Webhooks working
- [ ] Emails delivering
- [ ] Performance acceptable
- [ ] Security audit completed
- [ ] Documentation complete
- [ ] Support system ready
- [ ] Rollback plan documented

## 📞 Emergency Contacts

Keep these handy:

- **Anthropic Support:** https://support.anthropic.com/
- **LemonSqueezy Support:** https://www.lemonsqueezy.com/help
- **Resend Support:** https://resend.com/support
- **Database Provider Support:** [Your provider]
- **Hosting Provider Support:** [Your provider]

## 🎯 Success Metrics

Track these KPIs:

1. **API Uptime:** Target 99.9%
2. **Average Response Time:** Target <2 seconds
3. **Error Rate:** Target <0.1%
4. **Email Delivery Rate:** Target >99%
5. **Webhook Success Rate:** Target >99%
6. **User Satisfaction:** Track via feedback
7. **Cost per Report:** Monitor Anthropic costs

## 🚨 Incident Response

If production goes down:

1. Check status page (Anthropic, hosting, database)
2. Review error logs
3. Verify environment variables
4. Check database connectivity
5. Restart API server
6. Rollback recent deployments if needed
7. Notify users if downtime >5 minutes
8. Post-mortem after resolution

---

**Last Updated:** 2026-04-25

**Next Review:** When deploying to production
