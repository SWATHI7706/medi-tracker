# Deploying Medi-Tracker to Google Cloud Run

This project is configured as a **unified, multi-stage production container**. It packages both the React Vite frontend and the FastAPI backend into a single service on Google Cloud Run.

### Advantages:
- **Zero CORS issues**: Frontend and API share the exact same domain.
- **Cost Effective**: Easily stays within Google Cloud Run's perpetual **Free Tier** (2 million requests/month free).
- **Single URL**: One clean URL (e.g. `https://medi-tracker-xxx.a.run.app`) for your full application.

---

## 1. Prerequisites

1. **Google Cloud Account**: [console.cloud.google.com](https://console.cloud.google.com)
2. **MongoDB Database**: A free MongoDB Atlas cluster ([mongodb.com/atlas](https://www.mongodb.com/atlas)).
   - Whitelist `0.0.0.0/0` in MongoDB Atlas Network Access (required for serverless Cloud Run IPs).
   - Copy your connection string: `mongodb+srv://<username>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority`
3. **JWT Secret**: Any secure string (e.g., generate with `openssl rand -hex 32`).

---

## 2. Recommended Deployment Methods

### Method A: Cloud Console & GitHub (Zero Local Setup)
*Best if you don't have the Google Cloud CLI or Docker installed on your local PC.*

1. Push this project to a **GitHub repository**.
2. Open the [Google Cloud Run Console](https://console.cloud.google.com/run).
3. Click **"Deploy container"** -> **"Service"**.
4. Choose **"Continuously deploy from a repository"** and click **Set up with Cloud Build**.
5. Select your GitHub repository and branch `main`.
6. Under Build Configuration, select **Dockerfile** (path: `/Dockerfile`).
7. In the Service settings:
   - **Service name**: `medi-tracker`
   - **Region**: Choose a region close to you (e.g. `us-central1` or `asia-south1`)
   - **Authentication**: Select **"Allow unauthenticated invocations"** (so patients and users can access your web app).
8. Under **Container, Volumes, Networking, Security**:
   - Add Environment Variables:
     - `MONGO_URL` = your MongoDB Atlas connection string
     - `JWT_SECRET` = your secure JWT secret key
   - Default Port: `8080` (already pre-configured in the Dockerfile)
   - Memory: `512 MiB` (or `1 GiB`)
9. Click **Create**. Google Cloud Build will automatically build the container and deploy it to a live HTTPS URL!

---

### Method B: Google Cloud Shell (Fastest CLI Deploy via Browser)
*No local downloads required! Google Cloud Shell includes `gcloud`, `docker`, and `git` for free.*

1. In the [Google Cloud Console](https://console.cloud.google.com/), click the **Activate Cloud Shell** icon `>_` in the top right.
2. Clone your repository into Cloud Shell:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd Medi-tracker
   ```
3. Deploy directly using the Cloud Run source build command:
   ```bash
   gcloud run deploy medi-tracker \
     --source . \
     --region us-central1 \
     --allow-unauthenticated \
     --set-env-vars MONGO_URL="mongodb+srv://<user>:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority",JWT_SECRET="your-secure-secret-key"
   ```
4. Once completed, Google Cloud Run will output your live URL:
   ```
   Service [medi-tracker] revision [medi-tracker-00001-abc] has been deployed and is serving 100 percent of traffic.
   Service URL: https://medi-tracker-xxxxxx.a.run.app
   ```

---

### Method C: Local `gcloud` CLI (Windows)

If you prefer deploying from your local terminal:
1. Download and install the [Google Cloud SDK for Windows](https://cloud.google.com/sdk/docs/install#windows).
2. Open PowerShell and authenticate:
   ```powershell
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```
3. Deploy directly from the `Medi-tracker` folder:
   ```powershell
   gcloud run deploy medi-tracker --source . --region us-central1 --allow-unauthenticated
   ```

---

## 3. Verifying Your Deployment

Once deployed, visit your Cloud Run URL:
- **Web Application**: `https://<your-service-url>/`
- **Health Check**: `https://<your-service-url>/health`
- **API Docs (Swagger)**: `https://<your-service-url>/docs`
