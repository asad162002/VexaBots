import { supabase } from './supabase';

// Single place that writes assignment history.
//
// The Assignment Log page and Analytics both read `assignment_history`, so every
// place an assignment changes has to call in here. Recording at some call sites
// and not others is what left LinkedIn assignments missing from the log.
export type LeadTable = 'leads' | 'linkedin_leads';

export interface RecordAssignmentInput {
  leadId: string;
  /** Table the lead lives in; decides where current state is read from. */
  leadTable: LeadTable;
  /** Who the lead now belongs to. Null means unassigned. */
  assignedTo: string | null;
  /** Who made the change. */
  assignedBy: string | null;
  notes?: string | null;
}

/**
 * Appends one assignment_history row without touching the lead.
 *
 * For the single-lead detail page, which is already applying its own update
 * (status, notes, meeting link) and must not have the assignment written twice
 * or race with that save.
 */
export async function recordAssignmentHistory({
  leadId,
  leadTable,
  assignedTo,
  assignedBy,
  notes = null,
}: RecordAssignmentInput): Promise<{ error: { message: string } | null }> {
  const { data: current } = await supabase
    .from(leadTable)
    .select('assigned_to')
    .eq('id', leadId)
    .single();

  const previousAssignee = current
    ? ((current as { assigned_to: string | null }).assigned_to ?? null)
    : null;

  // Nothing changed: do not write a duplicate history row.
  if (previousAssignee === assignedTo) {
    return { error: null };
  }

  // assignment_history.lead_id is FK'd to leads(id), so a LinkedIn contact id
  // belongs in linkedin_lead_id instead. Getting this wrong produced:
  //   violates foreign key constraint "assignment_history_lead_id_fkey"
  const { error } = await supabase.from('assignment_history').insert({
    lead_id: leadTable === 'leads' ? leadId : null,
    linkedin_lead_id: leadTable === 'linkedin_leads' ? leadId : null,
    assigned_to: assignedTo,
    assigned_by: assignedBy,
    assigned_at: new Date().toISOString(),
    previous_assignee: previousAssignee,
    notes,
  });

  return { error };
}

/**
 * Writes assignment history AND mirrors the new assignee onto the lead.
 *
 * For bulk paths, which want current state and history kept together. Returns
 * the update error when the mirror write fails, so callers can react.
 */
export async function recordAssignment({
  leadId,
  leadTable,
  assignedTo,
  assignedBy,
  notes = null,
}: RecordAssignmentInput): Promise<{ error: { message: string } | null }> {
  const now = new Date().toISOString();

  const history = await recordAssignmentHistory({
    leadId,
    leadTable,
    assignedTo,
    assignedBy,
    notes,
  });

  if (history.error) {
    return history;
  }

  const { error } = await supabase
    .from(leadTable)
    .update({
      assigned_to: assignedTo,
      assigned_at: assignedTo ? now : null,
      assigned_by: assignedTo ? assignedBy : null,
      updated_at: now,
    })
    .eq('id', leadId);

  return { error };
}
