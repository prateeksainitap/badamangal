"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";

const COOKIE = "admin";

async function isAdmin(): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  const c = await cookies();
  return c.get(COOKIE)?.value === expected;
}

async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Unauthorized");
  }
}

export async function loginAction(formData: FormData): Promise<void> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || password !== expected) {
    redirect("/admin?error=1");
  }
  const c = await cookies();
  c.set(COOKIE, password, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  const c = await cookies();
  c.delete(COOKIE);
  redirect("/admin");
}

export async function approveAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { status: "APPROVED", approvedAt: new Date() },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

/**
 * One-click "we called the organizer and confirmed" action used from the
 * PENDING moderation queue. Flips the listing live (status → APPROVED)
 * AND stamps the verified badge in the same write — this is the normal
 * flow for the Option-4 model where every submission starts hidden and
 * publish == verify.
 */
export async function publishVerifiedAction(
  id: string,
  _formData?: FormData,
): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: {
      status: "APPROVED",
      isVerified: true,
      approvedAt: new Date(),
    },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

export async function rejectAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { status: "REJECTED" },
  });
  revalidatePath("/admin");
}

/**
 * Flip the human-verification flag on an APPROVED listing. The bhandara is
 * already live; this just adds the green "Verified" badge once the
 * BadaMangal team has confirmed the details by phone.
 */
export async function verifyAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { isVerified: true },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}

export async function unverifyAction(id: string, _formData?: FormData): Promise<void> {
  await requireAdmin();
  await prisma.bhandara.update({
    where: { id },
    data: { isVerified: false },
  });
  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath(`/bhandara/[slug]`, "page");
}
