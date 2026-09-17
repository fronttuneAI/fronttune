import { getStore } from "@netlify/blobs";

const STORE = "fronttune-jobs";
const UPSTREAM = "https://omegatech-api.dixonomega.tech/api/ai/sonu-pro";

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

export default async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type"
      }
    });
  }

  if (request.method !== "POST") {
    return json({ success: false, message: "Method not allowed." }, 405);
  }

  let input;

  try {
    input = await request.json();
  } catch {
    return json({ success: false, message: "Invalid JSON request." }, 400);
  }

  const prompt = String(input.prompt ?? "").trim();

  if (!prompt) {
    return json({ success: false, message: "Prompt is required." }, 400);
  }

  const jobId = crypto.randomUUID();
  const store = getStore(STORE);

  await store.setJSON(jobId, {
    status: "queued",
    createdAt: Date.now()
  });

  const backgroundUrl =
    new URL("/api/generate-background", request.url).toString();

  const payload = {
    jobId,
    prompt,
    lyrics: String(input.lyrics ?? ""),
    title: String(input.title ?? ""),
    modelId: Number(input.modelId ?? 6),
    isInstrumental: Boolean(input.isInstrumental),
    musicStyle: String(input.musicStyle ?? ""),
    musicStyleCode: String(input.musicStyleCode ?? ""),
    genderType: Number(input.genderType ?? 0),
    sessionId: input.sessionId || undefined
  };

  try {
    const response = await fetch(backgroundUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-fronttune-job": jobId
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok && response.status !== 202) {
      await store.setJSON(jobId, {
        status: "failed",
        createdAt: Date.now(),
        message: `Could not start generation worker (HTTP ${response.status}).`
      });

      return json({
        success: false,
        message: "Could not start the music generation worker."
      }, 502);
    }

    return json({
      success: true,
      status: "queued",
      jobId
    });

  } catch (error) {
    await store.setJSON(jobId, {
      status: "failed",
      createdAt: Date.now(),
      message: error?.message || "Could not start background generation."
    });

    return json({
      success: false,
      message: "Could not start music generation.",
      detail: error?.message || "Unknown error"
    }, 502);
  }
};

export const config = {
  path: "/api/generate"
};
