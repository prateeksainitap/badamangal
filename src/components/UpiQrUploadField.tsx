"use client";

import { useState } from "react";
import UpiQrUpload from "@/components/UpiQrUpload";

/**
 * Uncontrolled wrapper around `UpiQrUpload` for plain HTML forms.
 *
 * Why this exists:
 *   `UpiQrUpload` is a controlled component (parent owns the value).
 *   That suits ScanReview and BhandaraForm, which already track form
 *   state in React. But /admin/edit/[id] is a server-rendered form
 *   posted to a server action — there's no React state, just `<input
 *   name="...">` fields and a `<form action={...}>` submit handler.
 *   This wrapper holds the URL in its own useState and renders a
 *   hidden `<input name={name}>` so the server action picks it up via
 *   `formData.get("upiQrUrl")` exactly like every other text field.
 *
 * Server-action contract:
 *   - Pass `name="upiQrUrl"` (or whatever the server action reads)
 *   - Pass `defaultValue` to hydrate from the row's existing value
 *   - Server action reads `formData.get(name)` and persists it
 */
export default function UpiQrUploadField({
  name,
  defaultValue = "",
}: {
  name: string;
  defaultValue?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <UpiQrUpload value={value} onChange={setValue} theme="admin" name={name} />
  );
}
