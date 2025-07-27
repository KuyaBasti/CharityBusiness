import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LocationController } from '@/lib/controllers/locationController';
import { optimizeRoute, calculateDrivingDistances, handleApiError } from '@/lib/utils';
import prisma from '@/lib/db';

const locationController = new LocationController(prisma);

// Validation schema for route optimization
const optimizeRouteSchema = z.object({
  currentLocation: z.string().min(1, 'Current location is required'),
  locationIds: z.array(z.string()).min(1, 'At least one location is required'),
  returnToStart: z.boolean().default(true), // Should route return to starting location?
});

/**
 * POST /api/routes/optimize
 * Calculate the most efficient route for visiting multiple locations
 * 
 * This is the endpoint your mobile app calls when charity workers want to
 * visit multiple locations in the most efficient order.
 * 
 * Use case:
 * 1. Worker sees 5 overdue locations on their list
 * 2. They select 3 locations they want to visit today
 * 3. App calls this API to get optimal visiting order
 * 4. Worker follows the optimized route (saves time and gas!)
 * 
 * Body:
 * {
 *   "currentLocation": "Charity HQ, Detroit, MI",
 *   "locationIds": ["clx123", "clx456", "clx789"],
 *   "returnToStart": true
 * }
 * 
 * Response:
 * {
 *   "optimizedOrder": [
 *     { "id": "clx456", "name": "Food Bank A", "address": "123 Main St" },
 *     { "id": "clx789", "name": "Shelter B", "address": "456 Oak Ave" },
 *     { "id": "clx123", "name": "Center C", "address": "789 Elm St" }
 *   ],
 *   "totalDistance": 15.3,
 *   "totalDuration": 28,
 *   "routeSummary": "Current Location → Food Bank A → Shelter B → Center C → Current Location"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const { currentLocation, locationIds, returnToStart } = optimizeRouteSchema.parse(body);
    
    // Get location details from database
    const locations = await Promise.all(
      locationIds.map(id => locationController.getLocationById(id))
    );

    // Filter out any null results (invalid IDs)
    const validLocations = locations.filter(loc => loc !== null);
    
    if (validLocations.length === 0) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'No valid locations found',
          code: 'NO_VALID_LOCATIONS'
        }
      }, { status: 400 });
    }

    // Convert locations to addresses for Google Maps
    const destinationAddresses = validLocations.map(loc => loc!.address);
    
    // Use Google Maps to optimize the route
    const optimizedRoute = await optimizeRoute(currentLocation, destinationAddresses);
    
    // Map the optimized order back to our location data
    const optimizedLocationsOrder = optimizedRoute.optimizedOrder.map(address => {
      const location = validLocations.find(loc => loc!.address === address);
      return {
        id: location!.id,
        name: location!.name,
        address: location!.address,
        latitude: location!.latitude,
        longitude: location!.longitude,
        elapsedDays: location!.elapsedDays,
        status: location!.status
      };
    });

    // Create route summary for display
    const routeStops = [
      'Current Location',
      ...optimizedLocationsOrder.map(loc => loc.name),
      ...(returnToStart ? ['Current Location'] : [])
    ];
    const routeSummary = routeStops.join(' → ');

    return NextResponse.json({
      success: true,
      data: {
        optimizedOrder: optimizedLocationsOrder,
        totalDistance: optimizedRoute.totalDistance, // in miles
        totalDuration: optimizedRoute.totalDuration, // in minutes
        routeSummary,
        estimatedTime: `${Math.floor(optimizedRoute.totalDuration / 60)}h ${optimizedRoute.totalDuration % 60}m`,
        savings: `Optimized route saves time and fuel compared to visiting in original order`
      },
      message: `Optimized route for ${validLocations.length} locations`
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Validation error',
          code: 'VALIDATION_ERROR',
          details: error.errors
        }
      }, { status: 400 });
    }

    // Handle Google Maps API errors
    if (error instanceof Error && error.message.includes('Could not optimize route')) {
      return NextResponse.json({
        success: false,
        error: {
          message: 'Unable to optimize route. Please check addresses and try again.',
          code: 'ROUTE_OPTIMIZATION_FAILED'
        }
      }, { status: 503 });
    }

    const apiError = handleApiError(error);
    return NextResponse.json(
      { success: false, error: apiError },
      { status: apiError.statusCode }
    );
  }
} 