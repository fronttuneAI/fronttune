const $=id=>document.getElementById(id);
const API={generate:"/api/generate",health:"/api/health",models:"/api/models"};
let currentTracks=[];

function escapeHTML(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function setError(message){const e=$("errorBox");e.textContent=message;e.classList.remove("hidden")}
function clearError(){$("errorBox").classList.add("hidden");$("errorBox").textContent=""}

async function readJSON(response){
  const raw=await response.text();
  if(!raw.trim()) throw new Error(`Empty server response (HTTP ${response.status}).`);
  try{return JSON.parse(raw)}
  catch{
    const isHTML=raw.trim().startsWith("<")||/text\/html/i.test(response.headers.get("content-type")||"");
    throw new Error(isHTML
      ? `The server returned an HTML page instead of JSON (HTTP ${response.status}).\n\nThis usually means the FrontTune Netlify Function was not deployed.`
      : `The server returned invalid JSON (HTTP ${response.status}).\n\n${raw.slice(0,300)}`);
  }
}

async function checkHealth(){
  const badge=$("apiBadge");
  try{
    const r=await fetch(API.health,{cache:"no-store"});
    const d=await readJSON(r);
    if(!r.ok||!d.ready) throw new Error(d.message||"Health check failed");
    badge.className="api-badge ready";badge.innerHTML="<i></i><span>Studio ready</span>";
    $("footerStatus").textContent="Secure server-side API connection";
  }catch(e){
    badge.className="api-badge bad";badge.innerHTML="<i></i><span>Studio offline</span>";
    $("footerStatus").textContent="API connection needs attention";
  }
}

function updateCount(){
  $("promptCount").textContent=$("prompt").value.length;
}
$("prompt").addEventListener("input",updateCount);

document.querySelectorAll("[data-prompt]").forEach(b=>b.onclick=()=>{
  $("prompt").value=b.dataset.prompt;updateCount();clearError();
});

$("surpriseBtn").onclick=()=>{
  const ideas=[
    "A futuristic trap song about becoming successful after everyone doubted me",
    "A smooth Afrobeat love song with a warm summer feeling and a massive chorus",
    "An emotional piano ballad about leaving home and missing the people I love",
    "A high-energy drill anthem about confidence, focus and making it out"
  ];
  $("prompt").value=ideas[Math.floor(Math.random()*ideas.length)];
  $("title").value="";updateCount();clearError();
};

$("newBtn").onclick=()=>{
  $("prompt").value="";$("title").value="";$("style").value="";$("lyrics").value="";
  $("instrumental").checked=false;$("model").value="6";$("voice").value="0";
  currentTracks=[];$("tracks").innerHTML="";$("trackCount").textContent="0 tracks";
  $("outputTitle").textContent="Ready when you are";$("empty").classList.remove("hidden");
  clearError();updateCount();window.scrollTo({top:0,behavior:"smooth"});
};

$("clearRecent").onclick=()=>{localStorage.removeItem("fronttune_recent_v1");renderRecent()};

async function generate(){
  clearError();
  const prompt=$("prompt").value.trim();
  if(!prompt){setError("Write a song idea first.");$("prompt").focus();return}

  const btn=$("generateBtn");btn.disabled=true;btn.innerHTML="<span>Generating…</span><strong>◌</strong>";
  $("empty").classList.add("hidden");$("tracks").innerHTML="";$("loading").classList.remove("hidden");
  $("outputTitle").textContent="Creating your music…";$("trackCount").textContent="Working";

  const body={
    prompt,
    lyrics:$("lyrics").value.trim(),
    title:$("title").value.trim(),
    modelId:Number($("model").value),
    isInstrumental:$("instrumental").checked,
    musicStyle:$("style").value.trim(),
    genderType:Number($("voice").value)
  };

  try{
    const r=await fetch(API.generate,{method:"POST",headers:{"Content-Type":"application/json","Accept":"application/json"},body:JSON.stringify(body)});
    const data=await readJSON(r);
    if(!r.ok||data.success===false) throw new Error(data.message||data.error||`Generation failed (HTTP ${r.status}).`);
    const tracks=data?.data?.tracks||data?.tracks||[];
    if(!Array.isArray(tracks)||!tracks.length) throw new Error("The music service responded successfully but returned no tracks.");
    renderTracks(tracks);
    saveRecent(tracks);
  }catch(e){
    $("loading").classList.add("hidden");$("empty").classList.remove("hidden");
    $("outputTitle").textContent="Generation failed";$("trackCount").textContent="0 tracks";
    setError(e.message||"Something went wrong.");
  }finally{
    btn.disabled=false;btn.innerHTML="<span>Generate music</span><strong>↗</strong>";
  }
}

function renderTracks(tracks){
  currentTracks=tracks;$("loading").classList.add("hidden");$("empty").classList.add("hidden");
  $("trackCount").textContent=`${tracks.length} track${tracks.length===1?"":"s"}`;
  $("outputTitle").textContent=tracks[0]?.title||"Your generated song";

  $("tracks").innerHTML=tracks.map((t,i)=>{
    const audio=t.musicFile||t.audioUrl||t.audio||t.url||"";
    const cover=t.coverImage||t.cover||"";
    return `<article class="track">
      <div class="track-main">
        ${cover?`<img class="cover" src="${escapeHTML(cover)}" alt="Generated cover">`:`<div class="cover"></div>`}
        <div class="track-info"><div class="track-title">${escapeHTML(t.title||`Track ${i+1}`)}</div>
        <div class="track-meta">Track ${escapeHTML(t.id??i+1)} · ${audio?"Audio ready":"Audio URL missing"}</div></div>
      </div>
      ${audio?`<audio controls preload="metadata" src="${escapeHTML(audio)}"></audio>
      <div class="track-actions"><a href="${escapeHTML(audio)}" target="_blank" rel="noopener">Open audio</a>
      <button data-copy="${escapeHTML(audio)}">Copy audio link</button></div>`:"<div class=\"error-box\">The API did not return a playable audio URL for this track.</div>"}
      ${t.lyrics?`<details class="lyrics-box"><summary>View lyrics</summary><pre>${escapeHTML(t.lyrics)}</pre></details>`:""}
    </article>`;
  }).join("");

  document.querySelectorAll("[data-copy]").forEach(b=>b.onclick=async()=>{
    try{await navigator.clipboard.writeText(b.dataset.copy);b.textContent="Copied!"}
    catch{b.textContent="Copy failed"}
    setTimeout(()=>b.textContent="Copy audio link",1200);
  });
}

function saveRecent(tracks){
  let recent=[];try{recent=JSON.parse(localStorage.getItem("fronttune_recent_v1")||"[]")}catch{}
  for(const t of tracks.slice(0,4)){
    recent.unshift({title:t.title||"Untitled",cover:t.coverImage||"",audio:t.musicFile||"",lyrics:t.lyrics||"",id:t.id||""});
  }
  const unique=[];const seen=new Set();
  for(const x of recent){const key=x.id||x.audio;if(!key||seen.has(key))continue;seen.add(key);unique.push(x)}
  localStorage.setItem("fronttune_recent_v1",JSON.stringify(unique.slice(0,8)));renderRecent();
}

function renderRecent(){
  let items=[];try{items=JSON.parse(localStorage.getItem("fronttune_recent_v1")||"[]")}catch{}
  const box=$("recent");
  if(!items.length){box.innerHTML='<div class="recent-empty">Nothing saved yet. Your generated tracks will appear here.</div>';return}
  box.innerHTML=items.map(x=>`<div class="recent-card">${x.cover?`<img src="${escapeHTML(x.cover)}" alt="">`:"<div style='aspect-ratio:1;background:#15151d'></div>"}<div><strong>${escapeHTML(x.title)}</strong><small>${x.audio?"Audio ready":"No audio URL"}</small></div></div>`).join("");
}

$("generateBtn").onclick=generate;
$("prompt").addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key==="Enter")generate()});
updateCount();renderRecent();checkHealth();