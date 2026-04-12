import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse } from '../../common/response/ApiResponse';
import { TableModel } from '../tables/table.model';
import { RestaurantLayoutModel, IFloorDecoration, IZoneLayout } from './floorPlan.model';
import { getIO } from '../../sockets';
import { sortTablesByDisplayOrder } from '../tables/table.sort';

interface TablePositionInput {
  tableId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: 'rect' | 'rounded' | 'circle';
}

interface SaveLayoutBody {
  tablePositions: TablePositionInput[];
  layout: {
    background: string;
    zoneLayouts: {
      zoneName: string;
      canvasWidth: number;
      canvasHeight: number;
      decorations: IFloorDecoration[];
    }[];
  };
}

export class FloorPlanController {
  async getLayout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId!;

      const [tables, layout] = await Promise.all([
        TableModel.find({ restaurant: restaurantId, isActive: true })
          .lean(),
        RestaurantLayoutModel.findOne({ restaurant: restaurantId }).lean(),
      ]);

      const sortedTables = sortTablesByDisplayOrder(tables);

      // Derive zone names from tables (fallback when no layout exists yet)
      const tableZones = [...new Set(sortedTables.map((t) => t.zone).filter(Boolean) as string[])];

      const defaultZoneLayouts: IZoneLayout[] = tableZones.map((z) => ({
        zoneName: z,
        canvasWidth: 1000,
        canvasHeight: 700,
        decorations: [],
      }));

      ApiResponse.success(res, {
        tables: sortedTables,
        layout: {
          background: layout?.background ?? 'default',
          zoneLayouts:
            layout?.zoneLayouts?.length
              ? layout.zoneLayouts
              : defaultZoneLayouts,
        },
      });
    } catch (e) {
      next(e);
    }
  }

  async saveLayout(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const restaurantId = req.user!.restaurantId!;
      const { tablePositions, layout } = req.body as SaveLayoutBody;

      // Bulk update table layout positions
      if (Array.isArray(tablePositions) && tablePositions.length > 0) {
        const bulkOps = tablePositions.map((pos) => ({
          updateOne: {
            filter: { _id: pos.tableId, restaurant: restaurantId },
            update: {
              $set: {
                layout: {
                  x: pos.x,
                  y: pos.y,
                  width: pos.width,
                  height: pos.height,
                  rotation: pos.rotation ?? 0,
                  shape: pos.shape ?? 'rounded',
                },
              },
            },
          },
        }));
        await TableModel.bulkWrite(bulkOps);
      }

      // Upsert layout config
      const savedLayout = await RestaurantLayoutModel.findOneAndUpdate(
        { restaurant: restaurantId },
        {
          $set: {
            restaurant: restaurantId,
            background: layout?.background ?? 'default',
            zoneLayouts: layout?.zoneLayouts ?? [],
          },
        },
        { upsert: true, new: true }
      );

      try {
        const io = getIO();
        io.of('/staff').to(`restaurant:${restaurantId}`).emit('floor_plan:updated', {
          restaurantId,
          updatedAt: new Date().toISOString(),
        });
      } catch {
        // Socket not critical
      }

      ApiResponse.success(res, savedLayout, 'Floor plan saved');
    } catch (e) {
      next(e);
    }
  }
}

export const floorPlanController = new FloorPlanController();
