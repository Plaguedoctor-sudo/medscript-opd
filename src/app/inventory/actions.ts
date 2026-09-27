'use server';

import { sqlite } from '@/db';
import { requireAuth, getCurrentUserRole, getCurrentUser, isDoctor, isNurse, isReceptionist } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';
import { revalidatePath } from 'next/cache';
import { PharmacyInventoryItem, PharmacyTransaction, MedicineCategory } from '@/types';

export interface InventoryStats {
  totalItems: number;
  totalQuantity: number;
  totalValuation: number;
  lowStockCount: number;
  expiringSoonCount: number;
}

export async function getPharmacyInventory(params?: {
  search?: string;
  category?: string;
  filter?: 'all' | 'low_stock' | 'expiring_soon';
}): Promise<{
  items: PharmacyInventoryItem[];
  stats: InventoryStats;
}> {
  await requireAuth('/inventory');

  try {
    let sql = 'SELECT * FROM pharmacy_inventory WHERE 1=1';
    const queryParams: (string | number)[] = [];

    if (params?.search && params.search.trim()) {
      sql += ' AND (medicine_name LIKE ? OR brand_name LIKE ? OR batch_no LIKE ?)';
      const s = `%${params.search.trim()}%`;
      queryParams.push(s, s, s);
    }

    if (params?.category && params.category !== 'All') {
      sql += ' AND category = ?';
      queryParams.push(params.category);
    }

    // 90 days from now in YYYY-MM-DD
    const now = new Date();
    const future90 = new Date(now.getTime() + 90 * 86400 * 1000).toISOString().split('T')[0];

    if (params?.filter === 'low_stock') {
      sql += ' AND quantity_in_stock <= min_threshold';
    } else if (params?.filter === 'expiring_soon') {
      sql += ' AND expiry_date <= ?';
      queryParams.push(future90);
    }

    sql += ' ORDER BY (quantity_in_stock <= min_threshold) DESC, expiry_date ASC, medicine_name ASC';

    const rawRows = sqlite.prepare(sql).all(...queryParams) as {
      id: number;
      medicine_name: string;
      brand_name?: string | null;
      category: string;
      batch_no: string;
      expiry_date: string;
      quantity_in_stock: number;
      min_threshold: number;
      purchase_cost: number;
      mrp: number;
      selling_price: number;
      rack_location?: string | null;
      supplier_name?: string | null;
      created_at?: number | null;
      updated_at?: number | null;
    }[];

    const items: PharmacyInventoryItem[] = rawRows.map((r) => ({
      id: r.id,
      medicineName: r.medicine_name,
      brandName: r.brand_name,
      category: r.category as MedicineCategory,
      batchNo: r.batch_no,
      expiryDate: r.expiry_date,
      quantityInStock: r.quantity_in_stock,
      minThreshold: r.min_threshold,
      purchaseCost: r.purchase_cost,
      mrp: r.mrp,
      sellingPrice: r.selling_price,
      rackLocation: r.rack_location,
      supplierName: r.supplier_name,
      createdAt: r.created_at ? new Date(r.created_at) : null,
      updatedAt: r.updated_at ? new Date(r.updated_at) : null,
    }));

    // Calculate overall stats
    const allItems = sqlite
      .prepare('SELECT quantity_in_stock, purchase_cost, min_threshold, expiry_date FROM pharmacy_inventory')
      .all() as {
        quantity_in_stock: number;
        purchase_cost: number;
        min_threshold: number;
        expiry_date: string;
      }[];

    let totalQuantity = 0;
    let totalValuation = 0;
    let lowStockCount = 0;
    let expiringSoonCount = 0;

    for (const row of allItems) {
      totalQuantity += row.quantity_in_stock || 0;
      totalValuation += (row.quantity_in_stock || 0) * (row.purchase_cost || 0);
      if ((row.quantity_in_stock || 0) <= (row.min_threshold || 20)) {
        lowStockCount++;
      }
      if (row.expiry_date && row.expiry_date <= future90) {
        expiringSoonCount++;
      }
    }

    return {
      items,
      stats: {
        totalItems: allItems.length,
        totalQuantity,
        totalValuation: Math.round(totalValuation * 100) / 100,
        lowStockCount,
        expiringSoonCount,
      },
    };
  } catch (err) {
    console.error('Failed to get pharmacy inventory:', err);
    return {
      items: [],
      stats: {
        totalItems: 0,
        totalQuantity: 0,
        totalValuation: 0,
        lowStockCount: 0,
        expiringSoonCount: 0,
      },
    };
  }
}

export async function addPharmacyItem(data: {
  medicineName: string;
  brandName?: string;
  category: string;
  batchNo: string;
  expiryDate: string;
  quantityInStock: number;
  minThreshold: number;
  purchaseCost: number;
  mrp: number;
  sellingPrice: number;
  rackLocation?: string;
  supplierName?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  await requireAuth('/inventory');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isDoctor(role) && !isReceptionist(role) && !isNurse(role)) {
    return { success: false, error: 'Unauthorized: Staff authorization required to manage pharmacy inventory.' };
  }

  try {
    const now = Date.now();
    const res = sqlite
      .prepare(`
        INSERT INTO pharmacy_inventory (
          medicine_name, brand_name, category, batch_no, expiry_date,
          quantity_in_stock, min_threshold, purchase_cost, mrp, selling_price,
          rack_location, supplier_name, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.medicineName.trim(),
        data.brandName?.trim() || null,
        data.category || 'Tablet',
        data.batchNo.trim().toUpperCase(),
        data.expiryDate.trim(),
        Math.max(0, data.quantityInStock),
        Math.max(0, data.minThreshold || 20),
        Math.max(0, data.purchaseCost || 0),
        Math.max(0, data.mrp || 0),
        Math.max(0, data.sellingPrice || 0),
        data.rackLocation?.trim() || null,
        data.supplierName?.trim() || null,
        now,
        now
      );

    const insertedId = Number(res.lastInsertRowid);

    // Record initial inward transaction
    if (data.quantityInStock > 0) {
      sqlite
        .prepare(`
          INSERT INTO pharmacy_transactions (
            inventory_id, type, quantity, remarks, created_at
          ) VALUES (?, 'INWARD', ?, ?, ?)
        `)
        .run(insertedId, data.quantityInStock, `Initial stock inward by ${user?.name || role}`, now);
    }

    await logAuditEvent({
      action: 'PHARMACY_STOCK_ADDED',
      actorRole: role.toUpperCase(),
      details: `Added new stock: ${data.medicineName} (${data.category}) - Batch: ${data.batchNo}, Qty: ${data.quantityInStock}`,
      status: 'SUCCESS',
    });

    revalidatePath('/inventory');
    return { success: true, id: insertedId };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function dispenseOrAdjustStock(data: {
  inventoryId: number;
  type: 'DISPENSED' | 'ADJUSTMENT' | 'EXPIRED' | 'INWARD';
  quantity: number;
  patientId?: number;
  prescriptionId?: number;
  admissionId?: number;
  remarks?: string;
}): Promise<{ success: boolean; newStock?: number; error?: string }> {
  await requireAuth('/inventory');
  const role = await getCurrentUserRole();
  const user = await getCurrentUser();

  if (!isDoctor(role) && !isNurse(role) && !isReceptionist(role)) {
    return { success: false, error: 'Unauthorized: Staff authorization required to dispense inventory.' };
  }

  // Adjustments and write-offs require Doctor authorization
  if ((data.type === 'ADJUSTMENT' || data.type === 'EXPIRED') && !isDoctor(role)) {
    return { success: false, error: 'Unauthorized: Only an authorized Doctor or CMO can adjust or write off inventory.' };
  }

  try {
    const item = sqlite
      .prepare('SELECT id, medicine_name, quantity_in_stock FROM pharmacy_inventory WHERE id = ?')
      .get(data.inventoryId) as { id: number; medicine_name: string; quantity_in_stock: number } | undefined;

    if (!item) {
      return { success: false, error: 'Inventory item not found.' };
    }

    let newStock = item.quantity_in_stock;
    const delta = Math.abs(data.quantity);

    if (data.type === 'INWARD') {
      newStock += delta;
    } else {
      if (item.quantity_in_stock < delta) {
        return {
          success: false,
          error: `Insufficient stock! Current stock is ${item.quantity_in_stock}, cannot dispense ${delta}.`,
        };
      }
      newStock -= delta;
    }

    const now = Date.now();

    sqlite
      .prepare('UPDATE pharmacy_inventory SET quantity_in_stock = ?, updated_at = ? WHERE id = ?')
      .run(newStock, now, data.inventoryId);

    sqlite
      .prepare(`
        INSERT INTO pharmacy_transactions (
          inventory_id, type, quantity, patient_id, prescription_id, admission_id, remarks, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        data.inventoryId,
        data.type,
        data.type === 'INWARD' ? delta : -delta,
        data.patientId || null,
        data.prescriptionId || null,
        data.admissionId || null,
        data.remarks?.trim() || `Processed by ${user?.name || role}`,
        now
      );

    await logAuditEvent({
      action: 'PHARMACY_STOCK_DISPENSED',
      actorRole: role.toUpperCase(),
      details: `${data.type} of ${delta} units of ${item.medicine_name}. New balance: ${newStock}`,
      status: 'SUCCESS',
    });

    revalidatePath('/inventory');
    return { success: true, newStock };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg };
  }
}

export async function getPharmacyTransactions(limit = 30): Promise<
  (PharmacyTransaction & {
    medicineName: string;
    patientName?: string | null;
  })[]
> {
  await requireAuth('/inventory');

  try {
    const rows = sqlite
      .prepare(`
        SELECT
          t.id,
          t.inventory_id as inventoryId,
          t.type,
          t.quantity,
          t.patient_id as patientId,
          t.prescription_id as prescriptionId,
          t.admission_id as admissionId,
          t.remarks,
          t.created_at as createdAt,
          i.medicine_name as medicineName,
          p.name as patientName
        FROM pharmacy_transactions t
        LEFT JOIN pharmacy_inventory i ON t.inventory_id = i.id
        LEFT JOIN patients p ON t.patient_id = p.id
        ORDER BY t.id DESC
        LIMIT ?
      `)
      .all(limit) as {
        id: number;
        inventoryId: number;
        type: 'INWARD' | 'DISPENSED' | 'ADJUSTMENT' | 'EXPIRED';
        quantity: number;
        patientId?: number | null;
        prescriptionId?: number | null;
        admissionId?: number | null;
        remarks?: string | null;
        createdAt?: number | null;
        medicineName: string;
        patientName?: string | null;
      }[];

    return rows.map((r) => ({
      id: r.id,
      inventoryId: r.inventoryId,
      type: r.type,
      quantity: r.quantity,
      patientId: r.patientId,
      prescriptionId: r.prescriptionId,
      admissionId: r.admissionId,
      remarks: r.remarks,
      createdAt: r.createdAt ? new Date(r.createdAt) : null,
      medicineName: r.medicineName || 'Unknown Medicine',
      patientName: r.patientName,
    }));
  } catch (err) {
    console.error('Failed to get transactions:', err);
    return [];
  }
}
