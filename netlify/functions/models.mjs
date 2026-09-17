const UPSTREAM="https://omegatech-api.dixonomega.tech/api/ai/sonu-pro";

export default async () => {
  try {
    const r=await fetch(`${UPSTREAM}?action=models`,{
      headers:{accept:"application/json","user-agent":"FrontTune/1.0"}
    });
    const text=await r.text();
    let data;
    try { data=JSON.parse(text); }
    catch { data={success:false,message:`Upstream returned non-JSON (HTTP ${r.status})`}; }
    return new Response(JSON.stringify(data),{
      status:r.status,
      headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  } catch(e) {
    return new Response(JSON.stringify({success:false,message:e.message||"Upstream connection failed"}),{
      status:502,headers:{"content-type":"application/json","cache-control":"no-store"}
    });
  }
};
export const config={path:"/api/models"};
