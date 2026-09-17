import { getStore } from "@netlify/blobs";

const STORE_NAME = "fronttune-jobs";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

export default async function handler(request) {

  if (request.method !== "POST") {
    return json({
      success: false,
      message: "POST method required."
    }, 405);
  }

  let input;

  try {
    input = await request.json();
  } catch {
    return json({
      success: false,
      message: "Invalid JSON request."
    }, 400);
  }

  const prompt = String(input.prompt || "").trim();

  if (!prompt) {
    return json({
      success: false,
      message: "Please enter a song prompt."
    }, 400);
  }

  const jobId = crypto.randomUUID();

  const store = getStore(STORE_NAME);

  await store.setJSON(jobId, {
    status: "queued",
    createdAt: Date.now()
  });

  const job = {
    jobId,

    prompt,

    lyrics: String(
      input.lyrics || ""
    ),

    title: String(
      input.title || ""
    ),

    modelId: Number(
      input.modelId || 6
    ),

    isInstrumental:
      Boolean(input.isInstrumental),

    musicStyle: String(
      input.musicStyle || ""
    ),

    musicStyleCode: String(
      input.musicStyleCode || ""
    ),

    genderType: Number(
      input.genderType || 0
    ),

    sessionId:
      input.sessionId || ""
  };

  /*
   * IMPORTANT:
   *
   * generate-background.mjs is intentionally
   * called through Netlify's default function URL.
   *
   * Because the filename ends in -background,
   * Netlify treats it as a Background Function.
   */

  const workerURL = new URL(
    "/.netlify/functions/generate-background",
    request.url
  );

  try {

    const workerResponse =
      await fetch(workerURL, {
        method: "POST",

        headers: {
          "content-type":
            "application/json",

          "x-fronttune-worker":
            "true"
        },

        body: JSON.stringify(job)
      });

    /*
     * A correctly invoked Netlify Background
     * Function immediately returns HTTP 202.
     */

    if (
      workerResponse.status !== 202
    ) {

      const workerText =
        await workerResponse.text();

      await store.setJSON(jobId, {
        status: "failed",
        createdAt: Date.now(),
        message:
          `Background worker returned HTTP ${workerResponse.status}.`,
        detail:
          workerText.slice(0, 500)
      });

      return json({
        success: false,
        message:
          "Could not start the music generation worker.",
        detail:
          `Worker HTTP ${workerResponse.status}`
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
      message:
        error?.message ||
        "Background worker could not be started."
    });

    return json({
      success: false,
      message:
        "Could not start the music generation worker.",
      detail:
        error?.message ||
        "Unknown worker error."
    }, 502);
  }
}

export const config = {
  path: "/api/generate"
};
