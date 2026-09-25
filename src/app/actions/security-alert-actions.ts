"use server";

import { revalidatePath } from "next/cache";
import {
  getSecurityAlerts,
  acknowledgeAlert,
  acknowledgeAllAlerts,
  triggerSecurityTestIncident,
  SecurityAlertStats,
} from "@/lib/security-engine";
import { getCurrentUserRole } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

export async function getSecurityAlertsAction(): Promise<SecurityAlertStats> {
  try {
    return await getSecurityAlerts({ unacknowledgedOnly: false, limit: 40 });
  } catch (err) {
    console.error("Failed to load security alerts:", err);
    return {
      totalActive: 0,
      criticalCount: 0,
      warningCount: 0,
      infoCount: 0,
      alerts: [],
    };
  }
}

export async function acknowledgeAlertAction(
  id: number
): Promise<{ success: boolean; error?: string }> {
  try {
    const role = await getCurrentUserRole();
    const actorName = role === "doctor" ? "Doctor" : "Authorized Staff";

    const ok = await acknowledgeAlert(id, actorName);
    if (ok) {
      await logAuditEvent({
        action: "SECURITY_ALERT_ACKNOWLEDGED",
        actorRole: role === "doctor" ? "DOCTOR" : "RECEPTIONIST",
        details: `Alert #${id} acknowledged and reviewed by ${actorName}`,
        status: "SUCCESS",
      });
      revalidatePath("/", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to update alert" };
  } catch (err) {
    console.error("Failed to acknowledge alert:", err);
    return { success: false, error: "Server error acknowledging alert" };
  }
}

export async function acknowledgeAllAlertsAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const role = await getCurrentUserRole();
    const actorName = role === "doctor" ? "Doctor" : "Authorized Staff";

    const ok = await acknowledgeAllAlerts(actorName);
    if (ok) {
      await logAuditEvent({
        action: "SECURITY_ALERT_ACKNOWLEDGED",
        actorRole: role === "doctor" ? "DOCTOR" : "RECEPTIONIST",
        details: `All active security alerts acknowledged and reviewed by ${actorName}`,
        status: "SUCCESS",
      });
      revalidatePath("/", "layout");
      return { success: true };
    }
    return { success: false, error: "Failed to acknowledge alerts" };
  } catch (err) {
    console.error("Failed to acknowledge all alerts:", err);
    return { success: false, error: "Server error acknowledging alerts" };
  }
}

export async function triggerSecurityTestIncidentAction(
  type: "brute_force" | "data_transfer" | "break_glass" | "tamper_seal"
): Promise<{ success: boolean; error?: string }> {
  try {
    await triggerSecurityTestIncident(type);
    revalidatePath("/", "layout");
    return { success: true };
  } catch (err) {
    console.error("Failed to trigger security test incident:", err);
    return { success: false, error: "Could not trigger test incident" };
  }
}
