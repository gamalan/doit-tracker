# DoIt Tracker

A comprehensive habit tracking application with intelligent momentum-based scoring system. Track daily and weekly habits, build streaks, and stay motivated with automated penalty systems for missed habits.

## ✨ Features

### 🎯 Smart Habit Tracking
- **Daily Habits**: Build consecutive streaks with momentum scoring (+1 to +7)
- **Weekly Habits**: Flexible completion tracking with target-based bonuses
- **Intelligent Scoring**: Momentum-based system that rewards consistency

### 📊 Momentum System

#### Daily Habits
- **Base momentum**: Each completion adds +1 to daily momentum
- **Streak building**: Consecutive completions increase momentum (+2, +3, up to +7 max)
- **First miss**: Resets positive momentum to 0
- **Consecutive misses**: Decrease momentum by -1 each day (down to -3 minimum)
- **Recovery**: Completing after misses resets to +1
- **Accumulated momentum**: Sum of all daily momentum deltas over time

#### Weekly Habits
- **Base momentum**: Each completion adds +1 per tracking
- **Target bonus**: Meeting weekly target adds +10 bonus
- **Consecutive bonus**: Meeting target 2+ weeks in a row adds additional +10 (max total +40)
- **Missing target penalty**:
  - 1st week missing target: No penalty (just base completions)
  - 2nd consecutive week: -10 penalty
  - 3rd consecutive week: -20 penalty
  - 4th+ consecutive weeks: -30 penalty (capped)
- **Formula**: `momentum = completions + bonuses + penalties`
- **Example**: 2 completions with target 3 on 3rd consecutive miss = `2 + (-20) = -18`
- **Accumulated momentum**: Sum of all weekly momentum at week end (updated by cron)

#### Total Momentum Score
- Sum of accumulated momentum from all active daily and weekly habits
- Updated in real-time for daily habits (on each tracking)
- Updated weekly for weekly habits (Monday 1 AM UTC via cron)

### 🤖 Automated Penalty System
- **Daily Processing**: Automatically detect missed daily habits every day
- **Weekly Processing**: Check completed weeks and apply penalties on Mondays
- **Smart Penalties**: Apply appropriate momentum penalties for missed habits
- **Cloudflare Workers**: Reliable processing at 1 AM UTC daily
- **No Manual Intervention**: System tracks misses even when you don't log in

### 📈 Analytics & Visualization
- **Dashboard**: Real-time momentum tracking and habit summaries
- **Charts**: 30-day momentum history visualization
- **Color Coding**: Visual momentum indicators (green for positive, red for negative)
- **Progress Tracking**: Weekly target progress and completion rates

### 🔐 Secure & Scalable
- **Google OAuth**: Secure authentication
- **Cloudflare D1**: Distributed SQL database
- **Edge Computing**: Fast global performance
- **Data Privacy**: User data isolated and secure

## 🚀 Getting Started

### Prerequisites

1. Node.js (v18 or higher)
2. Cloudflare account for deployment
3. Google OAuth credentials for authentication

### Development Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd doit-tracker
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp wrangler.jsonc.example wrangler.jsonc
   # Edit wrangler.jsonc with your Cloudflare settings
   ```

4. **Set up authentication**
   ```bash
   # Add your OAuth secrets to Cloudflare
   npx wrangler secret put AUTH_SECRET
   npx wrangler secret put GOOGLE_CLIENT_ID
   npx wrangler secret put GOOGLE_CLIENT_SECRET
   ```

5. **Run development server**
   ```bash
   npm run dev
   ```

## 🏗️ Building

To create a production version:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## 🧪 Testing

### Run Unit Tests
```bash
npm run test:unit
```

### Run Integration Tests
```bash
npm run test:integration
```

### Run End-to-End Tests
```bash
npm run test:e2e
```

### Run All Tests
```bash
npm run test
```

### Test Coverage
```bash
npm run test:coverage
```

## 📦 Deployment

### Prerequisites

1. **Cloudflare Account**: Create account at [cloudflare.com](https://cloudflare.com)
2. **Wrangler CLI**: Installed automatically with `npm install`
3. **Google OAuth App**: Set up at [Google Cloud Console](https://console.cloud.google.com)

### Step-by-Step Deployment

#### 1. Configure Environment

```bash
# Copy example config
cp wrangler.jsonc.example wrangler.jsonc

# Edit wrangler.jsonc with your details:
# - Replace "your-d1-database-name" with actual DB name
# - Update account_id and compatibility_date
```

#### 2. Authenticate with Cloudflare

```bash
npx wrangler login
```

#### 3. Create D1 Database

```bash
# Create new D1 database
npx wrangler d1 create doit-tracker-db

# Update wrangler.jsonc with the database_id from output
```

#### 4. Run Database Migrations

```bash
# Apply database schema
npx wrangler d1 execute doit-tracker-db --file=./src/lib/db/migrations.sql

# Apply performance indexes (recommended for production)
npx wrangler d1 execute doit-tracker-db --file=./src/lib/db/migrations-performance.sql
```

#### 5. Set Environment Secrets

```bash
# Generate random AUTH_SECRET (32+ characters)
npx wrangler secret put AUTH_SECRET

# Add Google OAuth credentials
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
```

#### 6. Build and Deploy

```bash
# Build the app
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

#### 7. Verify Deployment

```bash
# Check deployment status
npx wrangler deployments list

# Test cron job manually
curl https://your-app.your-subdomain.workers.dev/api/cron/daily-missed

# View live app
echo "Visit: https://your-app.your-subdomain.workers.dev"
```

### Google OAuth Setup

1. **Create OAuth App**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create new project or select existing
   - Enable Google+ API

2. **Configure OAuth**:
   ```
   Authorized origins: https://your-app.your-subdomain.workers.dev
   Authorized redirect: https://your-app.your-subdomain.workers.dev/auth/callback/google
   ```

3. **Get Credentials**:
   - Copy Client ID and Client Secret
   - Add them using `wrangler secret put`

### Environment Configuration

Required environment variables:

- `AUTH_SECRET`: Random 32+ character string for session encryption
- `GOOGLE_CLIENT_ID`: Google OAuth client ID  
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

### Database Management

```bash
# View database schema
npx wrangler d1 execute doit-tracker-db --command="SELECT name FROM sqlite_master WHERE type='table';"

# View indexes
npx wrangler d1 execute doit-tracker-db --command="SELECT name FROM sqlite_master WHERE type='index';"

# Query data
npx wrangler d1 execute doit-tracker-db --command="SELECT * FROM users LIMIT 5;"

# Backup database
npx wrangler d1 export doit-tracker-db --output=backup.sql

# Apply performance migrations to existing database
npx wrangler d1 execute doit-tracker-db --file=./src/lib/db/migrations-performance.sql
```

### Troubleshooting Deployment

**Build Errors:**
```bash
npm run check    # Check TypeScript
npm run lint     # Check code style
npm run build    # Test build
```

**Deployment Fails:**
- Verify `wrangler.jsonc` database_id matches D1 database
- Check account_id is correct
- Ensure all secrets are set

**Cron Jobs Not Working:**
```bash
# Check cron triggers in wrangler.jsonc
# Verify deployment with: npx wrangler deployments list
# Test manually: GET /api/cron/daily-missed
```

## 🔧 Configuration

### Cron Schedule

The app runs a daily cron job at 1 AM UTC to process missed habits. Configure in `wrangler.jsonc`:

```json
{
  "triggers": {
    "crons": ["0 1 * * *"]
  }
}
```

**Processing Schedule:**
- **Daily**: Runs every day at 1 AM UTC to detect missed daily habits from yesterday
- **Weekly**: Runs on Mondays at 1 AM UTC to process completed weeks (Sunday ended)
- **Penalties**: Automatically applied based on momentum calculation rules

### Habit Momentum Limits

Current momentum caps (defined in `src/lib/habits.ts`):
- Daily habits: +7 to -3
- Weekly habits: +40 to -30

## 🏛️ Architecture

### Tech Stack
- **Frontend**: SvelteKit, TailwindCSS
- **Backend**: Cloudflare Workers, D1 Database
- **Auth**: @auth/sveltekit with Google OAuth
- **ORM**: Drizzle ORM
- **Testing**: Vitest, Playwright

### Key Components
- **Habit Management**: Create, track, and analyze habits
- **Momentum Engine**: Calculate and apply scoring rules
- **Cron System**: Automated missed habit processing
- **Dashboard**: Real-time analytics and visualizations

### Database Schema
- `users`: User authentication data
- `habits`: Habit definitions and settings
- `habitRecords`: Daily/weekly tracking records with momentum

## 🎮 Usage Examples

### Creating Habits

**Daily Habit:**
```javascript
{
  name: "Morning Exercise",
  type: "daily",
  description: "30-minute workout"
}
```

**Weekly Habit:**
```javascript
{
  name: "Deep Work",
  type: "weekly",
  targetCount: 3,
  description: "3 hours of focused work"
}
```

### Momentum Calculation Examples

**Daily Habit Streak:**
- Day 1: Complete → +1 momentum, accumulated = 1
- Day 2: Complete → +2 momentum, accumulated = 1 + 1 = 2
- Day 3: Complete → +3 momentum, accumulated = 2 + 1 = 3
- Day 4: Miss → 0 momentum (reset), accumulated = 3 + (-3) = 0
- Day 5: Miss → -1 momentum, accumulated = 0 + (-1) = -1
- Day 6: Complete → +1 momentum (recovery), accumulated = -1 + 2 = 1

**Weekly Habit Scoring (Target = 3):**
- Week 1: 4 completions → 4 + 10 = 14, accumulated = 14
- Week 2: 4 completions → 4 + 10 + 10 = 24 (consecutive), accumulated = 14 + 24 = 38
- Week 3: 2 completions (1st miss) → 2, accumulated = 38 + 2 = 40
- Week 4: 2 completions (2nd miss) → 2 - 10 = -8, accumulated = 40 + (-8) = 32
- Week 5: 2 completions (3rd miss) → 2 - 20 = -18, accumulated = 32 + (-18) = 14
- Week 6: 2 completions (4th miss) → 2 - 30 = -28, accumulated = 14 + (-28) = -14

## 🛠️ Development

### Adding New Features

1. **Backend Logic**: Add functions to `src/lib/habits.ts`
2. **API Endpoints**: Create in `src/routes/api/`
3. **Frontend Pages**: Add to `src/routes/`
4. **Tests**: Include unit, integration, and e2e tests

### Testing Strategy

- **Unit Tests**: Individual function logic
- **Integration Tests**: API endpoints and database operations  
- **E2E Tests**: Complete user workflows
- **Cron Tests**: Automated penalty system

### Code Structure
```
src/
├── lib/
│   ├── habits.ts          # Core momentum logic
│   ├── cron/              # Automated processing
│   └── db/                # Database schema & client
├── routes/
│   ├── api/               # API endpoints
│   ├── habits/            # Habit management pages
│   └── dashboard/         # Analytics dashboard
└── tests/
    ├── unit/              # Unit tests
    ├── integration/       # Integration tests
    └── e2e/               # End-to-end tests
```

## 📊 Monitoring

### Production Monitoring
- Cloudflare Analytics for performance
- Cron job execution logs
- Database query performance
- User engagement metrics

### Debug Endpoints
- `GET /api/cron/daily-missed` - Manual trigger for both daily and weekly processing
- `POST /api/cron/daily-missed` - Production cron endpoint (Cloudflare only)
- Wrangler logs for troubleshooting

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add comprehensive tests
4. Ensure all tests pass
5. Submit a pull request

## 🎯 Roadmap

- [ ] Mobile app companion
- [ ] Advanced analytics dashboard
- [ ] Social features and sharing
- [ ] Habit templates and recommendations
- [ ] Data export capabilities
- [ ] Custom momentum rules

## 🆘 Troubleshooting

### Common Issues

**Cron jobs not running:**
- Verify `wrangler.jsonc` triggers configuration
- Check Cloudflare Workers dashboard
- Ensure deployment was successful

**Authentication errors:**
- Verify OAuth credentials in secrets
- Check redirect URLs in Google Console
- Validate AUTH_SECRET is set

**Database errors:**
- Run `npx wrangler d1 execute` to check DB status
- Verify migrations completed successfully

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌐 Demo

A live demo is available at: https://doit.empat.id/

Test the momentum system, cron jobs, and analytics features in real-time!
