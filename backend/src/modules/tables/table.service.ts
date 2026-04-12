import { v4 as uuidv4 } from 'uuid';
import { TableModel, ITable } from './table.model';
import { CreateTableInput, UpdateTableInput } from './table.validators';
import { NotFoundError } from '../../common/errors/AppError';
import { generateQRDataURL } from '../../utils/qrcode.utils';
import { generateQRPDF, QRTableData } from '../../utils/pdf.utils';
import { env } from '../../config/env';
import { sortTablesByDisplayOrder } from './table.sort';

export class TableService {
  private buildQrUrl(qrCode: string): string {
    return `${env.CUSTOMER_APP_URL}/mesa/${qrCode}`;
  }

  async create(restaurantId: string, data: CreateTableInput): Promise<ITable> {
    const qrCode = uuidv4();
    const qrUrl = this.buildQrUrl(qrCode);
    const table = await TableModel.create({
      restaurant: restaurantId,
      name: data.name,
      number: data.number,
      capacity: data.capacity,
      zone: data.zone,
      qrCode,
      qrUrl,
    });
    return table;
  }

  async findAll(restaurantId: string, zone?: string) {
    const query: Record<string, unknown> = { restaurant: restaurantId, isActive: true };
    if (zone) query.zone = zone;
    const tables = await TableModel.find(query).lean();
    return sortTablesByDisplayOrder(tables);
  }

  async findById(id: string, restaurantId: string) {
    const table = await TableModel.findOne({ _id: id, restaurant: restaurantId });
    if (!table) throw new NotFoundError('Table');
    return table;
  }

  async findByToken(qrCode: string) {
    const table = await TableModel.findOne({ qrCode, isActive: true }).populate('restaurant', 'name slug logo settings');
    if (!table) throw new NotFoundError('Table');
    return table;
  }

  async update(id: string, restaurantId: string, data: UpdateTableInput) {
    const table = await TableModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { $set: data },
      { new: true }
    );
    if (!table) throw new NotFoundError('Table');
    return table;
  }

  async delete(id: string, restaurantId: string) {
    const table = await TableModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { isActive: false },
      { new: true }
    );
    if (!table) throw new NotFoundError('Table');
    return table;
  }

  async regenerateQr(id: string, restaurantId: string) {
    const qrCode = uuidv4();
    const qrUrl = this.buildQrUrl(qrCode);
    const table = await TableModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { qrCode, qrUrl },
      { new: true }
    );
    if (!table) throw new NotFoundError('Table');
    return table;
  }

  async getQrDataUrl(id: string, restaurantId: string) {
    const table = await this.findById(id, restaurantId);
    const dataUrl = await generateQRDataURL(table.qrUrl);
    return { table, qrDataUrl: dataUrl };
  }

  async exportToPdf(tableIds: string[], restaurantId: string) {
    const tables = await TableModel.find({
      _id: { $in: tableIds },
      restaurant: restaurantId,
      isActive: true,
    }).populate('restaurant', 'name');

    const qrData: QRTableData[] = tables.map((t) => ({
      tableName: t.name,
      qrUrl: t.qrUrl,
      restaurantName: (t.restaurant as unknown as { name: string }).name || 'Commy',
      zone: t.zone,
    }));

    return generateQRPDF(qrData);
  }

  async exportAllToPdf(restaurantId: string) {
    const tables = await TableModel.find({ restaurant: restaurantId, isActive: true })
      .populate('restaurant', 'name')
      .lean();

    const sortedTables = sortTablesByDisplayOrder(tables);

    const qrData: QRTableData[] = sortedTables.map((t) => ({
      tableName: t.name,
      qrUrl: t.qrUrl,
      restaurantName: (t.restaurant as unknown as { name: string }).name || 'Commy',
      zone: t.zone,
    }));

    return generateQRPDF(qrData);
  }

  async updateStatus(id: string, restaurantId: string, status: string) {
    return TableModel.findOneAndUpdate(
      { _id: id, restaurant: restaurantId },
      { status },
      { new: true }
    );
  }
}

export const tableService = new TableService();
