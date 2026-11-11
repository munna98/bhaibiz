import { supabase } from "@/integrations/supabase/client";
import { BUCKET } from "@/lib/workers";

/** Shrinks a photo in the browser so uploads are quick on mobile data. */
export async function resizeImage(file: File, max = 900, quality = 0.82): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) { bitmap.close(); throw new Error("Could not read image"); }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not read image"))), "image/jpeg", quality),
  );
}

export async function uploadWorkerPhoto(companyId: string, workerId: string, file: File) {
  const blob = await resizeImage(file, 700);
  const path = `${companyId}/${workerId}/photo/${Date.now()}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: "image/jpeg" });
  if (up.error) throw up.error;
  const { error } = await supabase.from("workers").update({ photo_path: path }).eq("id", workerId);
  if (error) throw error;
  return path;
}

export async function uploadAadhaarDoc(companyId: string, workerId: string, file: File) {
  const isPdf = file.type === "application/pdf";
  if (!isPdf && !file.type.startsWith("image/")) throw new Error("Upload a photo or PDF of the Aadhaar card.");
  const body: Blob = isPdf ? file : await resizeImage(file, 1800, 0.88);
  const path = `${companyId}/${workerId}/aadhaar/${Date.now()}.${isPdf ? "pdf" : "jpg"}`;
  const up = await supabase.storage.from(BUCKET).upload(path, body, { contentType: isPdf ? "application/pdf" : "image/jpeg" });
  if (up.error) throw up.error;
  const { error } = await supabase
    .from("worker_documents")
    .insert({ company_id: companyId, worker_id: workerId, storage_path: path, file_name: file.name });
  if (error) throw error;
}
