import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { LocationController } from '@/lib/controllers/locationController';
import { handleApiError } from '@/lib/utils';
import prisma from '@/lib/db';

const locationController = new LocationController(prisma);

// Validation schema for marking box changes
const markBoxChangeSchema = z.object({
  changedBy: z.string().optional(),
  notes: z.string().optional(),
  boxCount: z.number().int().positive().optional(),
});

/**
 * POST /api/locations/[id]/mark-changed
 * Mark boxes as changed at a location (THE CORE FEATURE!)
 * 
 * This is the endpoint your mobile app calls when a charity worker
 * hits the "Mark as Changed" button.
 * 
 * What it does:
 * 1. Resets lastBoxChange to NOW 
 * 2. Sets elapsedDays to 0
 * 3. Changes status to 'fresh'
 * 4. Updates lastChangeFormatted to 'Today'
 * 5. Creates a history record in BoxChange table
 * 
 * Body (all optional):
 * {
 *   "changedBy": "John Worker",
 *   "notes": "Restocked with 50 candy boxes",
 *   "boxCount": 50
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    
    // Validate request body (all fields optional)
    const validatedData = markBoxChangeSchema.parse(body);
    
    // This is the magic function that resets the timer!
    const location = await locationController.markBoxesChanged(params.id, validatedData);

    return NextResponse.json({
      success: true,
      data: location,
      message: 'Boxes marked as changed successfully! Timer reset to today.'
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

    const apiError = handleApiError(error);
    return NextResponse.json(
      { success: false, error: apiError },
      { status: apiError.statusCode }
    );
  }
} 