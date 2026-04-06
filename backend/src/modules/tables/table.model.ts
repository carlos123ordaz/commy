import mongoose, { Schema, Document, Model } from 'mongoose';
import { TABLE_STATUSES } from '../../config/constants';

type TableStatus = (typeof TABLE_STATUSES)[number];

export type TableShape = 'rect' | 'rounded' | 'circle';

export interface ITableLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shape: TableShape;
}

export interface ITable extends Document {
  _id: mongoose.Types.ObjectId;
  restaurant: mongoose.Types.ObjectId;
  name: string;
  number?: number;
  capacity: number;
  zone?: string;
  status: TableStatus;
  qrCode: string;
  qrUrl: string;
  isActive: boolean;
  layout?: ITableLayout;
  createdAt: Date;
  updatedAt: Date;
}

const tableLayoutSchema = new Schema<ITableLayout>(
  {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 120 },
    height: { type: Number, default: 90 },
    rotation: { type: Number, default: 0 },
    shape: { type: String, enum: ['rect', 'rounded', 'circle'], default: 'rounded' },
  },
  { _id: false }
);

const tableSchema = new Schema<ITable>(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true },
    name: { type: String, required: true, trim: true },
    number: { type: Number },
    capacity: { type: Number, default: 4, min: 1 },
    zone: { type: String, trim: true },
    status: { type: String, enum: TABLE_STATUSES, default: 'free' },
    qrCode: { type: String, required: true },
    qrUrl: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    layout: { type: tableLayoutSchema },
  },
  { timestamps: true }
);

tableSchema.index({ restaurant: 1, status: 1 });
tableSchema.index({ qrCode: 1 }, { unique: true });
tableSchema.index({ restaurant: 1, isActive: 1 });

export const TableModel: Model<ITable> = mongoose.model<ITable>('Table', tableSchema);
