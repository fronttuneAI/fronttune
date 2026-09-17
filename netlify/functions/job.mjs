import { getStore } from "@netlify/blobs";

const STORE = "fronttune-jobs";

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
  const url = new URL(request.url);
  const jobId = url.searchParams.get("jobId");

  if (!jobId) {
    return json({
      success: false,
      message: "Missing jobId."
    }, 400);
  }

  const job = await getStore(STORE).get(jobId, {
    type: "json",
    consistency: "strong"
  });

  if (!job) {
    return json({
      success: false,
      message: "Job not found."
    }, 404);
  }

  if (job.status === "complete") {
    return json({
      success: true,
      status: "complete",
      data: job.result
    });
  }

  if (job.status === "failed") {
    return json({
      success: false,
      status: "failed",
      message: job.message || "Generation failed."
    }, 502);
  }

  return json({
    success: true,
    status: job.status || "generating"
  });
};

export const config = {
  path: "/api/job"
};
