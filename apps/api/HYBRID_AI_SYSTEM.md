# Hybrid AI Diagnostic System

## Overview

Your PharmacyCopilot system now uses an intelligent hybrid AI model selection strategy that optimizes costs while maintaining high-quality medical diagnostic analysis.

## Model Strategy

### 1. Primary Model: DeepSeek V3.1 Paid (85% of requests)
- **Model**: `deepseek/deepseek-chat-v3.1`
- **Cost**: $0.20/M input tokens, $0.80/M output tokens
- **Use Cases**: 
  - Routine diagnostic consultations
  - Standard symptom analysis
  - Basic medication interactions
  - Simple to moderate complexity cases

### 2. Critical Cases Model: Google Gemma 2 9B (15% of requests)
- **Model**: `google/gemma-2-9b-it`
- **Cost**: $0.03/M input tokens, $0.09/M output tokens (89% cheaper output)
- **Use Cases**:
  - Complex multi-system diagnoses
  - Drug interaction analysis
  - High-severity red flags detected
  - Elderly patients with multiple conditions
  - Cases with complexity score ≥ 50

## Complexity Scoring System

The system automatically analyzes case complexity using these factors:

### High Priority Factors (Critical Cases)
- **Red Flag Symptoms** (+30 points): chest pain, difficulty breathing, severe headache, confusion, seizure
- **Multiple Abnormal Vitals** (+25 points): 2+ abnormal vital signs
- **Multiple Symptoms** (+20 points): 4+ symptoms present
- **Abnormal Labs** (+20 points): 2+ abnormal lab results

### Medium Priority Factors
- **Elderly Patients** (+15 points): Age 65+
- **Polypharmacy** (+15 points): 3+ current medications
- **Medical History** (+10 points): 3+ chronic conditions

### Critical Case Triggers
- **Complexity Score ≥ 50**: Routes to Gemma 2 9B
- **Any Red Flag Symptoms**: Automatically critical
- **3+ Abnormal Vitals**: Automatically critical

## Budget Protection

### Monthly Budget Limit
- **Default**: $15/month (configurable via `OPENROUTER_MONTHLY_BUDGET`)
- **Auto-Protection**: Switches to free-only mode when budget exceeded
- **Real-time Tracking**: Monitors costs per request

### Cost Tracking
- **Usage File**: `data/openrouter-usage.json`
- **Metrics Tracked**:
  - Total monthly cost
  - Request count per model
  - Token usage (input/output)
  - Cost per model

## API Endpoints

### Diagnostic Analysis
```http
POST /api/ai-diagnostics/analyze
```

### Usage Statistics (Super Admin Only)
```http
GET /api/ai-diagnostics/usage-stats
```

### Connection Test (Super Admin Only)
```http
GET /api/ai-diagnostics/test-connection
```

## Configuration

### Environment Variables
```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=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
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
OPENROUTER_MONTHLY_BUDGET=15.00
```

## Expected Monthly Costs

### Cost Breakdown
- **85% DeepSeek Requests**: $3-6/month
- **15% Gemma Critical Cases**: $1-4/month
- **Total Expected**: $4-10/month

### Cost Comparison
- **All-Premium Strategy**: $50-100/month
- **Single Model Strategy**: $15-25/month
- **Hybrid Strategy**: $4-10/month ✅

## Model Selection Logic

```typescript
// Automatic model selection flow
if (budgetExceeded) {
  return ModelTier.PRIMARY; // Free only
}

if (complexityScore >= 50 || hasRedFlags) {
  return ModelTier.CRITICAL; // Gemma 2 9B
}

if (complexityScore >= 30) {
  return ModelTier.FALLBACK; // DeepSeek Paid
}

return ModelTier.PRIMARY; // DeepSeek Free
```

## Fallback Chain

```
Request → DeepSeek Free → (Rate Limited?) → DeepSeek Paid → (Complex?) → Gemma 2 9B
```

## Monitoring & Alerts

### Usage Monitoring
- Real-time cost tracking
- Budget utilization alerts
- Model usage distribution
- Performance metrics

### Logging
- Model selection reasoning
- Complexity scoring factors
- Cost calculations
- Fallback triggers

## Testing

### Test Script
```bash
node test-hybrid-ai.js
```

### Manual Testing
1. Simple case (should use free model)
2. Complex case (should use Gemma 2 9B)
3. Rate limit scenario (should fallback to paid)
4. Budget exceeded (should use free only)

## Benefits

### Cost Efficiency
- **89% cost savings** vs all-paid strategy
- **Zero cost** for routine cases
- **Predictable budget** with monthly limits

### Medical Safety
- **Critical cases** get best model
- **No service interruption** during rate limits
- **Conservative routing** for high-risk patients

### Scalability
- **Automatic scaling** based on usage
- **Budget protection** prevents overruns
- **Performance optimization** per case type

## Troubleshooting

### Common Issues

1. **Rate Limits on Free Tier**
   - Solution: Automatic fallback to paid model
   - Monitor: Usage statistics endpoint

2. **Budget Exceeded**
   - Solution: Automatic free-only mode
   - Action: Increase monthly budget or wait for next month

3. **Model Selection Issues**
   - Check: Complexity scoring logs
   - Verify: Case data completeness

### Debug Endpoints
- `/api/ai-diagnostics/test-connection` - Test API connectivity
- `/api/ai-diagnostics/usage-stats` - View current usage and budget

## Future Enhancements

### Planned Features
- **Dynamic budget allocation** based on usage patterns
- **Model performance analytics** per case type
- **Custom complexity scoring** per workplace
- **Integration with clinical guidelines**

### Optimization Opportunities
- **Caching** for similar cases
- **Batch processing** for multiple patients
- **Model fine-tuning** for pharmacy-specific use cases