#!/usr/bin/env node
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configuration
const migrationFile = path.join(__dirname, 'src/lib/db/migrations.sql');

// Create readline interface for user input
const rl = readline.createInterface({
	input: process.stdin,
	output: process.stdout
});

// Required environment variables for authentication
const requiredEnvVars = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'AUTH_SECRET'];

console.log('Starting deployment process for DoIt Tracker...');

// Check if wrangler is installed
console.log('Checking for wrangler...');
exec('npx wrangler --version', (error) => {
	if (error) {
		console.error('Wrangler not found. Please install it with: npm install -g wrangler');
		process.exit(1);
	}

	console.log('Wrangler found, continuing...');

	// Step 1: Create the D1 database if it doesn't exist
	console.log("Creating D1 database if it doesn't exist...");
	exec('npx wrangler d1 create doit-tracker', (error, stdout, stderr) => {
		// Check if the database already exists message is in stdout or stderr
		const databaseExistsMessage = 'already exists';
		const databaseAlreadyExists =
			(stdout && stdout.includes(databaseExistsMessage)) ||
			(stderr && stderr.includes(databaseExistsMessage));

		if (error && !databaseAlreadyExists) {
			console.error('Error creating D1 database:', error);
			process.exit(1);
		}

		if (stdout && stdout.includes('database_id')) {
			const match = stdout.match(/database_id:\s*"([^"]+)"/);
			if (match && match[1]) {
				console.log(`Database created with ID: ${match[1]}`);
				console.log(`Please update your wrangler.jsonc with this ID.`);
			}
		} else {
			console.log('Database already exists, continuing...');
		}

		// Setup environment variables

		// Step 2: Run the migrations
		console.log('Running database migrations...');
		if (fs.existsSync(migrationFile)) {
			exec(`npx wrangler d1 execute doit-tracker --remote --file=${migrationFile}`, (error) => {
				if (error) {
					console.error('Error running migrations:', error);
					process.exit(1);
				}

				console.log('Migrations completed successfully.');

				// Step 3: Deploy the application
				console.log('Deploying application...');
				exec('npm run build && npx wrangler deploy', (error) => {
					if (error) {
						console.error('Error deploying application:', error);
						process.exit(1);
					}

					console.log('Deployment completed successfully!');
					console.log('Your DoIt Tracker application is now live on Cloudflare Pages.');
					rl.close();
				});
			});
		} else {
			console.error(`Migration file not found: ${migrationFile}`);
			process.exit(1);
		}
	});
});
