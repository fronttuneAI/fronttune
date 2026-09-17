const UPSTREAM="https://omegatech-api.dixonomega.tech/api/ai/sonu-pro";

function json(body,status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers:{
      "content-type":"application/json; charset=utf-8",
      "cache-control":"no-store",
      "access-control-allow-origin":"*"
    }
  });
}

export default async (request) => {
  if(request.method==="OPTIONS"){
    return new Response(null,{status:204,headers:{
      "access-control-allow-origin":"*",
      "access-control-allow-methods":"POST,OPTIONS",
      "access-control-allow-headers":"content-type"
    }});
  }
  if(request.method!=="POST") return json({success:false,message:"Method not allowed"},405);

  let input;
  try { input=await request.json(); }
  catch { return json({success:false,message:"Invalid JSON request body."},400); }

  const prompt=String(input.prompt??"").trim();
  if(!prompt) return json({success:false,message:"Prompt is required."},400);

  const q=new URLSearchParams();
  q.set("action","generate");
  q.set("prompt",prompt);

  const allowed=[
    "lyrics","title","modelId","isInstrumental",
    "musicStyle","musicStyleCode","genderType","sessionId"
  ];
  for(const key of allowed){
    const value=input[key];
    if(value!==undefined && value!==null && value!==""){
      q.set(key,String(value));
    }
  }

  try{
    const upstream=await fetch(`${UPSTREAM}?${q.toString()}`,{
      method:"GET",
      headers:{
        accept:"application/json",
        "user-agent":"FrontTune-AI-Music/1.0"
      }
    });

    const text=await upstream.text();
    let data;
    try{
      data=JSON.parse(text);
    }catch{
      return json({
        success:false,
        message:`Music provider returned non-JSON (HTTP ${upstream.status}).`,
        providerStatus:upstream.status
      },502);
    }

    return json(data,upstream.status);
  }catch(e){
    return json({
      success:false,
      message:"Could not reach the music provider.",
      detail:e?.message||"Unknown upstream error"
    },502);
  }
};

export const config={path:"/api/generate"};
