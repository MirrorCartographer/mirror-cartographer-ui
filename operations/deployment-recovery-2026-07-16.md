# Deployment recovery trigger

This commit intentionally triggers every repository-connected deployment provider after the prior public Vercel alias was deleted.

Expected integrations:

- Vercel: build the Vite application from `main`.
- Cloudflare: build the connected project from `main` if the integration remains active.
- GitHub Pages: run `.github/workflows/deploy-github-pages.yml`.

Required verification:

1. Record the provider-generated public URL.
2. Verify the deployed commit identity.
3. Verify mobile loading and the no-autoplay contract.
4. Record DNS or alias failures without deleting the working deployment.
5. Keep at least one provider-independent fallback route.

The source repository remains private; public deployment URLs should not require GitHub authentication.
