import { getStore } from "@netlify/blobs";

const STORE = "fronttune-jobs";
const UPSTREAM =
  "https://omegatech-api.dixonomega.tech/api/ai/sonu-pro";

export default async (request) => {
  let input;

  try {
    input = await request.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const jobId = String(input.jobId || "").trim();

  if (!jobId) {
    return new Response("Missing job ID", { status: 400 });
  }

  const store = getStore(STORE);

  try {
    await store.setJSON(jobId, {
      status: "generating",
      createdAt: Date.now()
    });

    const q = new URLSearchParams();

    q.set("action", "generate");
    q.set("prompt", String(input.prompt || ""));

    const fields = [
      "lyrics",
      "title",
      "modelId",
      "isInstrumental",
      "musicStyle",
      "musicStyleCode",
      "genderType",
      "sessionId"
    ];

    for (const key of fields) {
      const value = input[key];

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {
        q.set(key, String(value));
      }
    }

    const upstream = await fetch(`${UPSTREAM}?${q.toString()}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        "user-agent": "FrontTune-AI-Music/2.0"
      }
    });

    const text = await upstream.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      await store.setJSON(jobId, {
        status: "failed",
        createdAt: Date.now(),
        message:
          `Music provider returned non-JSON (HTTP ${upstream.status}).`
      });

      return new Response("Provider returned invalid JSON", {
        status: 502
      });
    }

    if (!upstream.ok || data?.success === false) {
      await store.setJSON(jobId, {
        status: "failed",
        createdAt: Date.now(),
        message:
          data?.message ||
          data?.error ||
          `Provider error HTTP ${upstream.status}.`,
        providerStatus: upstream.status
      });

      return new Response("Generation failed", {
        status: 502
      });
    }

    const tracks =
      data?.data?.tracks ||
      data?.tracks ||
      [];

    if (!Array.isArray(tracks) || tracks.length === 0) {
      await store.setJSON(jobId, {
        status: "failed",
        createdAt: Date.now(),
        message: "Provider returned no tracks."
      });

      return new Response("No tracks returned", {
        status: 502
      });
    }

    await store.setJSON(jobId, {
      status: "complete",
      createdAt: Date.now(),
      result: data
    });

    return new Response("OK", { status: 200 });

  } catch (error) {
    await store.setJSON(jobId, {
      status: "failed",
      createdAt: Date.now(),
      message: error?.message || "Generation failed."
    });

    return new Response("Generation failed", {
      status: 500
    });
  }
};

export const config = {
  path: "/api/generate-background",
  background: true
};
