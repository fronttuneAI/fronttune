export default async () => {
  return new Response(JSON.stringify({
    success: true,
    ready: true,
    service: "FrontTune",
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {"content-type":"application/json","cache-control":"no-store"}
  });
};

export const config = { path: "/api/health" };
