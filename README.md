# DoIt Tracker

A comprehensive habit tracking application with intelligent momentum-based scoring system. Track daily and weekly habits, build streaks, and stay motivated with automated penalty systems for missed habits.

## ✨ Features

### 🎯 Smart Habit Tracking
- **Daily Habits**: Build consecutive streaks with momentum scoring (+1 to +7)
- **Weekly Habits**: Flexible completion tracking with target-based bonuses
- **Intelligent Scoring**: Momentum-based system that rewards consistency

### 📊 Momentum System
- **Daily Habits**:
  - Each completion: +1 point
  - Consecutive days: momentum increases up to +7 maximum
  - Missing days: reset streak to +1
  - Consecutive misses: penalty down to -3 minimum
- **Weekly Habits**:
  - Each completion: +1 point regardless of target
  - Target completion: +10 bonus
  - Consecutive weekly targets: additional +10 bonus (max +40)
  - Missing weeks: -10 penalty per consecutive miss (min -30)

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

### Cloudflare Workers Deployment

1. **Authenticate with Cloudflare**
   ```bash
   npx wrangler login
   ```

2. **Deploy to production**
   ```bash
   npm run deploy
   ```

3. **Verify cron jobs are active**
   ```bash
   npx wrangler deployments list
   ```

### Environment Configuration

The app requires these environment variables:

- `AUTH_SECRET`: Random string for session encryption
- `GOOGLE_CLIENT_ID`: Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Google OAuth client secret

### Database Setup

The app uses Cloudflare D1 database. Migration is handled automatically on deployment.

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
- Day 1: Complete → +1 momentum
- Day 2: Complete → +2 momentum  
- Day 3: Complete → +3 momentum
- Day 4: Miss → Cron resets to 0, then -1 penalty
- Day 5: Complete → +1 momentum (fresh start)

**Weekly Habit Scoring:**
- Week 1: 2 completions, target 2 → 2 + 10 = 12 momentum
- Week 2: 3 completions, target 2 → 3 + 10 + 10 (consecutive) = 23 momentum
- Week 3: 0 completions → 0 momentum (reset)

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
