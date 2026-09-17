const $ = id => document.getElementById(id);

const API = {
  generate: "/api/generate",
  job: "/api/job",
  health: "/api/health",
  models: "/api/models"
};

let currentTracks = [];

function escapeHTML(v) {
  return String(v ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[c]));
}

function setError(message) {
  const e = $("errorBox");
  e.textContent = message;
  e.classList.remove("hidden");
}

function clearError() {
  $("errorBox").classList.add("hidden");
  $("errorBox").textContent = "";
}

async function readJSON(response) {
  const raw = await response.text();

  if (!raw.trim()) {
    throw new Error(`Empty server response (HTTP ${response.status}).`);
  }

  try {
    return JSON.parse(raw);
  } catch {
    const contentType =
      response.headers.get("content-type") || "";

    if (
      raw.trim().startsWith("<") ||
      /text\/html/i.test(contentType)
    ) {
      throw new Error(
        `The server returned an HTML page instead of JSON (HTTP ${response.status}).`
      );
    }

    throw new Error(
      `The server returned invalid JSON (HTTP ${response.status}).`
    );
  }
}

async function checkHealth() {
  const badge = $("apiBadge");

  try {
    const r = await fetch(API.health, {
      cache: "no-store"
    });

    const d = await readJSON(r);

    if (!r.ok || !d.ready) {
      throw new Error(
        d.message || "Health check failed"
      );
    }

    badge.className = "api-badge ready";
    badge.innerHTML =
      "<i></i><span>Studio ready</span>";

    $("footerStatus").textContent =
      "Secure server-side API connection";

  } catch {
    badge.className = "api-badge bad";
    badge.innerHTML =
      "<i></i><span>Studio offline</span>";

    $("footerStatus").textContent =
      "API connection needs attention";
  }
}

function updateCount() {
  $("promptCount").textContent =
    $("prompt").value.length;
}

$("prompt").addEventListener(
  "input",
  updateCount
);

document
  .querySelectorAll("[data-prompt]")
  .forEach(button => {

    button.onclick = () => {
      $("prompt").value =
        button.dataset.prompt;

      updateCount();
      clearError();
    };
  });

$("surpriseBtn").onclick = () => {

  const ideas = [
    "A futuristic trap song about becoming successful after everyone doubted me",
    "A smooth Afrobeat love song with a warm summer feeling and a massive chorus",
    "An emotional piano ballad about leaving home and missing the people I love",
    "A high-energy drill anthem about confidence, focus and making it out"
  ];

  $("prompt").value =
    ideas[Math.floor(Math.random() * ideas.length)];

  $("title").value = "";

  updateCount();
  clearError();
};

$("newBtn").onclick = () => {

  $("prompt").value = "";
  $("title").value = "";
  $("style").value = "";
  $("lyrics").value = "";

  $("instrumental").checked = false;

  $("model").value = "6";
  $("voice").value = "0";

  currentTracks = [];

  $("tracks").innerHTML = "";

  $("trackCount").textContent =
    "0 tracks";

  $("outputTitle").textContent =
    "Ready when you are";

  $("empty").classList.remove("hidden");

  clearError();
  updateCount();

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
};

$("clearRecent").onclick = () => {
  localStorage.removeItem(
    "fronttune_recent_v1"
  );

  renderRecent();
};


/* =========================================
   START MUSIC GENERATION
========================================= */

async function generate() {

  clearError();

  const prompt =
    $("prompt").value.trim();

  if (!prompt) {

    setError(
      "Write a song idea first."
    );

    $("prompt").focus();

    return;
  }

  const btn =
    $("generateBtn");

  btn.disabled = true;

  btn.innerHTML =
    "<span>Starting…</span><strong>◌</strong>";

  $("empty").classList.add(
    "hidden"
  );

  $("tracks").innerHTML = "";

  $("loading").classList.remove(
    "hidden"
  );

  $("outputTitle").textContent =
    "Starting your music…";

  $("trackCount").textContent =
    "Queued";

  const body = {
    prompt,

    lyrics:
      $("lyrics").value.trim(),

    title:
      $("title").value.trim(),

    modelId:
      Number($("model").value),

    isInstrumental:
      $("instrumental").checked,

    musicStyle:
      $("style").value.trim(),

    genderType:
      Number($("voice").value)
  };

  try {

    /*
     * STEP 1
     * Ask Netlify to create a background job.
     */

    const startResponse =
      await fetch(API.generate, {

        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          "Accept":
            "application/json"
        },

        body:
          JSON.stringify(body)
      });

    const startData =
      await readJSON(
        startResponse
      );

    if (
      !startResponse.ok ||
      !startData.success
    ) {

      throw new Error(
        startData.message ||
        startData.error ||
        `Could not start generation (HTTP ${startResponse.status}).`
      );
    }

    const jobId =
      startData.jobId;

    if (!jobId) {

      throw new Error(
        "The server did not return a generation job ID."
      );
    }

    /*
     * STEP 2
     * Wait for the background function.
     */

    btn.innerHTML =
      "<span>Generating…</span><strong>◌</strong>";

    const startedAt =
      Date.now();

    const MAX_WAIT =
      14 * 60 * 1000;

    while (
      Date.now() - startedAt <
      MAX_WAIT
    ) {

      await new Promise(
        resolve =>
          setTimeout(resolve, 3000)
      );

      const statusResponse =
        await fetch(
          `${API.job}?jobId=${encodeURIComponent(jobId)}`,
          {
            cache: "no-store",

            headers: {
              "Accept":
                "application/json"
            }
          }
        );

      const statusData =
        await readJSON(
          statusResponse
        );

      if (
        statusData.status ===
        "complete"
      ) {

        const result =
          statusData.data;

        const tracks =
          result?.data?.tracks ||
          result?.tracks ||
          [];

        if (
          !Array.isArray(tracks) ||
          tracks.length === 0
        ) {

          throw new Error(
            "Music generation finished, but no tracks were returned."
          );
        }

        renderTracks(tracks);

        saveRecent(tracks);

        return;
      }

      if (
        statusData.status ===
        "failed"
      ) {

        throw new Error(
          statusData.message ||
          "Music generation failed."
        );
      }

      if (
        statusData.status ===
        "generating"
      ) {

        $("outputTitle").textContent =
          "Creating your music…";

        $("trackCount").textContent =
          "Generating";

      } else {

        $("outputTitle").textContent =
          "Preparing your music…";

        $("trackCount").textContent =
          "Queued";
      }
    }

    throw new Error(
      "Music generation took too long. Please try again."
    );

  } catch (error) {

    $("loading").classList.add(
      "hidden"
    );

    $("empty").classList.remove(
      "hidden"
    );

    $("outputTitle").textContent =
      "Generation failed";

    $("trackCount").textContent =
      "0 tracks";

    setError(
      error.message ||
      "Something went wrong."
    );

  } finally {

    btn.disabled = false;

    btn.innerHTML =
      "<span>Generate music</span><strong>↗</strong>";
  }
}


/* =========================================
   DISPLAY GENERATED TRACKS
========================================= */

function renderTracks(tracks) {

  currentTracks = tracks;

  $("loading").classList.add(
    "hidden"
  );

  $("empty").classList.add(
    "hidden"
  );

  $("trackCount").textContent =
    `${tracks.length} track${tracks.length === 1 ? "" : "s"}`;

  $("outputTitle").textContent =
    tracks[0]?.title ||
    "Your generated song";

  $("tracks").innerHTML =
    tracks.map((track, index) => {

      const audio =
        track.musicFile ||
        track.audioUrl ||
        track.audio ||
        track.url ||
        "";

      const cover =
        track.coverImage ||
        track.cover ||
        "";

      return `
        <article class="track">

          <div class="track-main">

            ${
              cover
                ? `
                  <img
                    class="cover"
                    src="${escapeHTML(cover)}"
                    alt="Generated cover"
                  >
                `
                : `
                  <div class="cover"></div>
                `
            }

            <div class="track-info">

              <div class="track-title">
                ${escapeHTML(
                  track.title ||
                  `Track ${index + 1}`
                )}
              </div>

              <div class="track-meta">
                Track ${escapeHTML(
                  track.id ??
                  index + 1
                )}
                ·
                ${
                  audio
                    ? "Audio ready"
                    : "Audio URL missing"
                }
              </div>

            </div>

          </div>

          ${
            audio
              ? `
                <audio
                  controls
                  preload="metadata"
                  src="${escapeHTML(audio)}"
                ></audio>

                <div class="track-actions">

                  <a
                    href="${escapeHTML(audio)}"
                    target="_blank"
                    rel="noopener"
                  >
                    Open audio
                  </a>

                  <button
                    data-copy="${escapeHTML(audio)}"
                  >
                    Copy audio link
                  </button>

                </div>
              `
              : `
                <div class="error-box">
                  The API did not return a playable audio URL for this track.
                </div>
              `
          }

          ${
            track.lyrics
              ? `
                <details class="lyrics-box">

                  <summary>
                    View lyrics
                  </summary>

                  <pre>${escapeHTML(
                    track.lyrics
                  )}</pre>

                </details>
              `
              : ""
          }

        </article>
      `;

    }).join("");

  document
    .querySelectorAll("[data-copy]")
    .forEach(button => {

      button.onclick =
        async () => {

          try {

            await navigator
              .clipboard
              .writeText(
                button.dataset.copy
              );

            button.textContent =
              "Copied!";

          } catch {

            button.textContent =
              "Copy failed";
          }

          setTimeout(() => {

            button.textContent =
              "Copy audio link";

          }, 1200);
        };
    });
}


/* =========================================
   RECENT SONGS
========================================= */

function saveRecent(tracks) {

  let recent = [];

  try {

    recent =
      JSON.parse(
        localStorage.getItem(
          "fronttune_recent_v1"
        ) || "[]"
      );

  } catch {
    recent = [];
  }

  for (
    const track of tracks.slice(0, 4)
  ) {

    recent.unshift({

      title:
        track.title ||
        "Untitled",

      cover:
        track.coverImage ||
        "",

      audio:
        track.musicFile ||
        "",

      lyrics:
        track.lyrics ||
        "",

      id:
        track.id ||
        ""
    });
  }

  const unique = [];
  const seen = new Set();

  for (
    const item of recent
  ) {

    const key =
      item.id ||
      item.audio;

    if (
      !key ||
      seen.has(key)
    ) {
      continue;
    }

    seen.add(key);
    unique.push(item);
  }

  localStorage.setItem(
    "fronttune_recent_v1",
    JSON.stringify(
      unique.slice(0, 8)
    )
  );

  renderRecent();
}

function renderRecent() {

  let items = [];

  try {

    items =
      JSON.parse(
        localStorage.getItem(
          "fronttune_recent_v1"
        ) || "[]"
      );

  } catch {
    items = [];
  }

  const box =
    $("recent");

  if (!items.length) {

    box.innerHTML =
      '<div class="recent-empty">Nothing saved yet. Your generated tracks will appear here.</div>';

    return;
  }

  box.innerHTML =
    items.map(item => `

      <div class="recent-card">

        ${
          item.cover
            ? `
              <img
                src="${escapeHTML(item.cover)}"
                alt=""
              >
            `
            : `
              <div
                style="aspect-ratio:1;background:#15151d"
              ></div>
            `
        }

        <div>

          <strong>
            ${escapeHTML(
              item.title
            )}
          </strong>

          <small>
            ${
              item.audio
                ? "Audio ready"
                : "No audio URL"
            }
          </small>

        </div>

      </div>

    `).join("");
}


/* =========================================
   BUTTONS
========================================= */

$("generateBtn").onclick =
  generate;

$("prompt").addEventListener(
  "keydown",
  event => {

    if (
      (event.ctrlKey ||
        event.metaKey) &&
      event.key === "Enter"
    ) {

      generate();
    }
  }
);


/* =========================================
   START FRONT TUNE
========================================= */

updateCount();
renderRecent();
checkHealth();
