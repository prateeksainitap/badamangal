"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/content/strings";
import { useToast } from "@/components/Toast";
import { trackEvent } from "@/lib/ga";
import { IMAGE_OR_PDF_ACCEPT, validateAttachment } from "@/lib/fileValidate";
import { useLocaleFromContext } from "@/lib/locale-context";
import PhoneInput from "@/components/PhoneInput";

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
      <div
        ref={successRef}
        className="relative overflow-hidden rounded-3xl border border-saffron-500/40 bg-cream-50 px-6 py-10 sm:py-12 text-center shadow-warm"
      >
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(420px 260px at 50% 18%, rgba(242,148,76,0.22), transparent 65%)",
          }}
        />
        <div className="flex justify-center">
          <span className="relative inline-flex items-center justify-center w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-leaf-600 text-cream-50 shadow-warm">
            <span
              aria-hidden
              className="absolute inset-0 rounded-full ring-2 ring-leaf-600/25 motion-safe:animate-ping"
            />
            <svg
              viewBox="0 0 52 52"
              className="relative w-6 h-6 sm:w-7 sm:h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path
                d="M14 27 L23 36 L38 18"
                className="motion-safe:[stroke-dasharray:50] motion-safe:[stroke-dashoffset:50] motion-safe:[animation:bm-tick_500ms_ease-out_180ms_forwards]"
              />
            </svg>
          </span>
        </div>
        <p className="mt-6 font-mukta uppercase tracking-[0.3em] text-saffron-600 text-xs font-semibold">
          {isHi ? "धन्यवाद" : "Thank you"}
        </p>
        <h2 className="mt-3 font-tiro text-2xl sm:text-3xl text-sindoor-700">
          {isHi ? "संदेश मिल गया।" : "Message received."}
        </h2>
        <p className="mt-2 text-ink-600">
          {isHi
            ? "हम जल्द ही आपको फ़ोन पर सम्पर्क करेंगे।"
            : "We'll call you back on your phone soon."}
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="rounded-3xl border border-saffron-500/40 bg-cream-50 p-5 sm:p-7 shadow-warm space-y-4"
    >
      {topError ? (
        <p
          role="alert"
          className="rounded-xl border border-alert-500/45 bg-alert-500/10 px-3 py-2 text-sm text-alert-500 font-semibold"
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
          className={inputCls(!!errors.name)}
        />
      </Field>

      {/* Phone is now the mandatory contact channel because we call back
          most reachouts within a day (faster, more reliable than email
          for organisers who don't check inboxes). Email is kept as an
          optional secondary so people can still leave a paper trail if
          they prefer written replies. The server-side validator in
          /api/contact mirrors this, see notes in route.ts. */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="contact-phone"
          label={isHi ? "फ़ोन" : "Phone"}
          required
          error={errors.phone}
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
            className={inputCls(!!errors.email)}
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
          className={inputCls(!!errors.subject)}
          placeholder={
            isHi
              ? "जैसे: भंडारा की जानकारी में सुधार चाहिए"
              : "e.g. Update to a bhandara listing or sponsorship enquiry"
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
          className={`${inputCls(!!errors.message)} resize-y min-h-[140px]`}
          placeholder={
            isHi
              ? "हमें यहाँ विस्तार से बताएँ…"
              : "Tell us a little more…"
          }
        />
        <p className="mt-1 text-[11px] text-ink-600 text-right tabular-nums">
          {message.length} / 4000
        </p>
      </Field>

      {/* Optional supporting attachment (PDF / JPG / PNG). Images are
          re-encoded to WebP server-side; PDFs pass through with a 5 MB
          cap. Upload happens immediately on file pick so the user sees
          a confirmation chip before they submit the rest of the form. */}
      <div>
        <label className="block text-xs font-mukta uppercase tracking-[0.18em] text-ink-600 font-semibold mb-1.5">
          {isHi ? "सहायक फ़ाइल (वैकल्पिक)" : "Supporting document (optional)"}
        </label>

        {attachment ? (
          <div className="flex items-center gap-3 rounded-xl border border-leaf-600/40 bg-leaf-600/5 px-3 py-2.5">
            <span className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-lg bg-leaf-600/15 text-leaf-600">
              {attachment.kind === "pdf" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                  <path d="M14 3v5h5" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                  <circle cx="9" cy="9" r="2" />
                  <path d="M21 15l-5-5L5 21" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink-900 truncate">
                {attachment.name}
              </p>
              <p className="text-[11px] text-ink-600 font-numerals tabular-nums">
                {formatBytes(attachment.bytes)}
                {attachment.kind === "image" ? (isHi ? " · WebP में बदला" : " · converted to WebP") : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={removeAttachment}
              className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full text-ink-600/70 hover:text-sindoor-700 hover:bg-saffron-50 transition-colors"
              aria-label={isHi ? "हटाएँ" : "Remove attachment"}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
                <path d="M5 5l14 14" />
                <path d="M19 5L5 19" />
              </svg>
            </button>
          </div>
        ) : (
          <label
            className={[
              "flex items-center justify-between gap-3 cursor-pointer rounded-xl border border-dashed bg-cream-50 px-3 py-3 transition-colors",
              uploading
                ? "border-saffron-500/55 opacity-70 cursor-wait"
                : errors.attachment
                  ? "border-alert-500/60 hover:border-alert-500"
                  : "border-gold-500/55 hover:border-saffron-500/70 hover:bg-saffron-50/50",
            ].join(" ")}
          >
            <span className="flex items-center gap-2 text-sm text-ink-900">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="text-saffron-600">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              {uploading
                ? isHi
                  ? "अपलोड हो रही है…"
                  : "Uploading…"
                : isHi
                  ? "PDF, JPG या PNG जोड़ें"
                  : "Attach a PDF, JPG, or PNG"}
            </span>
            <span className="text-[11px] text-ink-600">
              {isHi ? "PDF 5 MB · इमेज 5 MB" : "PDF 5 MB · Image 5 MB"}
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
          <p className="mt-1 text-xs text-alert-500 font-semibold">
            {errors.attachment}
          </p>
        ) : null}
        <p className="mt-1.5 text-[11px] text-ink-600 leading-relaxed">
          {isHi
            ? "तस्वीरें WebP में बदल दी जाती हैं ताकि अपलोड तेज़ और छोटी हो।"
            : "Images are auto-converted to WebP so uploads stay small and fast."}
        </p>
      </div>

      {/* Honeypot DOM removed, see comment near state declaration. */}

      <div className="pt-2">
        <button
          type="submit"
          disabled={stage === "submitting"}
          className="btn btn-primary w-full sm:w-auto justify-center disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {stage === "submitting"
            ? isHi
              ? "भेजा जा रहा है…"
              : "Sending…"
            : isHi
              ? "संदेश भेजें"
              : "Send message"}
        </button>
      </div>
    </form>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function inputCls(hasError: boolean): string {
  return [
    "w-full rounded-xl border bg-cream-50 px-3 py-2.5 text-sm text-ink-900",
    "placeholder:text-ink-600/55 focus:outline-none focus:ring-2 focus:ring-saffron-500/45",
    hasError
      ? "border-alert-500/60 focus:border-alert-500"
      : "border-gold-500/45 focus:border-saffron-500",
  ].join(" ");
}

function Field({
  id,
  label,
  required,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-xs font-mukta uppercase tracking-[0.18em] text-ink-600 font-semibold mb-1.5"
      >
        {label}
        {required ? <span className="text-sindoor-700"> *</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-alert-500 font-semibold">{error}</p>
      ) : null}
    </div>
  );
}
