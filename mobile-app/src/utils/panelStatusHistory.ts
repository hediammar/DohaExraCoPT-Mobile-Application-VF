import { supabase } from '../lib/supabase';

/**
 * Creates a panel status history record
 * @param panelId - The ID of the panel
 * @param status - The new status (number)
 * @param userId - The ID of the user making the change
 * @param notes - Optional notes about the status change
 * @param imageUrl - Optional image URL
 * @param createdAt - Optional custom date (defaults to current date)
 * @returns Promise with the created history record or error
 */
export async function createPanelStatusHistory(
  panelId: string,
  status: number,
  userId: string,
  notes?: string | null,
  imageUrl?: string | null,
  createdAt?: Date
): Promise<{ data: any; error: any }> {
  try {
    const historyData = {
      panel_id: panelId,
      status: status,
      created_at: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      user_id: userId,
      image_url: imageUrl || null,
      notes: notes || null
    };

    const { data, error } = await supabase
      .from('panel_status_histories')
      .insert(historyData)
      .select()
      .single();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}

/**
 * Creates panel status history records for multiple panels (bulk operation)
 * @param panels - Array of panel data with id, status, and user_id
 * @param notes - Optional notes for all panels
 * @param createdAt - Optional custom date (defaults to current date)
 * @returns Promise with the created history records or error
 */
export async function createBulkPanelStatusHistory(
  panels: Array<{ id: string; status: number; user_id: string }>,
  notes?: string | null,
  createdAt?: Date
): Promise<{ data: any; error: any }> {
  try {
    const historyData = panels.map(panel => ({
      panel_id: panel.id,
      status: panel.status,
      created_at: createdAt ? createdAt.toISOString() : new Date().toISOString(),
      user_id: panel.user_id,
      image_url: null,
      notes: notes || null
    }));

    const { data, error } = await supabase
      .from('panel_status_histories')
      .insert(historyData)
      .select();

    return { data, error };
  } catch (error) {
    return { data: null, error };
  }
}
