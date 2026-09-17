import { getStore } from "@netlify/blobs";

const STORE_NAME = "fronttune-jobs";

const OMEGATECH_URL =
  "https://omegatech-api.dixonomega.tech/api/ai/sonu-pro";

export default async function handler(request) {

  let job;

  try {
    job = await request.json();
  } catch {
    return;
  }

  const jobId =
    String(job.jobId || "").trim();

  if (!jobId) {
    return;
  }

  const store =
    getStore(STORE_NAME);

  /*
   * Tell the status endpoint that generation
   * has actually started.
   */

  await store.setJSON(jobId, {
    status: "generating",
    createdAt:
      Date.now()
  });

  try {

    const params =
      new URLSearchParams();

    params.set(
      "action",
      "generate"
    );

    params.set(
      "prompt",
      String(job.prompt || "")
    );

    if (job.lyrics) {
      params.set(
        "lyrics",
        String(job.lyrics)
      );
    }

    if (job.title) {
      params.set(
        "title",
        String(job.title)
      );
    }

    params.set(
      "modelId",
      String(
        job.modelId || 6
      )
    );

    params.set(
      "isInstrumental",
      String(
        Boolean(job.isInstrumental)
      )
    );

    if (job.musicStyle) {
      params.set(
        "musicStyle",
        String(job.musicStyle)
      );
    }

    if (job.musicStyleCode) {
      params.set(
        "musicStyleCode",
        String(job.musicStyleCode)
      );
    }

    params.set(
      "genderType",
      String(
        job.genderType ?? 0
      )
    );

    if (job.sessionId) {
      params.set(
        "sessionId",
        String(job.sessionId)
      );
    }

    const response =
      await fetch(
        `${OMEGATECH_URL}?${params.toString()}`,
        {
          method: "GET",

          headers: {
            "Accept":
              "application/json",

            "User-Agent":
              "FrontTune/2.0"
          }
        }
      );

    const raw =
      await response.text();

    let data;

    try {

      data =
        JSON.parse(raw);

    } catch {

      await store.setJSON(jobId, {
        status: "failed",

        createdAt:
          Date.now(),

        message:
          `OmegaTech returned invalid JSON (HTTP ${response.status}).`
      });

      return;
    }

    if (
      !response.ok ||
      data?.success === false
    ) {

      await store.setJSON(jobId, {
        status: "failed",

        createdAt:
          Date.now(),

        message:
          data?.message ||
          data?.error ||
          `OmegaTech returned HTTP ${response.status}.`,

        providerResponse:
          data
      });

      return;
    }

    const tracks =
      data?.data?.tracks ||
      data?.tracks ||
      [];

    if (
      !Array.isArray(tracks) ||
      tracks.length === 0
    ) {

      await store.setJSON(jobId, {
        status: "failed",

        createdAt:
          Date.now(),

        message:
          "OmegaTech completed but returned no music tracks.",

        providerResponse:
          data
      });

      return;
    }

    /*
     * SUCCESS
     */

    await store.setJSON(jobId, {

      status: "complete",

      createdAt:
        Date.now(),

      completedAt:
        Date.now(),

      result:
        data

    });

  } catch (error) {

    await store.setJSON(jobId, {

      status: "failed",

      createdAt:
        Date.now(),

      message:
        error?.message ||
        "Music generation failed."
    });
  }
}

/*
 * No custom path here.
 *
 * The -background filename itself tells
 * Netlify this is a Background Function.
 *
 * Netlify's official documentation confirms
 * that the -background convention is supported.
 */
