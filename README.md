# Lost Children Charity Platform

**Created and Developed by KuyaBasti**

A revolutionary mobile application for managing candy box distribution to help lost children in the US. This app transforms how charity workers track elapsed time and optimize routes for maximum impact.

---

## 🏆 Creator & Vision

**Project Creator:** KuyaBasti  
**GitHub:** [@KuyaBasti](https://github.com/KuyaBasti)  
**Project Repository:** [CharityBusiness](https://github.com/KuyaBasti/CharityBusiness)

### Creator's Vision

This project was conceived and built by KuyaBasti to solve a real-world problem in charity work: efficiently tracking when candy boxes were last changed at various locations serving lost children. The innovative elapsed time tracking system combined with Google Maps route optimization represents a unique solution in the charity technology space.

**What makes this special:**
- **First-of-its-kind** elapsed time tracking for charity distributions
- **Mobile-first approach** designed for field workers
- **Smart route optimization** using Google Maps APIs
- **Simple yet powerful** - one-button operations for busy charity workers
- **Scalable architecture** applicable to multiple industries beyond charity work

### Innovation Credits

All core concepts, architecture decisions, and implementation strategies are the original work of KuyaBasti:

- ✅ **Elapsed Time Tracking System** - Original concept and implementation
- ✅ **Mobile-First Charity Management** - Innovative approach to field worker needs  
- ✅ **Google Maps Route Optimization Integration** - Smart routing for charity workers
- ✅ **Days-Based Status System** (Fresh/Overdue) - Simple and effective UX design
- ✅ **Backend API Architecture** - RESTful design optimized for mobile consumption
- ✅ **Cross-Industry Applicability** - Recognized potential beyond charity work

---

## 📱 Project Overview

This application helps charity workers efficiently manage and track candy box distributions across multiple locations. The system tracks how long each location has had the same boxes and provides simple tools to reset timers when boxes are changed, ensuring fresh supplies reach children who need them.

### Platform Architecture

- **Mobile App**: Primary Android application for field workers (iOS coming soon)
- **Backend API**: Next.js 14 with PostgreSQL database and Google Maps integration
- **Web Platform**: Simple landing page with app store download links

### Key Features

- **Elapsed Time Tracking**: Show how long ago boxes were last changed at each location (e.g., "5 days ago", "2 weeks ago")
- **One-Button Reset**: Simple "Mark as Changed" button to restart elapsed time tracking
- **Route Optimization**: Calculate the most efficient routes using Google Maps API
- **Location Management**: Add and manage multiple distribution locations with GPS coordinates
- **Visual Status Indicators**: Color-coded alerts based on elapsed time (green < 7 days, red ≥ 7 days)
- **Offline Functionality**: Android app works without internet for remote locations
- **Real-time Sync**: Automatic synchronization when connectivity is restored

### Problem Statement

Charity workers need to efficiently manage candy box distribution across multiple locations. The main challenges include:

- **Tracking Freshness**: Knowing exactly how long ago candy boxes were changed at each location
- **Route Planning**: Efficiently visiting locations that need box changes based on elapsed time
- **Simple Updates**: Easy way for field workers to mark when boxes are changed
- **Remote Access**: Working in areas with limited internet connectivity
- **Resource Optimization**: Prioritizing locations based on elapsed time since last change

### Solution Approach

KuyaBasti's innovative platform provides:
1. **Elapsed Time System**: Automatic tracking showing "X days ago" since boxes were last changed
2. **Simple Mobile Interface**: One-button solution designed for field workers
3. **Smart Route Optimization**: Google Maps integration for efficient multi-location visits
4. **Visual Status System**: Color-coded interface showing elapsed time and priority levels
5. **Offline-First Design**: Mobile app functions without internet connection

## 🚀 Technology Stack

### Backend (Next.js 14)
- **Framework**: Next.js 14 with App Router
- **Database**: PostgreSQL with Prisma ORM
- **APIs**: RESTful endpoints optimized for mobile consumption
- **Route Optimization**: Google Maps Directions API integration
- **Real-time Features**: Server-sent events for live updates
- **Type Safety**: Full TypeScript implementation

### Mobile Application (Android)
- **Language**: Kotlin
- **Architecture**: MVVM with Repository pattern
- **UI Framework**: Jetpack Compose
- **Navigation**: Navigation Component
- **Network**: Retrofit with OkHttp
- **Local Storage**: Room database for offline functionality
- **Maps**: Google Maps Android SDK
- **Location Services**: Fused Location Provider API

### Development Tools
- **Version Control**: Git with GitHub
- **Code Quality**: ESLint, Prettier, Ktlint
- **Testing**: Jest, JUnit, Espresso
- **Deployment**: Vercel (Backend), Google Play Store (Android)

## 📊 Core API Endpoints

### Location Management
```
GET    /api/locations              # Get all locations with elapsed time
POST   /api/locations              # Create new location
POST   /api/locations/[id]/mark-changed  # Reset elapsed time (core feature)
```

### Route Optimization
```
POST   /api/routes/optimize        # Calculate optimal visiting route
```

### Response Format
```json
{
  "success": true,
  "data": {
    "id": "location-123",
    "name": "Downtown Food Bank",
    "address": "123 Main St, Detroit, MI",
    "elapsedDays": 5,
    "status": "fresh",
    "lastChangeFormatted": "5 days ago"
  }
}
```

## 🎯 Market Potential

This platform addresses not only charity work but has applications across multiple industries:

- **Healthcare**: Medical equipment maintenance tracking
- **Food Safety**: Restaurant inspection intervals
- **Manufacturing**: Equipment maintenance schedules
- **Security**: Patrol completion verification
- **Retail**: Store maintenance and cleaning schedules

The core technology stack is designed to be adaptable across these verticals while maintaining the simple, mobile-first approach.

## 💡 Competitive Advantages

1. **Unique Focus**: First app specifically designed for elapsed time tracking in charity work
2. **Mobile-First**: Built for field workers, not office managers
3. **Simple UX**: One-button operations vs complex inventory systems
4. **Smart Routing**: Google Maps integration for real-world efficiency
5. **Offline Capable**: Works in remote areas without connectivity
6. **Scalable Design**: Architecture supports multiple industry verticals

## 📁 Project Structure

```
CharityBusiness/
├── web/                          # Backend API (Next.js 14)
│   ├── src/
│   │   ├── app/
│   │   │   └── api/              # API routes
│   │   │       ├── locations/    # Location management endpoints
│   │   │       └── routes/       # Route optimization endpoints
│   │   ├── lib/
│   │   │   ├── controllers/      # Business logic controllers
│   │   │   ├── db.ts            # Database connection
│   │   │   └── utils.ts         # Utility functions with Google Maps
│   │   └── types/               # TypeScript type definitions
│   ├── prisma/
│   │   └── schema.prisma        # Database schema
│   ├── package.json             # Dependencies and scripts
│   └── env.example              # Environment variables template
├── android/                      # Android application
│   ├── app/
│   │   ├── src/main/
│   │   │   ├── java/com/charity/
│   │   │   │   ├── ui/           # Compose UI screens
│   │   │   │   │   ├── locations/     # Location list and timers
│   │   │   │   │   ├── maps/          # Map and route screens
│   │   │   │   │   └── main/          # Main navigation
│   │   │   │   ├── data/         # Repository and data sources
│   │   │   │   ├── network/      # API service interfaces
│   │   │   │   └── utils/        # Helper functions
│   │   │   └── res/              # Android resources
│   │   └── build.gradle
│   └── build.gradle
├── docs/                         # Documentation
└── README.md                     # This file
```

## 🔧 Getting Started

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Google Maps API key
- Android Studio (for mobile development)

### Backend Setup
```bash
cd web
npm install
cp env.example .env.local
# Add your database URL and Google Maps API key
npm run db:generate
npm run dev
```

### Environment Variables
```env
DATABASE_URL="postgresql://username:password@localhost:5432/charity_db"
GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"
```

## 📞 Contact & Collaboration

**Creator:** KuyaBasti  
**Project:** Lost Children Charity Platform  
**Repository:** https://github.com/KuyaBasti/CharityBusiness  

For business inquiries, partnership opportunities, or licensing discussions, please contact through GitHub.

## 📄 License & Copyright

© 2024 KuyaBasti. All rights reserved.

This project and all its components, including but not limited to:
- Software architecture and design
- Source code and implementation
- API design and endpoints  
- Mobile application design
- Database schema and structure
- Documentation and concepts

Are the intellectual property of KuyaBasti.

## 🙏 Acknowledgments

- Google Maps Platform for routing and geocoding services
- Next.js team for the excellent web framework
- Prisma team for the database toolkit
- The charity workers who inspired this solution