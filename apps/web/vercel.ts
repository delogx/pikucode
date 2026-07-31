import { routes, type VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  buildCommand:
    'vp run --filter @piku/web build && node ../../scripts/apply-web-brand-assets.ts --channel "${VITE_HOSTED_APP_CHANNEL:-nightly}"',
  git: {
    deploymentEnabled: false,
  },
  installCommand:
    "npm install -g vite-plus && vp install --ignore-scripts --filter '@piku/scripts...' --filter '@piku/web...'",
  rewrites: [routes.rewrite("/(.*)", "/index.html")],
};
