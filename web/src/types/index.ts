import { Location, BoxChange, Route, RouteStop, User, UserRole } from '@prisma/client';

// Core domain types
export type LocationWithBoxChanges = Location & {
  boxChanges: BoxChange[];
  elapsedDays: number; // days since last box change
  status: 'fresh' | 'warning' | 'overdue'; // based on elapsed days
};

export type RouteWithStops = Route & {
  stops: (RouteStop & {
    location: Location;
  })[];
};

export type LocationStatus = 'fresh' | 'warning' | 'overdue';

// API request/response types
export interface CreateLocationRequest {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  description?: string;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
}

export interface UpdateLocationRequest {
  name?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  description?: string;
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
}

export interface MarkBoxChangeRequest {
  changedBy?: string;
  notes?: string;
  boxCount?: number;
}

export interface CreateRouteRequest {
  name: string;
  description?: string;
  locationIds: string[];
  optimize?: boolean;
}

export interface LocationResponse extends Location {
  elapsedDays: number;
  status: LocationStatus;
  lastChangeFormatted: string; // e.g., "3 days ago", "2 weeks ago"
}

export interface ElapsedTimeInfo {
  days: number;
  formatted: string; // e.g., "3 days ago", "2 weeks ago"
  status: LocationStatus;
}

// Route optimization types
export interface RouteOptimizationRequest {
  startLocation?: {
    latitude: number;
    longitude: number;
  };
  locationIds: string[];
  optimize: boolean;
}

export interface OptimizedRoute {
  distance: number; // in miles
  duration: number; // in minutes
  stops: {
    locationId: string;
    order: number;
    estimatedArrival?: Date;
  }[];
}

// Analytics types
export interface LocationAnalytics {
  totalLocations: number;
  activeLocations: number;
  freshCount: number; // < 7 days
  warningCount: number; // 7-14 days
  overdueCount: number; // > 14 days
  averageDaysBetweenChanges: number; // in days
}

export interface LocationFrequency {
  locationId: string;
  locationName: string;
  changeCount: number;
  averageDaysBetweenChanges: number;
  lastChangeDate: Date;
  status: LocationStatus;
}

// Error types
export interface ApiError {
  message: string;
  code: string;
  statusCode: number;
  details?: any;
}

// Time thresholds for status calculation (in days)
export const TIME_THRESHOLDS = {
  FRESH_THRESHOLD: 7,    // 7 days = fresh (green)
  WARNING_THRESHOLD: 14, // 14 days = overdue (red)
} as const;

export { Location, BoxChange, Route, RouteStop, User, UserRole }; 