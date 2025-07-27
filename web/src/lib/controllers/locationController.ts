import { PrismaClient } from '@prisma/client';
import { 
  CreateLocationRequest, 
  UpdateLocationRequest, 
  MarkBoxChangeRequest,
  LocationResponse,
  LocationWithBoxChanges,
  LocationAnalytics
} from '@/types';
import { calculateElapsedDays, getLocationStatus, isValidCoordinates } from '@/lib/utils';

export class LocationController {
  constructor(private prisma: PrismaClient) {}

  /**
   * Get all locations with elapsed days information
   */
  async getAllLocations(): Promise<LocationResponse[]> {
    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      include: {
        boxChanges: {
          orderBy: { changedAt: 'desc' },
          take: 1 // Get most recent box change
        }
      },
      orderBy: { name: 'asc' }
    });

    return locations.map(location => {
      const elapsedInfo = calculateElapsedDays(location.lastBoxChange);
      return {
        ...location,
        elapsedDays: elapsedInfo.days,
        status: elapsedInfo.status,
        lastChangeFormatted: elapsedInfo.formatted
      };
    });
  }

  /**
   * Get locations that are overdue (> 7 days since last change)
   */
  async getOverdueLocations(): Promise<LocationResponse[]> {
    const allLocations = await this.getAllLocations();
    return allLocations.filter(location => location.status === 'overdue');
  }

  /**
   * Get a single location by ID with full box change history
   */
  async getLocationById(id: string): Promise<LocationWithBoxChanges | null> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        boxChanges: {
          orderBy: { changedAt: 'desc' },
          take: 10 // Get last 10 box changes for history
        }
      }
    });

    if (!location) return null;

    const elapsedInfo = calculateElapsedDays(location.lastBoxChange);
    
    return {
      ...location,
      elapsedDays: elapsedInfo.days,
      status: elapsedInfo.status
    };
  }

  /**
   * Create a new location
   */
  async createLocation(data: CreateLocationRequest): Promise<LocationResponse> {
    // Validate GPS coordinates
    if (!isValidCoordinates(data.latitude, data.longitude)) {
      throw new Error('Invalid GPS coordinates provided');
    }

    const location = await this.prisma.location.create({
      data: {
        ...data,
        lastBoxChange: new Date() // Set initial box change to now (fresh start)
      }
    });

    const elapsedInfo = calculateElapsedDays(location.lastBoxChange);
    
    return {
      ...location,
      elapsedDays: elapsedInfo.days,
      status: elapsedInfo.status,
      lastChangeFormatted: elapsedInfo.formatted
    };
  }

  /**
   * Update an existing location
   */
  async updateLocation(id: string, data: UpdateLocationRequest): Promise<LocationResponse> {
    // Validate GPS coordinates if provided
    if (data.latitude !== undefined && data.longitude !== undefined) {
      if (!isValidCoordinates(data.latitude, data.longitude)) {
        throw new Error('Invalid GPS coordinates provided');
      }
    }

    const location = await this.prisma.location.update({
      where: { id },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });

    const elapsedInfo = calculateElapsedDays(location.lastBoxChange);
    
    return {
      ...location,
      elapsedDays: elapsedInfo.days,
      status: elapsedInfo.status,
      lastChangeFormatted: elapsedInfo.formatted
    };
  }

  /**
   * Mark boxes as changed at a location (THE KEY FEATURE!)
   */
  async markBoxesChanged(id: string, data: MarkBoxChangeRequest = {}): Promise<LocationResponse> {
    const now = new Date();

    // Update location's lastBoxChange AND create a history record
    const [location] = await this.prisma.$transaction([
      // Update the location's timer
      this.prisma.location.update({
        where: { id },
        data: {
          lastBoxChange: now, // Reset the timer to NOW
          updatedAt: now
        }
      }),
      // Create a history record
      this.prisma.boxChange.create({
        data: {
          locationId: id,
          changedAt: now,
          changedBy: data.changedBy,
          notes: data.notes,
          boxCount: data.boxCount
        }
      })
    ]);

    const elapsedInfo = calculateElapsedDays(location.lastBoxChange);
    
    return {
      ...location,
      elapsedDays: elapsedInfo.days, // Should be 0 (just changed)
      status: elapsedInfo.status,    // Should be 'fresh' 
      lastChangeFormatted: elapsedInfo.formatted // Should be 'Today'
    };
  }

  /**
   * Batch mark multiple locations as changed (for efficiency)
   */
  async batchMarkBoxesChanged(
    locationIds: string[], 
    data: MarkBoxChangeRequest = {}
  ): Promise<LocationResponse[]> {
    const now = new Date();

    // Update all locations and create box change records in one transaction
    await this.prisma.$transaction([
      // Update all location timers
      this.prisma.location.updateMany({
        where: { id: { in: locationIds } },
        data: {
          lastBoxChange: now,
          updatedAt: now
        }
      }),
      // Create history records for all
      this.prisma.boxChange.createMany({
        data: locationIds.map(locationId => ({
          locationId,
          changedAt: now,
          changedBy: data.changedBy,
          notes: data.notes,
          boxCount: data.boxCount
        }))
      })
    ]);

    // Return updated locations
    const locations = await this.prisma.location.findMany({
      where: { id: { in: locationIds } }
    });

    return locations.map(location => {
      const elapsedInfo = calculateElapsedDays(location.lastBoxChange);
      return {
        ...location,
        elapsedDays: elapsedInfo.days,
        status: elapsedInfo.status,
        lastChangeFormatted: elapsedInfo.formatted
      };
    });
  }

  /**
   * Delete a location (soft delete - mark as inactive)
   */
  async deleteLocation(id: string): Promise<void> {
    await this.prisma.location.update({
      where: { id },
      data: {
        isActive: false,
        updatedAt: new Date()
      }
    });
  }

  /**
   * Get analytics for dashboard
   */
  async getLocationAnalytics(): Promise<LocationAnalytics> {
    const locations = await this.getAllLocations();
    
    const totalLocations = locations.length;
    const activeLocations = locations.filter(l => l.isActive).length;
    const freshCount = locations.filter(l => l.status === 'fresh').length;
    const overdueCount = locations.filter(l => l.status === 'overdue').length;

    // Calculate average days between changes
    const boxChanges = await this.prisma.boxChange.findMany({
      orderBy: { changedAt: 'asc' }
    });

    let totalDaysBetweenChanges = 0;
    let changeIntervals = 0;

    // Group box changes by location
    const changesByLocation = boxChanges.reduce((acc, change) => {
      if (!acc[change.locationId]) acc[change.locationId] = [];
      acc[change.locationId].push(change.changedAt);
      return acc;
    }, {} as Record<string, Date[]>);

    // Calculate intervals between changes
    for (const locationId in changesByLocation) {
      const dates = changesByLocation[locationId];
      for (let i = 1; i < dates.length; i++) {
        const daysDiff = (dates[i].getTime() - dates[i-1].getTime()) / (1000 * 60 * 60 * 24);
        totalDaysBetweenChanges += daysDiff;
        changeIntervals++;
      }
    }

    const averageDaysBetweenChanges = changeIntervals > 0 
      ? Math.round(totalDaysBetweenChanges / changeIntervals) 
      : 0;

    return {
      totalLocations,
      activeLocations,
      freshCount,
      warningCount: 0, // We simplified to just fresh/overdue
      overdueCount,
      averageDaysBetweenChanges
    };
  }
} 