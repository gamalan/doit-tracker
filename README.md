# sv

Everything you need to build a Svelte project, powered by [`sv`](https://github.com/sveltejs/cli).

## Creating a project

If you're seeing this, you've probably already done this step. Congrats!

```bash
# create a new project in the current directory
npx sv create

# create a new project in my-app
npx sv create my-app
```

## Developing

Once you've created a project and installed dependencies with `npm install` (or `pnpm install` or `yarn`), start a development server:

```bash
npm run dev

# or start the server and open the app in a new browser tab
npm run dev -- --open
```

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

> Note: The project uses `@sveltejs/adapter-cloudflare` for deployment to Cloudflare Workers.
