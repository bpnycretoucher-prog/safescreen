# SafeScreen 🎬

AI-powered content safety analysis for movies and TV shows.

## Deploy to Netlify

### 1. Push to GitHub
```bash
git init
git add .
git commit -m "Initial SafeScreen"
git remote add origin https://github.com/YOUR_USERNAME/safescreen.git
git push -u origin main
```

### 2. Connect to Netlify
1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Select your GitHub repo
3. Build settings are auto-detected from `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. Click **Deploy site**

### 3. Add your API key
1. In Netlify dashboard → **Site configuration** → **Environment variables**
2. Add: `ANTHROPIC_API_KEY` = your key from [console.anthropic.com](https://console.anthropic.com)
3. Trigger a redeploy

That's it — your site is live!

## Local Development
```bash
npm install
npm run dev
```

Note: For local dev you'll need the [Netlify CLI](https://docs.netlify.com/cli/get-started/):
```bash
npm install -g netlify-cli
netlify dev
```
This runs both the Vite dev server and the serverless functions locally.
