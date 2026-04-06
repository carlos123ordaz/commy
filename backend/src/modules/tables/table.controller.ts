import { Response, NextFunction, Request } from 'express';
import { AuthRequest } from '../../common/types';
import { ApiResponse } from '../../common/response/ApiResponse';
import { tableService } from './table.service';

export class TableController {
  async create(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await tableService.create(req.user!.restaurantId!, req.body);
      ApiResponse.created(res, table, 'Table created');
    } catch (e) { next(e); }
  }

  async findAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tables = await tableService.findAll(req.user!.restaurantId!, req.query.zone as string);
      ApiResponse.success(res, tables);
    } catch (e) { next(e); }
  }

  async findById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await tableService.findById(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, table);
    } catch (e) { next(e); }
  }

  async findByToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await tableService.findByToken(req.params.token);
      ApiResponse.success(res, table);
    } catch (e) { next(e); }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await tableService.update(req.params.id, req.user!.restaurantId!, req.body);
      ApiResponse.success(res, table, 'Table updated');
    } catch (e) { next(e); }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await tableService.delete(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, null, 'Table deleted');
    } catch (e) { next(e); }
  }

  async getQr(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await tableService.getQrDataUrl(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, result);
    } catch (e) { next(e); }
  }

  async regenerateQr(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const table = await tableService.regenerateQr(req.params.id, req.user!.restaurantId!);
      ApiResponse.success(res, table, 'QR regenerated');
    } catch (e) { next(e); }
  }

  async exportPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { tableIds } = req.body as { tableIds: string[] };
      const pdf = await tableService.exportToPdf(tableIds, req.user!.restaurantId!);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="qr-codes.pdf"',
      });
      res.send(pdf);
    } catch (e) { next(e); }
  }

  async exportAllPdf(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const pdf = await tableService.exportAllToPdf(req.user!.restaurantId!);
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="all-qr-codes.pdf"',
      });
      res.send(pdf);
    } catch (e) { next(e); }
  }
}

export const tableController = new TableController();
