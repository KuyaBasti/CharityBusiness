# Lost Children Charity Platform

A simple web platform hosted on Vercel and Android mobile application for managing candy box distribution to help lost children in the US.

## Project Overview

This application helps charity workers efficiently manage and track candy box distributions across multiple locations. The system tracks how long each location has had the same boxes and provides simple tools to reset timers when boxes are changed, ensuring fresh supplies reach children who need them.

### Platform Architecture

- **Web Platform**: Vercel-hosted website for location management and analytics
- **Android App**: Mobile application for field workers to track and update box changes
- **Backend API**: Simple API for timer tracking and location updates

### Key Features

- **Elapsed Time Tracking**: Show how long ago boxes were last changed at each location (e.g., "3 days ago", "2 weeks ago")
- **Simple Box Change Toggle**: One-click button to mark boxes as changed and restart elapsed time tracking
- **Route Optimization**: Calculate the most efficient routes to visit locations that need box changes
- **Location Management**: Add and manage multiple distribution locations across cities and neighborhoods
- **Visual Status Indicators**: Color-coded alerts based on elapsed time (green < 1 week, yellow < 2 weeks, red > 2 weeks)
- **Offline Functionality**: Android app works without internet for remote locations
- **Simple Analytics**: Basic reporting on box change frequency and coverage

### Problem Statement

Charity workers need to efficiently manage candy box distribution across multiple locations. The main challenges include:

- **Tracking Freshness**: Knowing exactly how long ago candy boxes were changed at each location
- **Route Planning**: Efficiently visiting locations that need box changes based on elapsed time
- **Simple Updates**: Easy way for field workers to mark when boxes are changed
- **Remote Access**: Working in areas with limited internet connectivity
- **Resource Optimization**: Prioritizing locations based on elapsed time since last change

### Solution Approach

The platform provides:
1. **Elapsed Time System**: Automatic tracking showing "X days ago" since boxes were last changed at each location
2. **Simple Toggle Interface**: One-button solution to mark boxes as changed and restart time tracking
3. **Route Optimization**: Smart routing to visit locations that need attention most (oldest changes first)
4. **Visual Dashboard**: Color-coded interface showing elapsed time and priority levels
5. **Mobile Offline Support**: Android app functions without internet connection

## Technology Stack

### Web Platform (Vercel)
- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **State Management**: Zustand or React Context
- **Database**: Vercel Postgres or Supabase
- **Authentication**: Simple login system
- **Deployment**: Vercel
- **Maps**: Google Maps JavaScript API
- **Real-time Updates**: Server-Sent Events for timer updates

### Android Application
- **Language**: Kotlin
- **Architecture**: MVVM with Repository pattern
- **UI Framework**: Jetpack Compose
- **Navigation**: Navigation Component
- **Network**: Retrofit with OkHttp
- **Database**: Room (local storage)
- **Maps**: Google Maps Android SDK
- **Location**: Fused Location Provider API

### Backend Services
- **API**: Next.js API routes
- **Database**: PostgreSQL with PostGIS for geospatial data
- **Route Optimization**: Google Maps API / OpenRouteService
- **Timer Management**: Automated background jobs for time tracking
- **Real-time Updates**: Server-Sent Events for live timer updates

### Development Tools
- **Language**: TypeScript (Web), Kotlin (Android)
- **Testing**: Jest, Vitest (Web), JUnit, Espresso (Android)
- **Code Quality**: ESLint, Prettier (Web), Ktlint (Android)
- **Build**: Vercel (Web), Gradle (Android)

## Project Structure

```
CharityBusiness/
├── web/                          # Web platform (Vercel)
│   ├── src/
│   │   ├── app/                  # Next.js App Router pages
│   │   │   ├── dashboard/        # Location management dashboard
│   │   │   ├── locations/        # Location timer tracking
│   │   │   ├── routes/           # Route planning and optimization
│   │   │   ├── analytics/        # Simple analytics and reports
│   │   │   ├── api/              # API routes
│   │   │   └── auth/             # Authentication pages
│   │   ├── components/           # Reusable React components
│   │   ├── lib/                  # Utility functions and config
│   │   ├── hooks/                # Custom React hooks
│   │   ├── types/                # TypeScript type definitions
│   │   └── styles/               # Global styles and Tailwind config
│   ├── public/                   # Static assets
│   ├── prisma/                   # Database schema (if using Prisma)
│   └── package.json
├── android/                      # Android application
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/charity/
│   │   │   │   ├── ui/           # Compose UI screens
│   │   │   │   │   ├── locations/     # Location list and timers
│   │   │   │   │   ├── toggle/        # Box change toggle screen
│   │   │   │   │   ├── maps/          # Map and route screens
│   │   │   │   │   └── auth/          # Authentication screens
│   │   │   │   ├── data/         # Repository and data sources
│   │   │   │   ├── domain/       # Business logic and use cases
│   │   │   │   ├── network/      # API service interfaces
│   │   │   │   └── utils/        # Helper functions
│   │   │   └── res/              # Android resources
│   │   └── build.gradle
│   └── build.gradle
├── backend/                      # Shared backend (if separate)
│   ├── routes/                   # API route definitions
│   ├── controllers/              # Business logic controllers
│   ├── models/                   # Database models
│   ├── middleware/               # Custom middleware
│   └── config/                   # Configuration files
├── docs/                         # Documentation
└── README.md
```

## Core Modules

### Web Platform Features
1. **Location Management**
   - Add and manage candy box distribution locations
   - View real-time timer status for each location
   - Color-coded alerts for locations needing attention
   - Geographic visualization of all locations

2. **Timer Tracking System**
   - Automatic time tracking since last box change
   - Visual indicators for time thresholds (e.g., green < 1 week, yellow < 2 weeks, red > 2 weeks)
   - Historical data on box change frequency
   - Batch operations for multiple locations

3. **Route Planning**
   - Generate optimal routes for visiting locations
   - Prioritize locations based on time since last change
   - Export routes to mobile devices
   - Estimated time and distance calculations

### Android App Features
1. **Location Timer Display**
   - Real-time countdown/count-up timers for each location
   - Clear visual status indicators
   - Location details and last change information
   - Offline timer tracking when internet unavailable

2. **Simple Box Change Toggle**
   - Large, prominent "Boxes Changed" button
   - Instant timer reset functionality
   - Confirmation dialog to prevent accidental presses
   - Automatic sync when internet connection restored

3. **Navigation & Route Following**
   - GPS navigation to locations
   - Route optimization for multiple stops
   - Current location tracking
   - Offline maps support for remote areas

## API Endpoints

### Location Management
- `GET /api/locations` - Get all locations with timer status
- `POST /api/locations` - Add new location
- `PUT /api/locations/:id` - Update location details
- `DELETE /api/locations/:id` - Remove location

### Elapsed Time Operations
- `POST /api/locations/:id/mark-changed` - Mark boxes as changed (restart elapsed time tracking)
- `GET /api/locations/:id/elapsed-time` - Get current elapsed time since last change
- `GET /api/locations/overdue` - Get locations that need attention based on elapsed time
- `POST /api/locations/batch-mark-changed` - Mark multiple locations as changed at once

### Route Planning
- `POST /api/routes/optimize` - Calculate optimal route for selected locations
- `GET /api/routes/:id` - Get route details and directions
- `POST /api/routes/priority` - Generate route prioritizing overdue locations

### Analytics
- `GET /api/analytics/elapsed-times` - Get elapsed time statistics and trends
- `GET /api/analytics/locations` - Get location performance data
- `GET /api/analytics/coverage` - Get coverage and frequency reports

## Getting Started

### Web Platform Setup

1. Clone the repository
```bash
git clone https://github.com/KuyaBasti/CharityBusiness.git
cd CharityBusiness/web
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
```bash
cp env.example.template .env.local
# Add your Stripe keys, database URL, etc.
```

4. Run development server
```bash
npm run dev
```

5. Deploy to Vercel
```bash
vercel --prod
```

### Android App Setup

1. Navigate to Android directory
```bash
cd ../android
```

2. Open in Android Studio
```bash
studio .
```

3. Set up API keys
```bash
cp local.properties.example local.properties
# Then edit local.properties with your actual API keys:
# GOOGLE_MAPS_API_KEY=your_api_key
# API_BASE_URL=your_vercel_domain
```

4. Build and run
```bash
./gradlew assembleDebug
```

## Deployment

### Web Platform
- **Hosting**: Vercel (automatic deployments from main branch)
- **Database**: Vercel Postgres or Supabase
- **Domain**: Custom domain configuration in Vercel dashboard

### Android App
- **Distribution**: Google Play Store
- **Build**: GitHub Actions for automated APK generation
- **Testing**: Firebase Test Lab integration

## Security

This project handles sensitive location information for candy box distribution sites. Please review our [Security Guidelines](docs/SECURITY.md) before contributing to ensure proper handling of:

- API keys and environment variables
- Database connections
- Location data and privacy protection
- Timer data integrity

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Mission Statement

Our mission is to leverage simple, effective technology to help charity workers efficiently distribute candy boxes to locations serving lost children in the United States. Through timer-based tracking and optimized routing, we aim to ensure fresh supplies reach those who need them most while minimizing wasted effort and maximizing coverage.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

For questions, partnership inquiries, or support, please contact the development team.

---

**Note**: This platform is designed to serve the critical mission of helping lost children through efficient candy box distribution. All development will prioritize simplicity, reliability, and the safety of the children we serve.