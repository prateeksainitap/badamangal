"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/content/strings";
import { useToast } from "@/components/Toast";
import { trackEvent } from "@/lib/ga";
import { IMAGE_OR_PDF_ACCEPT, validateAttachment } from "@/lib/fileValidate";
import { useLocaleFromContext } from "@/lib/locale-context";
import PhoneInput from "@/components/PhoneInput";
import { FormPanel, Field as KitField, Heading, Button, Icon } from "@/components/v2";

type Stage = "compose" | "submitting" | "done" | "error";

type FieldErrors = Partial<
  Record<
    "name" | "email" | "phone" | "subject" | "message" | "attachment",
    string
  >
>;

type Attachment = {
  url: string;
  name: string;
  bytes: number;
  kind: "image" | "pdf";
};

/**
 * Public contact form (paired with /api/contact). Mirrors the visual
 * language of the Spot / List forms, saffron-bordered card, round CTAs,
 * inline field errors. Honeypot field is rendered off-screen and any bot
 * that fills it gets a fake-success response from the API.
 */
export default function ContactForm({ locale: _localeProp }: { locale?: Locale }) {
  // Cookie-aware locale (prop kept for API back-compat but ignored,
  // server always passes "en" now that pages are statically rendered).
  const locale = useLocaleFromContext();
  const isHi = locale === "hi";
  const toast = useToast();
  const successRef = useRef<HTMLDivElement | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot field removed (was state `website`). Browser autofill /
  // password managers were filling it on legit users, causing their
  // messages to silently 200 without saving. /api/contact still logs
  // any trip for visibility but no longer blocks on it.

  const [stage, setStage] = useState<Stage>("compose");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [topError, setTopError] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);

  // Scroll the success card into view once it mounts so the user sees it
  // even if they were deep in the form on mobile.
  useEffect(() => {
    if (stage !== "done") return;
    const node = successRef.current;
    if (!node) return;
    const id = window.requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => window.cancelAnimationFrame(id);
  }, [stage]);

  // Play a short "Jai Shree Ram" chant after a successful submit. The
  // audio fires on the same user-gesture turn that produced the
  // submission, so modern browser autoplay policies allow it without a
  // separate click. We:
  //   • respect prefers-reduced-motion as a proxy for "user wants a
  //     quiet, distraction-free experience", that media query is the
  //     closest standard to "reduced sensory output" we have without
  //     adding our own toggle
  //   • cap volume at 0.6 so the chant doesn't startle anyone who had
  //     headphones cranked
  //   • silently swallow promise rejections (Safari can still reject
  //     play() if the tab was backgrounded between submit and onSuccess)
  //   • clean up on unmount so navigating away mid-playback doesn't
  //     leak a still-playing Audio instance
  useEffect(() => {
    if (stage !== "done") return;
    if (typeof window === "undefined") return;
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const audio = new Audio("/audio/jai-shree-ram.mp3");
    audio.volume = 0.6;
    // play() returns a Promise; ignore rejections (autoplay-policy
    // edge cases, tab backgrounded, etc.), the chant is delight, not
    // a critical UX signal.
    audio.play().catch(() => {});
    return () => {
      audio.pause();
      audio.currentTime = 0;
    };
  }, [stage]);

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-picked
    if (!file) return;
    setErrors((prev) => ({ ...prev, attachment: undefined }));

    // Single source-of-truth validation (shared with PhotoPicker + server).
    const check = validateAttachment(file, locale);
    if (!check.ok) {
      setErrors((prev) => ({ ...prev, attachment: check.message }));
      trackEvent("contact_attachment_rejected_client", {
        type: file.type || "unknown",
        size_kb: Math.round(file.size / 1024),
      });
      return;
    }
    const isPdf = file.type === "application/pdf";

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/uploads", { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        bytes?: number;
        kind?: "image" | "pdf";
        error?: string;
      };
      if (!res.ok || !data.url) {
        setErrors((prev) => ({
          ...prev,
          attachment:
            data.error ??
            (isHi
              ? "फ़ाइल अपलोड नहीं हो पाई।"
              : "Couldn't upload that file."),
        }));
        return;
      }
      setAttachment({
        url: data.url,
        name: file.name,
        bytes: data.bytes ?? file.size,
        kind: data.kind ?? (isPdf ? "pdf" : "image"),
      });
      trackEvent("contact_attachment_upload", {
        kind: data.kind ?? (isPdf ? "pdf" : "image"),
      });
    } catch {
      setErrors((prev) => ({
        ...prev,
        attachment: isHi
          ? "नेटवर्क समस्या। फिर कोशिश करें।"
          : "Network problem. Try again.",
      }));
    } finally {
      setUploading(false);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setErrors((prev) => ({ ...prev, attachment: undefined }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStage("submitting");
    setErrors({});
    setTopError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          subject,
          message,
          // honeypot removed; see note next to state declaration above
          attachmentUrl: attachment?.url,
          attachmentName: attachment?.name,
          attachmentType: attachment?.kind,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        message?: string;
        fields?: FieldErrors;
      };

      if (!res.ok) {
        if (data.error === "validation" && data.fields) {
          setErrors(data.fields);
          setTopError(
            isHi
              ? "कुछ फ़ील्ड्स ठीक करने हैं।"
              : "A couple of fields need attention.",
          );
          setStage("error");
          trackEvent("contact_submit_validation");
          return;
        }
        if (res.status === 429) {
          setTopError(
            isHi
              ? "बहुत सारे संदेश। थोड़ी देर बाद फिर कोशिश करें।"
              : data.message ?? "Too many messages. Try again later.",
          );
          setStage("error");
          trackEvent("contact_submit_rate_limited");
          return;
        }
        setTopError(
          isHi ? "भेजने में दिक्कत आई।" : "Couldn't send. Try again.",
        );
        setStage("error");
        trackEvent("contact_submit_error", { status: res.status });
        return;
      }

      trackEvent("contact_submit_success");
      toast.show(isHi ? "संदेश भेज दिया" : "Message sent");
      setStage("done");
    } catch {
      setTopError(
        isHi ? "नेटवर्क समस्या। फिर कोशिश करें।" : "Network problem. Try again.",
      );
      setStage("error");
      trackEvent("contact_submit_error", { status: 0 });
    }
  };

  if (stage === "done") {
    return (
      <FormPanel>
        <div ref={successRef} className="bmi-done" aria-live="polite">
          <div className="bmi-done-tick" aria-hidden>
            <Icon name="check" />
          </div>
          <p className="bmi-kick" style={{ justifyContent: "center" }}>
            {isHi ? "धन्यवाद" : "Thank you"}
          </p>
          <Heading as="h2" en="Message received." hi="संदेश मिल गया।" />
          <p className="bmi-lede">
            {isHi
              ? "हम जल्द ही आपको फ़ोन पर सम्पर्क करेंगे।"
              : "We'll call you back on your phone soon."}
          </p>
        </div>
      </FormPanel>
    );
  }

  return (
    <FormPanel>
    <form
      onSubmit={submit}
      noValidate
      className="bmi-form"
    >
      {topError ? (
        <p
          role="alert"
          className="bmi-alert"
        >
          {topError}
        </p>
      ) : null}

      <Field
        id="contact-name"
        label={isHi ? "नाम" : "Name"}
        required
        error={errors.name}
      >
        <input
          id="contact-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          maxLength={80}
          required
          aria-invalid={errors.name ? true : undefined}
        />
      </Field>

      {/* Phone is now the mandatory contact channel because we call back
          most reachouts within a day (faster, more reliable than email
          for organisers who don't check inboxes). Email is kept as an
          optional secondary so people can still leave a paper trail if
          they prefer written replies. The server-side validator in
          /api/contact mirrors this, see notes in route.ts. */}
      <div className="bmi-grid2">
        <Field
          id="contact-phone"
          label={isHi ? "फ़ोन" : "Phone"}
          required
        >
          {/* Shared PhoneInput, locks +91 prefix, caps at 10 digits.
              Same control admin + organise + bhandara forms use. */}
          <PhoneInput
            id="contact-phone"
            value={phone}
            onChange={setPhone}
            required
            error={errors.phone}
            autoComplete="tel"
          />
        </Field>
        <Field
          id="contact-email"
          label={isHi ? "ईमेल (वैकल्पिक)" : "Email (optional)"}
          error={errors.email}
        >
          <input
            id="contact-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            maxLength={120}
            aria-invalid={errors.email ? true : undefined}
          />
        </Field>
      </div>

      <Field
        id="contact-subject"
        label={isHi ? "विषय (वैकल्पिक)" : "Subject (optional)"}
        error={errors.subject}
      >
        <input
          id="contact-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={120}
          aria-invalid={errors.subject ? true : undefined}
          placeholder={
            isHi
              ? "जैसे: भंडारा की जानकारी में सुधार चाहिए"
              : "e.g. Update to a bhandara listing"
          }
        />
      </Field>

      <Field
        id="contact-message"
        label={isHi ? "संदेश" : "Message"}
        required
        error={errors.message}
      >
        <textarea
          id="contact-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          maxLength={4000}
          required
          aria-invalid={errors.message ? true : undefined}
          placeholder={
            isHi
              ? "हमें यहाँ विस्तार से बताएँ…"
              : "Tell us a little more…"
          }
        />
        <span className="bmi-field-hint text-right tabular-nums">
          {message.length} / 4000
        </span>
      </Field>

      {/* Optional supporting attachment (PDF / JPG / PNG). Images are
          re-encoded to WebP server-side; PDFs pass through with a 5 MB
          cap. Upload happens immediately on file pick so the user sees
          a confirmation chip before they submit the rest of the form. */}
      <div className="bmi-field">
        <span className="bmi-field-label">
          {isHi ? "सहायक फ़ाइल" : "Supporting document"}
          <span className="opt">{isHi ? "वैकल्पिक" : "optional"}</span>
        </span>

        {attachment ? (
          <div className="bmi-fnote" style={{ alignItems: "center" }}>
            <span className="ic" aria-hidden style={{ marginTop: 0 }}>
              <Icon name="check" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block truncate">{attachment.name}</b>
              <span className="block text-[13px] tabular-nums">
                {formatBytes(attachment.bytes)}
                {attachment.kind === "image" ? (isHi ? ", WebP में बदला" : ", converted to WebP") : ""}
              </span>
            </span>
            <button
              type="button"
              onClick={removeAttachment}
              className="bmi-tl shrink-0"
              aria-label={isHi ? "हटाएँ" : "Remove attachment"}
            >
              {isHi ? "हटाएँ" : "Remove"}
            </button>
          </div>
        ) : (
          <label
            className={`bmi-file ${uploading ? "busy" : ""} ${errors.attachment ? "bad" : ""}`.trim()}
          >
            <span className="flex items-center gap-3">
              <span className="bmi-file-ic" aria-hidden>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </span>
              {uploading
                ? isHi
                  ? "अपलोड हो रही है…"
                  : "Uploading…"
                : isHi
                  ? "PDF, JPG या PNG जोड़ें"
                  : "Attach a PDF, JPG, or PNG"}
            </span>
            <span className="bmi-file-meta">
              {isHi ? "अधिकतम 5 MB" : "Max 5 MB"}
            </span>
            <input
              type="file"
              accept={IMAGE_OR_PDF_ACCEPT}
              onChange={onPickFile}
              disabled={uploading}
              className="sr-only"
            />
          </label>
        )}
        {errors.attachment ? (
          <span className="bmi-field-err" role="alert">
            {errors.attachment}
          </span>
        ) : null}
      </div>

      {/* Honeypot DOM removed, see comment near state declaration. */}

      <div className="bmi-form-foot">
        <Button type="submit" disabled={stage === "submitting"} iconEnd="chevron">
          {stage === "submitting"
            ? isHi
              ? "भेजा जा रहा है…"
              : "Sending…"
            : isHi
              ? "संदेश भेजें"
              : "Send message"}
        </Button>
      </div>
    </form>
    </FormPanel>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function Field({
  id,
  label,
  required: _required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  // Kit field: label above, error in plain words under the control.
  // Optional fields say so quietly; required ones carry no star.
  const m = label.match(/^(.*?)\s*\((optional|वैकल्पिक)\)$/);
  return (
    <KitField htmlFor={id} label={m ? m[1] : label} optional={m ? m[2] : undefined} error={error}>
      {children}
    </KitField>
  );
}
