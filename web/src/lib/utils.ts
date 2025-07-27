import { format } from 'date-fns';
import { Client } from '@googlemaps/google-maps-services-js';
import { LocationStatus, ElapsedTimeInfo, TIME_THRESHOLDS } from '@/types';

// Initialize Google Maps client
const googleMapsClient = new Client({});

/**
 * Calculate elapsed days since a given date
 */
export function calculateElapsedDays(since: Date): ElapsedTimeInfo {
  const now = new Date();
  const elapsedMs = now.getTime() - since.getTime();
  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  
  // Determine status based on elapsed days
  const status: LocationStatus = days < TIME_THRESHOLDS.FRESH_THRESHOLD ? 'fresh' : 'overdue';
  
  // Format human-readable elapsed time
  let formatted: string;
  if (days === 0) {
    formatted = 'Today';
  } else if (days === 1) {
    formatted = '1 day ago';
  } else if (days < 7) {
    formatted = `${days} days ago`;
  } else if (days < 14) {
    const weeks = Math.floor(days / 7);
    formatted = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  } else {
    formatted = `${days} days ago`;
  }
  
  return {
    days,
    formatted,
    status,
  };
}

/**
 * Get location status based on elapsed days since last box change
 */
export function getLocationStatus(lastBoxChange: Date): LocationStatus {
  const now = new Date();
  const elapsedMs = now.getTime() - lastBoxChange.getTime();
  const days = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  
  return days < TIME_THRESHOLDS.FRESH_THRESHOLD ? 'fresh' : 'overdue';
}

/**
 * Format a date for display
 */
export function formatDate(date: Date, formatString: string = 'MMM dd, yyyy HH:mm'): string {
  return format(date, formatString);
}

/**
 * Calculate straight-line distance between coordinates (fallback - returns miles)
 */
export function calculateStraightLineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate real driving distances using Google Maps Distance Matrix API
 */
export async function calculateDrivingDistances(
  origin: string,
  destinations: string[]
): Promise<Array<{ distance: number; duration: number; destination: string }>> {
  try {
    const response = await googleMapsClient.distancematrix({
      params: {
        origins: [origin],
        destinations: destinations,
        units: 'imperial', // Use miles
        mode: 'driving',
        key: process.env.GOOGLE_MAPS_API_KEY!,
      },
    });

    const results = response.data.rows[0].elements.map((element, index) => {
      if (element.status === 'OK') {
        // Convert distance text like "3.2 mi" to number
        const distanceText = element.distance.text;
        const distanceValue = parseFloat(distanceText.replace(' mi', ''));
        
        // Convert duration text like "8 mins" to number
        const durationText = element.duration.text;
        const durationValue = parseInt(durationText.replace(' mins', '').replace(' min', ''));
        
        return {
          distance: distanceValue,
          duration: durationValue,
          destination: destinations[index],
        };
      } else {
        // Fallback to straight-line distance if API fails
        console.warn(`Could not calculate distance to ${destinations[index]}, using fallback`);
        return {
          distance: 0, // Will need coordinates for fallback
          duration: 0,
          destination: destinations[index],
        };
      }
    });

    return results;
  } catch (error) {
    console.error('Google Maps API error:', error);
    throw new Error('Could not calculate driving distances');
  }
}

/**
 * Find optimal route order using Google Maps (for multiple stops)
 */
export async function optimizeRoute(
  origin: string,
  destinations: string[]
): Promise<{ 
  optimizedOrder: string[]; 
  totalDistance: number; 
  totalDuration: number 
}> {
  try {
    const response = await googleMapsClient.directions({
      params: {
        origin: origin,
        destination: origin, // Return to start
        waypoints: destinations,
        optimize: true, // Google optimizes the order
        mode: 'driving',
        units: 'imperial',
        key: process.env.GOOGLE_MAPS_API_KEY!,
      },
    });

    const route = response.data.routes[0];
    const optimizedOrder: string[] = [];
    let totalDistance = 0;
    let totalDuration = 0;

    // Extract optimized waypoint order
    if (route.waypoint_order) {
      route.waypoint_order.forEach((index) => {
        optimizedOrder.push(destinations[index]);
      });
    }

    // Calculate total distance and duration
    route.legs.forEach((leg) => {
      totalDistance += parseFloat(leg.distance.text.replace(' mi', ''));
      totalDuration += parseInt(leg.duration.text.replace(' mins', '').replace(' min', ''));
    });

    return {
      optimizedOrder,
      totalDistance,
      totalDuration,
    };
  } catch (error) {
    console.error('Route optimization error:', error);
    throw new Error('Could not optimize route');
  }
}

/**
 * Convert address to GPS coordinates (geocoding)
 */
export async function addressToCoordinates(address: string): Promise<{ lat: number; lng: number }> {
  try {
    const response = await googleMapsClient.geocode({
      params: {
        address: address,
        key: process.env.GOOGLE_MAPS_API_KEY!,
      },
    });

    if (response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return { lat: location.lat, lng: location.lng };
    } else {
      throw new Error(`Could not geocode address: ${address}`);
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    throw new Error('Could not convert address to coordinates');
  }
}

/**
 * Validate GPS coordinates
 */
export function isValidCoordinates(latitude: number, longitude: number): boolean {
  return (
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

/**
 * Create a standardized API error response
 */
export function createApiError(
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
) {
  return {
    message,
    statusCode,
    code: code || `ERROR_${statusCode}`,
    details,
  };
}

/**
 * Handle API errors consistently
 */
export function handleApiError(error: unknown): {
  message: string;
  statusCode: number;
  code: string;
} {
  if (error instanceof Error) {
    // Handle Prisma errors
    if (error.message.includes('Unique constraint')) {
      return createApiError('Resource already exists', 409, 'DUPLICATE_RESOURCE');
    }
    
    if (error.message.includes('Record to update not found')) {
      return createApiError('Resource not found', 404, 'RESOURCE_NOT_FOUND');
    }
    
    return createApiError(error.message, 500, 'INTERNAL_ERROR');
  }
  
  return createApiError('An unexpected error occurred', 500, 'UNKNOWN_ERROR');
} 