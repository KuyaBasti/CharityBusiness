import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LocationController } from '@/lib/controllers/locationController';
import { handleApiError } from '@/lib/utils';
import prisma from '@/lib/db';

const locationController = new LocationController(prisma);

// Validation schema for creating locations
const createLocationSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  description: z.string().optional(),
  contactPerson: z.string().optional(),
  contactPhone: z.string().optional(),
  notes: z.string().optional(),
});

/**
 * GET /api/locations
 * Get all locations with elapsed days information
 * 
 * Query params:
 * - overdue=true: Only return overdue locations (> 7 days)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const overdueOnly = searchParams.get('overdue') === 'true';

    const locations = overdueOnly 
      ? await locationController.getOverdueLocations()
      : await locationController.getAllLocations();

    return NextResponse.json({
      success: true,
      data: locations,
      count: locations.length
    });
  } catch (error) {
    const apiError = handleApiError(error);
    return NextResponse.json(
      { success: false, error: apiError },
      { status: apiError.statusCode }
    );
  }
}

/**
 * POST /api/locations
 * Create a new location
 * 
 * Body:
 * {
 *   "name": "Downtown Food Bank",
 *   "address": "123 Main St, Detroit, MI",
 *   "latitude": 42.3314,
 *   "longitude": -83.0458,
 *   "description": "Main food distribution center",
 *   "contactPerson": "John Doe",
 *   "contactPhone": "555-1234",
 *   "notes": "Use back entrance"
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate request body
    const validatedData = createLocationSchema.parse(body);
    
    const location = await locationController.createLocation(validatedData);

    return NextResponse.json({
      success: true,
      data: location,
      message: 'Location created successfully'
    }, { status: 201 });
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

    const apiError = handleApiError(error);
    return NextResponse.json(
      { success: false, error: apiError },
      { status: apiError.statusCode }
    );
  }
} 