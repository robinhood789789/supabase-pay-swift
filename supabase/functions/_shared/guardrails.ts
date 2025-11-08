import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface GuardrailResult {
  blocked: boolean;
  requiresApproval: boolean;
  matchedRules: any[];
  reason?: string;
}

export interface GuardrailContext {
  action: string;
  amount?: number;
  currency?: string;
  userId: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

/**
 * Evaluate guardrails for a given action
 * Returns whether action should be blocked and if approval is required
 */
export async function evaluateGuardrails(
  supabase: SupabaseClient,
  context: GuardrailContext
): Promise<GuardrailResult> {
  try {
    // Fetch enabled guardrails for this tenant
    const { data: guardrails, error } = await supabase
      .from('guardrails')
      .select('*')
      .eq('tenant_id', context.tenantId)
      .eq('enabled', true)
      .eq('rule_type', context.action);

    if (error) {
      console.error('[Guardrails] Query error:', error);
      return { blocked: false, requiresApproval: false, matchedRules: [] };
    }

    if (!guardrails || guardrails.length === 0) {
      return { blocked: false, requiresApproval: false, matchedRules: [] };
    }

    const matchedRules: any[] = [];

    for (const guardrail of guardrails) {
      const config = guardrail.rule_config;
      let matched = false;

      // Evaluate rule based on type
      switch (context.action) {
        case 'refund':
          matched = evaluateRefundRule(config, context);
          break;
        case 'export':
          matched = await evaluateExportRule(supabase, config, context);
          break;
        case 'api-key-create':
          matched = evaluateApiKeyRule(config, context);
          break;
        default:
          console.warn(`[Guardrails] Unknown action type: ${context.action}`);
      }

      if (matched) {
        matchedRules.push(guardrail);
      }
    }

    if (matchedRules.length === 0) {
      return { blocked: false, requiresApproval: false, matchedRules: [] };
    }

    // Determine if we should block or require approval
    const requiresApproval = matchedRules.some(r => r.rule_config.action === 'require_approval');
    const blocked = matchedRules.some(r => r.rule_config.action === 'block');

    return {
      blocked,
      requiresApproval,
      matchedRules,
      reason: matchedRules.map(r => r.rule_config.reason || 'Guardrail rule matched').join('; ')
    };
  } catch (error) {
    console.error('[Guardrails] Evaluation error:', error);
    return { blocked: false, requiresApproval: false, matchedRules: [] };
  }
}

/**
 * Evaluate refund-specific rules
 */
function evaluateRefundRule(config: any, context: GuardrailContext): boolean {
  // Check amount threshold
  if (config.max_amount && context.amount && context.amount > config.max_amount) {
    return true;
  }

  // Check if refund is for old payment (would need payment creation date)
  if (config.max_age_days && context.metadata?.payment_created_at) {
    const paymentDate = new Date(context.metadata.payment_created_at);
    const daysSince = (Date.now() - paymentDate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > config.max_age_days) {
      return true;
    }
  }

  return false;
}

/**
 * Evaluate export-specific rules
 */
async function evaluateExportRule(
  supabase: SupabaseClient,
  config: any,
  context: GuardrailContext
): Promise<boolean> {
  if (!config.max_per_day) return false;

  // Count exports today by this user
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('tenant_id', context.tenantId)
    .eq('actor_user_id', context.userId)
    .eq('action', 'export.created')
    .gte('created_at', todayStart.toISOString());

  if (error) {
    console.error('[Guardrails] Export count error:', error);
    return false;
  }

  return (data?.length || 0) >= config.max_per_day;
}

/**
 * Evaluate API key creation rules
 */
function evaluateApiKeyRule(config: any, context: GuardrailContext): boolean {
  if (!config.business_hours_only) return false;

  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Check if outside business hours (9-17, Mon-Fri)
  const isWeekend = day === 0 || day === 6;
  const outsideHours = hour < 9 || hour >= 17;

  return isWeekend || outsideHours;
}

/**
 * Create an approval request for a blocked action
 */
export async function createApprovalRequest(
  supabase: SupabaseClient,
  context: {
    tenantId: string;
    requestedBy: string;
    actionType: string;
    actionData: any;
    amount?: number;
    reason: string;
  }
): Promise<{ approvalId: string } | { error: string }> {
  try {
    // Determine required approvers based on tenant settings
    const { data: approversData } = await supabase
      .from('memberships')
      .select('user_id, roles!inner(name)')
      .eq('tenant_id', context.tenantId)
      .in('roles.name', ['owner', 'admin']);

    const requiredApprovers = approversData?.map(m => m.user_id) || [];

    const { data: approval, error } = await supabase
      .from('approvals')
      .insert({
        tenant_id: context.tenantId,
        requested_by: context.requestedBy,
        action_type: context.actionType,
        action_data: context.actionData,
        status: 'pending',
        reason: context.reason,
      })
      .select()
      .single();

    if (error) throw error;

    // Log the approval creation
    await supabase
      .from('audit_logs')
      .insert({
        tenant_id: context.tenantId,
        actor_user_id: context.requestedBy,
        action: 'approval.created',
        target: `approval:${approval.id}`,
        after: { action_type: context.actionType, amount: context.amount }
      });

    return { approvalId: approval.id };
  } catch (error) {
    console.error('[Guardrails] Approval creation error:', error);
    return { error: (error as Error).message };
  }
}
