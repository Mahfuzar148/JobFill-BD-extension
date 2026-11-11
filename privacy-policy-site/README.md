# JobFill BD — Public Privacy Policy Website (`MR Software Studio`)

Standalone static Privacy Policy website for **JobFill BD (v2.0.0)** by **MR Software Studio**, prepared for hosting via **GitHub Pages** for both **Microsoft Edge Add-ons Store** and **Google Chrome Web Store** compliance.

- **Repository:** `https://github.com/Mahfuzar148/jobfill-bd-privacy`
- **Git Remote:** `https://github.com/Mahfuzar148/jobfill-bd-privacy.git`
- **Branch / Folder:** `main` -> `/ (root)` (`index.html`)
- **Publisher:** MR Software Studio
- **Contact:** [mahfuzar148@gmail.com](mailto:mahfuzar148@gmail.com)
- **Live GitHub Pages URL:** `https://mahfuzar148.github.io/jobfill-bd-privacy/`

> **Release Comparison Disclosure Scope:** Clearly distinguishes the **Microsoft Edge Store `v2.0.0` release** (`__JOBFILL_CLOUD_SYNC_DISABLED__=true` — Local-Only vault storage, Cloud Sync disabled & unreachable) from the **Google Chrome release** (`cloudSyncEnabled: false` by default, supporting optional user-configured Supabase Cloud Sync with client-side AES-256-GCM encryption for `profiles_bundle` & `activity_bundle`, non-E2EE Supabase Auth credentials/metadata, and strictly local document/photo/signature storage in `v2.0.0`), alongside read-only public job circular `GET` requests (`credentials: 'omit'`, zero PII).

## Contents

- `index.html` — Responsive, accessible single-file HTML5 Privacy Policy with inline CSS only (no tracking scripts, no external JS, no remote fonts, no cookies, and no forms).
- `README.md` — Repository documentation and GitHub Pages publishing guide.

---

## Preview Locally

Open `index.html` directly in Microsoft Edge or Chrome, or run a local static server:

```bash
cd privacy-policy-site
python -m http.server 8080
```

Then inspect `http://localhost:8080/` on desktop (`1280x800`) and mobile (`375x812`).

---

## Publish to GitHub Pages (`Mahfuzar148/jobfill-bd-privacy`)

### Step 1: Upload / Push Only `privacy-policy-site/` Contents to `main`

Upload `index.html` (and optionally update `README.md`) to the root of the `main` branch at `https://github.com/Mahfuzar148/jobfill-bd-privacy`, preserving any unrelated repository files (`git push` or **Add file -> Upload files** in GitHub Web UI):

```bash
# Example using a clean clone of your repository
git clone https://github.com/Mahfuzar148/jobfill-bd-privacy.git
cd jobfill-bd-privacy
# Copy privacy-policy-site/index.html and privacy-policy-site/README.md here
git add index.html README.md
git commit -m "Add JobFill BD Privacy Policy website"
git push origin main
```

Confirm in the repository root on `main` that `index.html` sits directly at the top level.

### Step 2: Enable GitHub Pages

1. Open `https://github.com/Mahfuzar148/jobfill-bd-privacy`.
2. Go to **Settings** &rarr; **Pages**.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch**.
4. Select branch **`main`** and folder **`/ (root)`**.
5. Click **Save**.
6. Wait 1–3 minutes for GitHub Pages deployment to complete.

### Step 3: Verify Live Public Access Before Edge Store Submission

Once GitHub Pages reports the deployment is active, verify that `https://mahfuzar148.github.io/jobfill-bd-privacy/` loads with **HTTP 200 OK** in an InPrivate / Incognito browser window without signing in, and paste that verified HTTPS URL into Microsoft Partner Center.
