'use server';

import { sqlite } from '@/db';
import { requirePermission, getCurrentUserRole, getCurrentUser, isHospitalManager, isDoctor } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import {
  HospitalAssetItem,
  HospitalAssetCategory,
  AssetMaintenanceStatus,
  HospitalServiceLog,
  HospitalProcurementOrder,
  HospitalDepartmentDispatch,
  ProcurementOrderItem,
} from '@/types';

export interface ManagerDashboardStats {
  totalAssets: number;
  surgicalInstrumentsCount: number;
  cleaningAgentsCount: number;
  toiletriesCount: number;
  linenBedsheetsCount: number;
  lowStockCount: number;
  maintenanceAlertsCount: number;
  pendingProcurementOrders: number;
}

/**
 * Retrieves hospital assets filtered by category, search term, or low stock.
 */
export async function getHospitalAssets(params?: {
  search?: string;
  category?: HospitalAssetCategory | 'ALL';
  filter?: 'all' | 'low_stock' | 'maintenance_due';
}): Promise<{
  assets: HospitalAssetItem[];
  stats: ManagerDashboardStats;
}> {
  await requirePermission('manager:assets', '/manager');

  try {
    let sql = 'SELECT * FROM hospital_assets WHERE 1=1';
    const queryParams: (string | number)[] = [];

    if (params?.search && params.search.trim()) {
      sql += ' AND (name LIKE ? OR specification LIKE ? OR location LIKE ?)';
      const s = `%${params.search.trim()}%`;
      queryParams.push(s, s, s);
    }

    if (params?.category && params.category !== 'ALL') {
      sql += ' AND category = ?';
      queryParams.push(params.category);
    }

    const todayStr = new Date().toISOString().split('T')[0];

    if (params?.filter === 'low_stock') {
      sql += ' AND quantity_in_stock <= min_threshold';
    } else if (params?.filter === 'maintenance_due') {
      sql += " AND (maintenance_status IN ('CALIBRATION_DUE', 'UNDER_MAINTENANCE') OR (next_service_due IS NOT NULL AND next_service_due <= ?))";
      queryParams.push(todayStr);
    }

    sql += ' ORDER BY (quantity_in_stock <= min_threshold) DESC, name ASC';

    const rawRows = sqlite.prepare(sql).all(...queryParams) as {
      id: number;
      name: string;
      category: string;
      specification?: string | null;
      quantity_in_stock: number;
      unit: string;
      min_threshold: number;
      location?: string | null;
      purchase_cost: number;
      supplier_name?: string | null;
      maintenance_status: string;
      last_service_date?: string | null;
      next_service_due?: string | null;
      service_vendor?: string | null;
      service_vendor_phone?: string | null;
      created_at?: number | null;
      updated_at?: number | null;
    }[];

    const assets: HospitalAssetItem[] = rawRows.map((r) => ({
      id: r.id,
      name: r.name,
      category: r.category as HospitalAssetCategory,
      specification: r.specification,
      quantityInStock: r.quantity_in_stock,
      unit: r.unit,
      minThreshold: r.min_threshold,
      location: r.location,
      purchaseCost: r.purchase_cost,
      supplierName: r.supplier_name,
      maintenanceStatus: r.maintenance_status as AssetMaintenanceStatus,
      lastServiceDate: r.last_service_date,
      nextServiceDue: r.next_service_due,
      serviceVendor: r.service_vendor,
      serviceVendorPhone: r.service_vendor_phone,
      createdAt: r.created_at ? new Date(r.created_at) : null,
      updatedAt: r.updated_at ? new Date(r.updated_at) : null,
    }));

    // Calculate manager summary metrics
    const all = sqlite.prepare('SELECT category, quantity_in_stock, min_threshold, maintenance_status, next_service_due FROM hospital_assets').all() as {
      category: string;
      quantity_in_stock: number;
      min_threshold: number;
      maintenance_status: string;
      next_service_due?: string | null;
    }[];

    let surgicalCount = 0;
    let cleaningCount = 0;
    let toiletriesCount = 0;
    let linenCount = 0;
    let lowStockCount = 0;
    let maintenanceAlerts = 0;

    for (const item of all) {
      if (item.category === 'SURGICAL_INSTRUMENT') surgicalCount++;
      else if (item.category === 'CLEANING_AGENT') cleaningCount++;
      else if (item.category === 'TOILETRIES') toiletriesCount++;
      else if (item.category === 'LINEN_BEDSHEET') linenCount++;

      if (item.quantity_in_stock <= item.min_threshold) {
        lowStockCount++;
      }
      if (
        item.maintenance_status === 'CALIBRATION_DUE' ||
        item.maintenance_status === 'UNDER_MAINTENANCE' ||
        (item.next_service_due && item.next_service_due <= todayStr)
      ) {
        maintenanceAlerts++;
      }
    }

    const pendingOrders = sqlite
      .prepare("SELECT COUNT(*) as count FROM hospital_procurement_orders WHERE status IN ('ORDERED', 'DRAFT')")
      .get() as { count: number } | undefined;

    return {
      assets,
      stats: {
        totalAssets: all.length,
        surgicalInstrumentsCount: surgicalCount,
        cleaningAgentsCount: cleaningCount,
        toiletriesCount: toiletriesCount,
        linenBedsheetsCount: linenCount,
        lowStockCount,
        maintenanceAlertsCount: maintenanceAlerts,
        pendingProcurementOrders: pendingOrders?.count || 0,
      },
    };
  } catch (err) {
    console.error('Failed to get hospital assets:', err);
    return {
      assets: [],
      stats: {
        totalAssets: 0,
        surgicalInstrumentsCount: 0,
        cleaningAgentsCount: 0,
        toiletriesCount: 0,
        linenBedsheetsCount: 0,
        lowStockCount: 0,
        maintenanceAlertsCount: 0,
        pendingProcurementOrders: 0,
      },
    };
  }
}

/**
 * Creates or updates a hospital asset / instrument / consumable item.
 */
export async function addOrUpdateHospitalAsset(data: {
  id?: number;
  name: string;
  category: HospitalAssetCategory;
  specification?: string;
  quantityInStock: number;
  unit: string;
  minThreshold: number;
  location?: string;
  purchaseCost: number;
  supplierName?: string;
  maintenanceStatus?: AssetMaintenanceStatus;
  lastServiceDate?: string;
  nextServiceDue?: string;
  serviceVendor?: string;
  serviceVendorPhone?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requirePermission('manager:assets', '/manager');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isHospitalManager(role) && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Manager or Admin authorization required.' };
  }

  const cleanName = (data.name || '').trim();
  if (!cleanName || cleanName.length > 250) {
    return { success: false, error: 'Valid asset / instrument name is required (max 250 characters).' };
  }

  const validQty = Math.max(0, Math.min(Number(data.quantityInStock) || 0, 1000000));
  const validThreshold = Math.max(0, Math.min(Number(data.minThreshold) || 5, 50000));
  const validCost = Math.max(0, Math.min(Number(data.purchaseCost) || 0, 10000000));
  const now = Date.now();

  try {
    if (data.id && data.id > 0) {
      sqlite
        .prepare(`
          UPDATE hospital_assets SET
            name = ?, category = ?, specification = ?, quantity_in_stock = ?,
            unit = ?, min_threshold = ?, location = ?, purchase_cost = ?,
            supplier_name = ?, maintenance_status = ?, last_service_date = ?,
            next_service_due = ?, service_vendor = ?, service_vendor_phone = ?,
            updated_at = ?
          WHERE id = ?
        `)
        .run(
          cleanName,
          data.category,
          data.specification?.trim() || null,
          validQty,
          (data.unit || 'units').trim(),
          validThreshold,
          data.location?.trim() || null,
          validCost,
          data.supplierName?.trim() || null,
          data.maintenanceStatus || 'OPERATIONAL',
          data.lastServiceDate?.trim() || null,
          data.nextServiceDue?.trim() || null,
          data.serviceVendor?.trim() || null,
          data.serviceVendorPhone?.trim() || null,
          now,
          data.id
        );

      await logAuditEvent({
        action: 'HOSPITAL_ASSET_UPDATED',
        actorRole: role.toUpperCase(),
        details: `Updated asset #${data.id}: ${cleanName} (${data.category}) - Qty: ${validQty} ${data.unit}`,
        status: 'SUCCESS',
      });

      revalidatePath('/manager');
      return { success: true, id: data.id };
    } else {
      const res = sqlite
        .prepare(`
          INSERT INTO hospital_assets (
            name, category, specification, quantity_in_stock, unit, min_threshold,
            location, purchase_cost, supplier_name, maintenance_status,
            last_service_date, next_service_due, service_vendor, service_vendor_phone,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          cleanName,
          data.category,
          data.specification?.trim() || null,
          validQty,
          (data.unit || 'units').trim(),
          validThreshold,
          data.location?.trim() || null,
          validCost,
          data.supplierName?.trim() || null,
          data.maintenanceStatus || 'OPERATIONAL',
          data.lastServiceDate?.trim() || null,
          data.nextServiceDue?.trim() || null,
          data.serviceVendor?.trim() || null,
          data.serviceVendorPhone?.trim() || null,
          now,
          now
        );

      const insertedId = Number(res.lastInsertRowid);

      await logAuditEvent({
        action: 'HOSPITAL_ASSET_ADDED',
        actorRole: role.toUpperCase(),
        details: `Added new hospital asset: ${cleanName} (${data.category}) - Qty: ${validQty} ${data.unit} by ${user?.name || role}`,
        status: 'SUCCESS',
      });

      revalidatePath('/manager');
      return { success: true, id: insertedId };
    }
  } catch (err: unknown) {
    console.error('Failed to save hospital asset:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Logs instrument maintenance, calibration, sharpening, or servicing.
 * Automatically updates the asset's last service date and status.
 */
export async function logAssetServiceMaintenance(data: {
  assetId: number;
  serviceDate: string;
  serviceType: 'PREVENTIVE' | 'BREAKDOWN' | 'CALIBRATION' | 'AMC_VISIT' | 'SHARPENING';
  technicianName?: string;
  vendorName?: string;
  cost?: number;
  workDescription: string;
  partsReplaced?: string;
  nextDueDate?: string;
  newAssetStatus?: AssetMaintenanceStatus;
}): Promise<{ success: boolean; logId?: number; error?: string }> {
  await requirePermission('manager:maintenance', '/manager');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isHospitalManager(role) && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Manager or Admin authorization required.' };
  }

  const cleanDesc = (data.workDescription || '').trim();
  if (!cleanDesc) {
    return { success: false, error: 'Work description is required.' };
  }

  try {
    const now = Date.now();
    const res = sqlite
      .prepare(`
        INSERT INTO hospital_service_logs (
          asset_id, service_date, service_type, technician_name, vendor_name,
          cost, work_description, parts_replaced, next_due_date, status,
          logged_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'COMPLETED', ?, ?)
      `)
      .run(
        data.assetId,
        data.serviceDate,
        data.serviceType,
        data.technicianName?.trim() || null,
        data.vendorName?.trim() || null,
        Math.max(0, Number(data.cost) || 0),
        cleanDesc,
        data.partsReplaced?.trim() || null,
        data.nextDueDate?.trim() || null,
        user?.name || role,
        now
      );

    const logId = Number(res.lastInsertRowid);

    // Update parent asset service dates and status
    const newStatus = data.newAssetStatus || 'OPERATIONAL';
    sqlite
      .prepare(`
        UPDATE hospital_assets SET
          last_service_date = ?,
          next_service_due = COALESCE(?, next_service_due),
          maintenance_status = ?,
          service_vendor = COALESCE(?, service_vendor),
          updated_at = ?
        WHERE id = ?
      `)
      .run(data.serviceDate, data.nextDueDate?.trim() || null, newStatus, data.vendorName?.trim() || null, now, data.assetId);

    await logAuditEvent({
      action: 'HOSPITAL_SERVICE_LOGGED',
      actorRole: role.toUpperCase(),
      details: `Service logged for Asset #${data.assetId} (${data.serviceType}): ${cleanDesc}`,
      status: 'SUCCESS',
    });

    revalidatePath('/manager');
    return { success: true, logId };
  } catch (err: unknown) {
    console.error('Failed to log service maintenance:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Creates a hospital purchase order / requisition for consumables or instruments.
 */
export async function createProcurementOrder(data: {
  vendorName: string;
  category: HospitalAssetCategory;
  items: ProcurementOrderItem[];
  expectedDeliveryDate?: string;
  notes?: string;
}): Promise<{ success: boolean; orderId?: number; orderNo?: string; error?: string }> {
  await requirePermission('manager:purchase', '/manager');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isHospitalManager(role) && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Manager or Admin authorization required.' };
  }

  const cleanVendor = (data.vendorName || '').trim();
  if (!cleanVendor) {
    return { success: false, error: 'Vendor / Supplier name is required.' };
  }

  if (!data.items || data.items.length === 0) {
    return { success: false, error: 'At least one item must be included in the purchase order.' };
  }

  try {
    const now = Date.now();
    const orderNo = `PO-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const totalAmount = data.items.reduce((sum, it) => sum + (Number(it.total) || Number(it.quantity) * Number(it.unitPrice) || 0), 0);
    const todayStr = new Date().toISOString().split('T')[0];

    const res = sqlite
      .prepare(`
        INSERT INTO hospital_procurement_orders (
          order_no, vendor_name, category, items_json, total_amount,
          order_date, expected_delivery_date, status, ordered_by, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ORDERED', ?, ?, ?)
      `)
      .run(
        orderNo,
        cleanVendor,
        data.category,
        JSON.stringify(data.items),
        totalAmount,
        todayStr,
        data.expectedDeliveryDate?.trim() || null,
        user?.name || role,
        data.notes?.trim() || null,
        now
      );

    const orderId = Number(res.lastInsertRowid);

    await logAuditEvent({
      action: 'PROCUREMENT_ORDER_CREATED',
      actorRole: role.toUpperCase(),
      details: `Purchase Order ${orderNo} created for ${cleanVendor} (${data.items.length} items, Total: ₹${totalAmount})`,
      status: 'SUCCESS',
    });

    revalidatePath('/manager');
    return { success: true, orderId, orderNo };
  } catch (err: unknown) {
    console.error('Failed to create procurement order:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Receives a procurement order and automatically increments corresponding asset stock quantities.
 */
export async function receiveProcurementOrder(orderId: number): Promise<{ success: boolean; error?: string }> {
  await requirePermission('manager:purchase', '/manager');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  try {
    const order = sqlite
      .prepare('SELECT * FROM hospital_procurement_orders WHERE id = ?')
      .get(orderId) as { id: number; order_no: string; items_json: string; status: string } | undefined;

    if (!order) {
      return { success: false, error: 'Purchase order not found.' };
    }

    if (order.status === 'RECEIVED') {
      return { success: false, error: 'Purchase order has already been received.' };
    }

    const items: ProcurementOrderItem[] = JSON.parse(order.items_json || '[]');
    const todayStr = new Date().toISOString().split('T')[0];
    const now = Date.now();

    // Increment or create assets in stock
    for (const item of items) {
      const existing = sqlite
        .prepare('SELECT id, quantity_in_stock FROM hospital_assets WHERE name LIKE ? LIMIT 1')
        .get(item.name.trim()) as { id: number; quantity_in_stock: number } | undefined;

      if (existing) {
        sqlite
          .prepare('UPDATE hospital_assets SET quantity_in_stock = quantity_in_stock + ?, updated_at = ? WHERE id = ?')
          .run(item.quantity, now, existing.id);
      } else {
        sqlite
          .prepare(`
            INSERT INTO hospital_assets (
              name, category, quantity_in_stock, unit, purchase_cost, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `)
          .run(item.name.trim(), item.category || 'GENERAL_CONSUMABLE', item.quantity, item.unit || 'units', item.unitPrice || 0, now, now);
      }
    }

    sqlite
      .prepare("UPDATE hospital_procurement_orders SET status = 'RECEIVED', received_date = ? WHERE id = ?")
      .run(todayStr, orderId);

    await logAuditEvent({
      action: 'PROCUREMENT_ORDER_RECEIVED',
      actorRole: role.toUpperCase(),
      details: `Purchase Order ${order.order_no} marked RECEIVED by ${user?.name || role}. Stock quantities auto-incremented.`,
      status: 'SUCCESS',
    });

    revalidatePath('/manager');
    return { success: true };
  } catch (err: unknown) {
    console.error('Failed to receive procurement order:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Dispatches stock (cleaning agents, toiletries, bedsheets, instruments) to a hospital department.
 * Automatically decrements available stock and records recipient sign-off.
 */
export async function dispatchToDepartment(data: {
  assetId: number;
  quantity: number;
  targetDepartment: string;
  recipientStaff: string;
  remarks?: string;
}): Promise<{ success: boolean; dispatchNo?: string; error?: string }> {
  await requirePermission('manager:dispatch', '/manager');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isHospitalManager(role) && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Manager or Admin authorization required.' };
  }

  const cleanRecipient = (data.recipientStaff || '').trim();
  if (!cleanRecipient) {
    return { success: false, error: 'Recipient staff name is required for department dispatch sign-off.' };
  }

  const qty = Math.max(1, Number(data.quantity) || 1);

  try {
    const asset = sqlite
      .prepare('SELECT id, name, category, quantity_in_stock, unit FROM hospital_assets WHERE id = ?')
      .get(data.assetId) as { id: number; name: string; category: string; quantity_in_stock: number; unit: string } | undefined;

    if (!asset) {
      return { success: false, error: 'Hospital asset not found.' };
    }

    if (asset.quantity_in_stock < qty) {
      return {
        success: false,
        error: `Insufficient stock! Current available stock is ${asset.quantity_in_stock} ${asset.unit}, cannot dispatch ${qty}.`,
      };
    }

    const now = Date.now();
    const todayStr = new Date().toISOString().split('T')[0];
    const dispatchNo = `DSP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 1. Record dispatch log
    sqlite
      .prepare(`
        INSERT INTO hospital_department_dispatches (
          dispatch_no, asset_id, asset_name, category, quantity, unit,
          target_department, recipient_staff, dispatched_by, dispatch_date,
          remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        dispatchNo,
        asset.id,
        asset.name,
        asset.category,
        qty,
        asset.unit,
        data.targetDepartment,
        cleanRecipient,
        user?.name || role,
        todayStr,
        data.remarks?.trim() || null,
        now
      );

    // 2. Decrement asset stock
    sqlite
      .prepare('UPDATE hospital_assets SET quantity_in_stock = quantity_in_stock - ?, updated_at = ? WHERE id = ?')
      .run(qty, now, asset.id);

    await logAuditEvent({
      action: 'DEPARTMENT_DISPATCH_RECORDED',
      actorRole: role.toUpperCase(),
      details: `Dispatched ${qty} ${asset.unit} of "${asset.name}" to ${data.targetDepartment} (Handed to ${cleanRecipient})`,
      status: 'SUCCESS',
    });

    revalidatePath('/manager');
    return { success: true, dispatchNo };
  } catch (err: unknown) {
    console.error('Failed to dispatch to department:', err);
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

/**
 * Gets historical department dispatches.
 */
export async function getDepartmentDispatches(limit = 50): Promise<HospitalDepartmentDispatch[]> {
  await requirePermission('manager:dispatch', '/manager');

  try {
    const rows = sqlite
      .prepare(`
        SELECT * FROM hospital_department_dispatches
        ORDER BY created_at DESC
        LIMIT ?
      `)
      .all(limit) as {
        id: number;
        dispatch_no: string;
        asset_id?: number | null;
        asset_name: string;
        category: string;
        quantity: number;
        unit: string;
        target_department: string;
        recipient_staff: string;
        dispatched_by: string;
        dispatch_date: string;
        remarks?: string | null;
        created_at?: number | null;
      }[];

    return rows.map((r) => ({
      id: r.id,
      dispatchNo: r.dispatch_no,
      assetId: r.asset_id,
      assetName: r.asset_name,
      category: r.category as HospitalAssetCategory,
      quantity: r.quantity,
      unit: r.unit,
      targetDepartment: r.target_department as any,
      recipientStaff: r.recipient_staff,
      dispatchedBy: r.dispatched_by,
      dispatchDate: r.dispatch_date,
      remarks: r.remarks,
      createdAt: r.created_at ? new Date(r.created_at) : null,
    }));
  } catch (err) {
    console.error('Failed to get department dispatches:', err);
    return [];
  }
}

/**
 * Gets servicing logs for all assets.
 */
export async function getServiceLogs(limit = 50): Promise<HospitalServiceLog[]> {
  await requirePermission('manager:maintenance', '/manager');

  try {
    const rows = sqlite
      .prepare(`
        SELECT sl.*, ha.name as asset_name
        FROM hospital_service_logs sl
        JOIN hospital_assets ha ON sl.asset_id = ha.id
        ORDER BY sl.service_date DESC
        LIMIT ?
      `)
      .all(limit) as {
        id: number;
        asset_id: number;
        asset_name?: string;
        service_date: string;
        service_type: string;
        technician_name?: string | null;
        vendor_name?: string | null;
        cost: number;
        work_description: string;
        parts_replaced?: string | null;
        next_due_date?: string | null;
        status: string;
        logged_by?: string | null;
        created_at?: number | null;
      }[];

    return rows.map((r) => ({
      id: r.id,
      assetId: r.asset_id,
      assetName: r.asset_name,
      serviceDate: r.service_date,
      serviceType: r.service_type as any,
      technicianName: r.technician_name,
      vendorName: r.vendor_name,
      cost: r.cost,
      workDescription: r.work_description,
      partsReplaced: r.parts_replaced,
      nextDueDate: r.next_due_date,
      status: r.status as any,
      loggedBy: r.logged_by,
      createdAt: r.created_at ? new Date(r.created_at) : null,
    }));
  } catch (err) {
    console.error('Failed to get service logs:', err);
    return [];
  }
}

/**
 * Gets procurement orders.
 */
export async function getProcurementOrders(limit = 50): Promise<HospitalProcurementOrder[]> {
  await requirePermission('manager:purchase', '/manager');

  try {
    const rows = sqlite
      .prepare(`
        SELECT * FROM hospital_procurement_orders
        ORDER BY order_date DESC
        LIMIT ?
      `)
      .all(limit) as {
        id: number;
        order_no: string;
        vendor_name: string;
        category: string;
        items_json: string;
        total_amount: number;
        order_date: string;
        expected_delivery_date?: string | null;
        received_date?: string | null;
        status: string;
        ordered_by?: string | null;
        notes?: string | null;
        created_at?: number | null;
      }[];

    return rows.map((r) => ({
      id: r.id,
      orderNo: r.order_no,
      vendorName: r.vendor_name,
      category: r.category as any,
      items: JSON.parse(r.items_json || '[]'),
      totalAmount: r.total_amount,
      orderDate: r.order_date,
      expectedDeliveryDate: r.expected_delivery_date,
      receivedDate: r.received_date,
      status: r.status as any,
      orderedBy: r.ordered_by,
      notes: r.notes,
      createdAt: r.created_at ? new Date(r.created_at) : null,
    }));
  } catch (err) {
    console.error('Failed to get procurement orders:', err);
    return [];
  }
}
