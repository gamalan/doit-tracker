# DoIt Tracker

## Building

To create a production version of your app:

```bash
npm run build
```

You can preview the production build with `npm run preview`.

## Deployment

This app is configured to be deployed to Cloudflare Workers. Here's how to deploy it:

### Prerequisites

1. Make sure you have a Cloudflare account set up
2. Configure your `wrangler.jsonc` file (use `wrangler.jsonc.example` as a template if needed)
3. Authenticate with Cloudflare using Wrangler:

```bash
npx wrangler login
```

### Deploy to Cloudflare Workers

Deploy the application with:

```bash
npm run deploy
```

This command builds your application and deploys it to Cloudflare Workers.

### Testing Your Deployment

To test your deployment locally before pushing to production:

```bash
npm run preview
```

This will build your application and start a local Wrangler development server to simulate the Cloudflare Workers environment.

### Demo

A public demo version of the application is available for testing at:

https://doit-tracker.empat.workers.dev/

> Note: The project uses `@sveltejs/adapter-cloudflare` for deployment to Cloudflare Workers.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
