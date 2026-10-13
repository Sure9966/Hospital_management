import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://cywhymqevyoaciordvip.supabase.co';
const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'sb_publishable_KrFHFGBlpJY7wkueNfsFfg_jNg-W5dK';

export const SUPABASE_BUCKET =
  process.env.NEXT_PUBLIC_SUPABASE_BUCKET || 'hospital-pdfs';

export const supabase: SupabaseClient = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    },
  },
);

/**
 * Uploads a file directly to Supabase Storage bucket.
 */
export async function uploadFileToSupabase(
  file: File,
  folder: string = 'lab-reports',
): Promise<{ success: boolean; url: string; key: string; error?: string }> {
  try {
    const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${folder}/${Date.now()}_${cleanFileName}`;

    const { data, error } = await supabase.storage
      .from(SUPABASE_BUCKET)
      .upload(storageKey, file, {
        cacheControl: '3600',
        upsert: true,
        contentType: file.type || 'application/pdf',
      });

    if (error) {
      console.warn('Direct Supabase upload error:', error.message);
      return { success: false, url: '', key: '', error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from(SUPABASE_BUCKET)
      .getPublicUrl(storageKey);

    return {
      success: true,
      url: publicUrlData.publicUrl,
      key: storageKey,
    };
  } catch (err: any) {
    console.error('Failed to upload file to Supabase:', err);
    return { success: false, url: '', key: '', error: err.message };
  }
}

/**
 * Returns the public URL for any key stored in the Supabase bucket.
 */
export function getSupabasePublicUrl(key: string): string {
  const { data } = supabase.storage.from(SUPABASE_BUCKET).getPublicUrl(key);
  return data.publicUrl;
}
