# Deploying KitchenOS on Render

## Short answer

**Do not upload a downloaded ZIP directly to Render.** Render web services deploy source from a connected GitHub, GitLab, or Bitbucket repository, a public Git repository URL, or a prebuilt Docker image. Export this project to a Git repository first, then connect that repository to a Render **Web Service**.

## Recommended Render configuration

| Render setting | Value |
|---|---|
| Service type | Web Service |
| Runtime | Node |
| Build command | `corepack enable && pnpm install --frozen-lockfile && pnpm run build` |
| Start command | `pnpm start` |
| Health check | `/` |
| Node version | 22 |
| Port | Let Render provide `PORT`; the app already reads it. |

Render provides an `onrender.com` address and handles inbound TLS. The application must bind to the `PORT` environment variable, which the existing server already does.

## Required external services and environment variables

This project is currently built on Manus-provided managed services. **A ZIP export is not self-contained for Render.** Before deploying externally, replace or configure the following dependencies:

| Capability | Current project dependency | Required Render action |
|---|---|---|
| Database | MySQL/TiDB through `DATABASE_URL` | Provide a compatible external MySQL or TiDB connection string. Render Postgres is not schema-compatible with the current Drizzle MySQL schema. |
| Session signing | `JWT_SECRET` | Set a unique, randomly generated secret of at least 32 characters in Render environment variables. |
| OAuth | Manus OAuth variables and callback flow | Configure an external OAuth provider and update the callback URLs. Do not copy Manus-managed OAuth secrets to Render. |
| AI ingredient parser | Manus Forge LLM proxy | Replace the server-side LLM integration with your own approved provider credentials and preserve structured-output validation and request throttling. |
| Recipe photos | Manus managed object storage | Replace the storage helper with an S3-compatible bucket and server-side credentials. Preserve image decode/re-encode, size limits, and tenant checks. |
| Local password test fallback | `ENABLE_LOCAL_AUTH` | Leave disabled in production unless explicitly needed; OAuth should remain the primary production login method. |

## Database migrations

Run every reviewed Drizzle migration against the external MySQL/TiDB database **before** sending production traffic. Do not rely on a free web-service filesystem for data: recipe photos require durable object storage, and operational data requires the external database.

## Safe deployment sequence

1. Export the project code to a private Git repository; never commit `.env` files, keys, or database URLs.
2. Provision a compatible MySQL/TiDB database and object-storage bucket.
3. Replace the Manus-specific OAuth, LLM, and storage integrations, then add their secrets in Render’s environment-variable UI.
4. Run migrations from a controlled environment and verify the health check.
5. Connect the Git repository in Render, use the build and start commands above, then test sign-in, tenant isolation, parser limits, photo upload, and logout on the Render URL.

## Important limitation

Until the Manus-specific OAuth, Forge LLM, and storage integrations are replaced, this project should continue to run on its managed hosting. Uploading the ZIP to Render without those changes will build the code but will not provide a complete, secure production service.
