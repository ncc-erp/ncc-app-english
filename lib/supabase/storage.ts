const bucket = process.env.SUPABASE_STORAGE_BUCKET || "ielts-recordings";

function getConfig() {
  const baseUrl =
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!baseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase Storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { baseUrl: baseUrl.replace(/\/$/, ""), serviceRoleKey };
}

export async function uploadAudio(
  path: string,
  body: ArrayBuffer,
  contentType: string,
) {
  const { baseUrl, serviceRoleKey } = getConfig();
  const response = await fetch(
    `${baseUrl}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": contentType || "audio/webm",
        "x-upsert": "true",
      },
      body,
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase upload failed: ${await response.text()}`);
  }
}

export async function createSignedAudioUrl(path: string, expiresIn = 3600) {
  const { baseUrl, serviceRoleKey } = getConfig();
  const response = await fetch(
    `${baseUrl}/storage/v1/object/sign/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ expiresIn }),
    },
  );

  if (!response.ok) {
    throw new Error(`Supabase signed URL failed: ${await response.text()}`);
  }

  const data = (await response.json()) as {
    signedURL?: string;
    signedUrl?: string;
  };
  const signedPath = data.signedURL || data.signedUrl;
  if (!signedPath) throw new Error("Supabase did not return a signed URL.");

  return signedPath.startsWith("http")
    ? signedPath
    : `${baseUrl}/storage/v1${signedPath}`;
}
