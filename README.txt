FRONTTUNE — PRODUCTION NETLIFY BUILD
====================================

This project intentionally keeps:
  site/                  = public website
  netlify/functions/     = server-side API functions

The browser calls:
  /api/health
  /api/models
  /api/generate

The server-side generate function calls the OmegaTech endpoint.

DEPLOY
------
Deploy the PROJECT ROOT (the folder containing netlify.toml), not only the site folder.

If using Netlify Drop, stay logged into the correct Netlify team/site and upload the project folder/output as supported by Netlify. For the most reliable continuous deployment, connect this project to a Git repository.

After deployment:
1. Open /api/health on your site.
2. It should return JSON with "ready": true.
3. Open the homepage.
4. The top-right badge should say "Studio ready".
5. Generate a song.

IMPORTANT
---------
The OmegaTech endpoint and its availability are external to FrontTune. FrontTune cannot make an unavailable upstream provider generate audio. The UI and server proxy return explicit provider errors instead of showing misleading JSON/HTML errors.

No API key is hard-coded into the frontend.
