import { supabase } from "./supabase.js";

const PROFILE_BUCKET = "profiles";

export async function uploadProfilePhoto(file, userId) {
  if (!file) throw new Error("No file provided.");
  if (!userId) throw new Error("No user id provided.");

  const filePath = userId + "/photo.jpg";

  const uploadResult = await supabase.storage
    .from(PROFILE_BUCKET)
    .upload(filePath, file, {
      upsert: true,
      contentType: file.type
    });

  if (uploadResult.error) {
    throw uploadResult.error;
  }

  const publicResult = supabase.storage
    .from(PROFILE_BUCKET)
    .getPublicUrl(filePath);

  if (!publicResult || !publicResult.data || !publicResult.data.publicUrl) {
    throw new Error("Failed to generate public URL.");
  }

  return publicResult.data.publicUrl;
}
