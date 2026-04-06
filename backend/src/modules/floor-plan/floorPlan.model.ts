import mongoose, { Schema, Document, Model } from 'mongoose';

export type DecorationItemType = 'bar' | 'wall' | 'entrance' | 'label' | 'plant';

export interface IFloorZone {
  id: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  zIndex: number;
}

export interface IFloorDecoration {
  id: string;
  type: DecorationItemType;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  color?: string;
  zIndex: number;
}

export interface IRestaurantLayout extends Document {
  restaurant: mongoose.Types.ObjectId;
  background: string;
  zoneLayouts: IZoneLayout[];
  // legacy
  canvasWidth: number;
  canvasHeight: number;
  zones: IFloorZone[];
  decorations: IFloorDecoration[];
  createdAt: Date;
  updatedAt: Date;
}

const floorZoneSchema = new Schema<IFloorZone>(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    color: { type: String, default: '#334155' },
    zIndex: { type: Number, default: 0 },
  },
  { _id: false }
);

const floorDecorationSchema = new Schema<IFloorDecoration>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['bar', 'wall', 'entrance', 'label', 'plant'], required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    label: { type: String },
    color: { type: String },
    zIndex: { type: Number, default: 1 },
  },
  { _id: false }
);

export interface IZoneLayout {
  zoneName: string;          // matches Table.zone value (or 'general' for unzoned tables)
  canvasWidth: number;
  canvasHeight: number;
  decorations: IFloorDecoration[];
}

const zoneLayoutSchema = new Schema<IZoneLayout>(
  {
    zoneName: { type: String, required: true },
    canvasWidth: { type: Number, default: 1000 },
    canvasHeight: { type: Number, default: 700 },
    decorations: [floorDecorationSchema],
  },
  { _id: false }
);

const restaurantLayoutSchema = new Schema<IRestaurantLayout>(
  {
    restaurant: { type: Schema.Types.ObjectId, ref: 'Restaurant', required: true, unique: true },
    background: { type: String, default: 'default' },
    zoneLayouts: [zoneLayoutSchema],
    // legacy fields kept for backward compat (ignored by new code)
    canvasWidth: { type: Number, default: 1400 },
    canvasHeight: { type: Number, default: 900 },
    zones: [floorZoneSchema],
    decorations: [floorDecorationSchema],
  },
  { timestamps: true }
);

export const RestaurantLayoutModel: Model<IRestaurantLayout> = mongoose.model<IRestaurantLayout>(
  'RestaurantLayout',
  restaurantLayoutSchema
);
