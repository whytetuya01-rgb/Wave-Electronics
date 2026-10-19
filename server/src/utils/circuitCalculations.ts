import { ICircuitBomItem } from '../models/Circuit.js';
import { Component } from '../models/Component.js';

export interface BomLineAvailability {
  componentId: string;
  partCode: string;
  name: string;
  isActive: boolean;
  qtyPerUnit: number;
  designator?: string;
  remarks?: string;
  ratePerUnit: number;
  lineCost: number;
  inStoreStock: number;
  reservedStock: number;
  availableStock: number;
  buildableQty: number;
}

export interface CircuitAvailabilityResult {
  materialCostPerUnit: number;
  maxBuildableQty: number;
  bottleneckComponentId: string | null;
  lines: BomLineAvailability[];
}

// Computes the authoritative material cost and maximum buildable quantity for
// a circuit's BOM from live component stock/rate data. This is the single
// source of truth used by the circuit list, detail view, and the dedicated
// availability endpoint - the frontend never submits or is trusted for these
// numbers.
//
// Available stock = in-store stock - reserved stock. Stock currently with a
// vendor is deliberately excluded (it isn't available to start a new job).
// A missing or deactivated component is treated as zero available stock
// rather than thrown, since this is a read path surfacing a data problem,
// not a write path that should reject - the API response still flags it via
// `isActive: false` so the UI can warn the user.
export async function computeCircuitAvailability(
  bomItems: ICircuitBomItem[]
): Promise<CircuitAvailabilityResult> {
  if (!bomItems || bomItems.length === 0) {
    return { materialCostPerUnit: 0, maxBuildableQty: 0, bottleneckComponentId: null, lines: [] };
  }

  const componentIds = bomItems.map((item) => item.componentId);
  const components = await Component.find({ _id: { $in: componentIds } });
  const componentMap = new Map(components.map((c) => [c._id.toString(), c]));

  let materialCostPerUnit = 0;
  let maxBuildableQty = Infinity;
  let bottleneckComponentId: string | null = null;

  const lines: BomLineAvailability[] = bomItems.map((item) => {
    const idStr = item.componentId.toString();
    const component = componentMap.get(idStr);

    const ratePerUnit = component?.ratePerUnit || 0;
    const lineCost = Number((ratePerUnit * item.qtyPerUnit).toFixed(2));
    materialCostPerUnit += lineCost;

    const isActive = Boolean(component?.isActive);
    const inStoreStock = component?.inStoreStock || 0;
    const reservedStock = component?.reservedStock || 0;
    const availableStock = isActive ? Math.max(0, inStoreStock - reservedStock) : 0;
    const buildableQty = item.qtyPerUnit > 0 ? Math.floor(availableStock / item.qtyPerUnit) : 0;

    if (buildableQty < maxBuildableQty) {
      maxBuildableQty = buildableQty;
      bottleneckComponentId = idStr;
    }

    return {
      componentId: idStr,
      partCode: component?.partCode || 'UNKNOWN',
      name: component?.name || 'Component no longer exists',
      isActive,
      qtyPerUnit: item.qtyPerUnit,
      designator: item.designator,
      remarks: item.remarks,
      ratePerUnit,
      lineCost,
      inStoreStock,
      reservedStock,
      availableStock,
      buildableQty,
    };
  });

  return {
    materialCostPerUnit: Number(materialCostPerUnit.toFixed(2)),
    maxBuildableQty: maxBuildableQty === Infinity ? 0 : maxBuildableQty,
    bottleneckComponentId,
    lines,
  };
}
