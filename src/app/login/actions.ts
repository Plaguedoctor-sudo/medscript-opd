'use server';

import { cookies } from 'next/headers';
import { db } from '@/db';
import { clinicSettings } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import {
  hashPin,
  createSessionToken,
  SESSION_COOKIE_NAME,
  getSecurityConfig,
} from '@/lib/auth';

export interface LoginResult {
  success: boolean;
  error?: string;
  redirectUrl?: string;
}

export async function loginWithPin(
  pin: string,
  targetRedirect?: string
): Promise<LoginResult> {
  const trimmedPin = pin.trim();

  if (!trimmedPin) {
    return { success: false, error: 'Please enter your consultation desk PIN.' };
  }

  const settings = await db.query.clinicSettings.findFirst({
    where: eq(clinicSettings.id, 1),
  });

  if (!settings || !settings.pinHash) {
    return { success: false, error: 'No PIN has been configured in Clinic Settings.' };
  }

  const hashedInput = hashPin(trimmedPin);

  if (hashedInput !== settings.pinHash) {
    return { success: false, error: 'Incorrect PIN. Please try again.' };
  }

  // Create session token and set secure HTTP-only cookie
  const token = createSessionToken();
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 24 * 60 * 60, // 24 hours
  });

  const destination = targetRedirect && targetRedirect.startsWith('/') && !targetRedirect.startsWith('//')
    ? targetRedirect
    : '/';

  return { success: true, redirectUrl: destination };
}

export async function lockDeskAction(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
  redirect('/login');
}

export interface SecurityUpdateResult {
  success: boolean;
  message: string;
}

export async function updateSecuritySettings(
  enabled: boolean,
  pin?: string,
  confirmPin?: string
): Promise<SecurityUpdateResult> {
  const { pinConfigured } = await getSecurityConfig();

  // If enabling security or changing PIN:
  if (pin && pin.trim().length > 0) {
    const cleanPin = pin.trim();

    if (cleanPin.length < 4 || cleanPin.length > 8) {
      return {
        success: false,
        message: 'PIN must be between 4 and 8 digits.',
      };
    }

    if (!/^\d+$/.test(cleanPin)) {
      return {
        success: false,
        message: 'PIN should contain only numbers (0–9).',
      };
    }

    if (cleanPin !== confirmPin?.trim()) {
      return {
        success: false,
        message: 'PIN and Confirm PIN do not match.',
      };
    }

    const hashed = hashPin(cleanPin);

    await db
      .update(clinicSettings)
      .set({
        pinHash: hashed,
        securityEnabled: enabled,
      })
      .where(eq(clinicSettings.id, 1));

    // Also auto-login the current session so doctor isn't locked out immediately
    if (enabled) {
      const token = createSessionToken();
      const cookieStore = await cookies();
      cookieStore.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 24 * 60 * 60,
      });
    }

    revalidatePath('/', 'layout');
    return {
      success: true,
      message: enabled
        ? 'PIN protection enabled successfully! Your consultation desk is secured.'
        : 'PIN updated successfully.',
    };
  }

  // Enabling without setting a new PIN:
  if (enabled) {
    if (!pinConfigured) {
      return {
        success: false,
        message: 'Please set a 4 to 8 digit PIN before enabling protection.',
      };
    }

    await db
      .update(clinicSettings)
      .set({ securityEnabled: true })
      .where(eq(clinicSettings.id, 1));

    revalidatePath('/', 'layout');
    return {
      success: true,
      message: 'PIN protection is now active.',
    };
  }

  // Disabling security
  await db
    .update(clinicSettings)
    .set({ securityEnabled: false })
    .where(eq(clinicSettings.id, 1));

  revalidatePath('/', 'layout');
  return {
    success: true,
    message: 'PIN protection has been disabled. Direct access is restored.',
  };
}
