import { useEffect, useRef, useState } from "react";

const COPY = {
  en: {
    manage: "Manage photos", upload: "Choose photos", limit: "Up to 10 photos, 10 MB each (JPEG, PNG or WebP).",
    empty: "No photos have been added.", loading: "Loading photos…", failed: "The photo could not be uploaded or processed.",
    unavailable: "Photos could not be loaded.", remove: "Remove photo", moveUp: "Move earlier", moveDown: "Move later",
    pending: "Upload needs attention. Retry removal or choose the file again.", deleting: "Removal is pending. Retry removal.",
    invalid: "Choose JPEG, PNG or WebP photos no larger than 10 MB each.",
    progress: (index, total, percent) => `Uploading photo ${index} of ${total} (${percent}%).`,
    success: "Photos updated.", tooMany: "Only the remaining photo slots can be uploaded.",
  },
  ar: {
    manage: "\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0635\u0648\u0631",
    upload: "\u0627\u062e\u062a\u0631 \u0635\u0648\u0631\u0627\u064b",
    limit: "\u062d\u062a\u0649 10 \u0635\u0648\u0631\u060c \u0628\u062d\u062f \u0623\u0642\u0635\u0649 10 \u0645\u064a\u063a\u0627\u0628\u0627\u064a\u062a \u0644\u0644\u0635\u0648\u0631\u0629 (JPEG \u0623\u0648 PNG \u0623\u0648 WebP).",
    empty: "\u0644\u0645 \u062a\u064f\u0636\u0641 \u0635\u0648\u0631\u0627\u064b \u0628\u0639\u062f.",
    loading: "\u062c\u0627\u0631\u064a \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0648\u0631...",
    failed: "\u062a\u0639\u0630\u0631 \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629 \u0623\u0648 \u0645\u0639\u0627\u0644\u062c\u062a\u0647\u0627.",
    unavailable: "\u062a\u0639\u0630\u0631 \u062a\u062d\u0645\u064a\u0644 \u0627\u0644\u0635\u0648\u0631.",
    remove: "\u062d\u0630\u0641 \u0627\u0644\u0635\u0648\u0631\u0629",
    moveUp: "\u0646\u0642\u0644 \u0644\u0644\u0623\u0639\u0644\u0649",
    moveDown: "\u0646\u0642\u0644 \u0644\u0644\u0623\u0633\u0641\u0644",
    pending: "\u0627\u0644\u0631\u0641\u0639 \u0644\u0645 \u064a\u0643\u062a\u0645\u0644. \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629 \u0623\u0648 \u0627\u062d\u0630\u0641 \u0627\u0644\u0635\u0648\u0631\u0629 \u0648\u0627\u062e\u062a\u0631\u0647\u0627 \u0645\u062c\u062f\u062f\u0627\u064b.",
    deleting: "\u0627\u0644\u062d\u0630\u0641 \u0644\u0645 \u064a\u0643\u062a\u0645\u0644. \u0623\u0639\u062f \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629.",
    invalid: "\u0627\u062e\u062a\u0631 \u0635\u0648\u0631\u0629 JPEG \u0623\u0648 PNG \u0623\u0648 WebP \u0644\u0627 \u064a\u0632\u064a\u062f \u062d\u062c\u0645\u0647\u0627 \u0639\u0646 10 \u0645\u064a\u063a\u0627\u0628\u0627\u064a\u062a.",
    progress: (index, total, percent) => `\u062c\u0627\u0631\u064a \u0631\u0641\u0639 \u0627\u0644\u0635\u0648\u0631\u0629 ${index} \u0645\u0646 ${total} (${percent}%).`,
    success: "\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0627\u0644\u0635\u0648\u0631.",
    tooMany: "\u064a\u0645\u0643\u0646 \u0631\u0641\u0639 \u0639\u062f\u062f \u0645\u062d\u062f\u062f \u0641\u0642\u0637 \u0644\u0625\u0643\u0645\u0627\u0644 \u0627\u0644\u062d\u062f \u0627\u0644\u0623\u0642\u0635\u0649.",
  },
};

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function endpoint(locale, query = "") {
  return `/${locale}/seller/product-images${query}`;
}

async function post(fields, locale) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  const response = await fetch(endpoint(locale), { method: "POST", body: form, credentials: "same-origin" });
  let result;
  try { result = await response.json(); } catch { throw new Error("request failed"); }
  if (!response.ok || result?.error) throw new Error(result?.error ?? "request failed");
  return result;
}

function uploadWithTus(file, ticket, onProgress) {
  return import("tus-js-client").then(({ Upload }) => new Promise((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: ticket.endpoint,
      headers: { "x-signature": ticket.token },
      metadata: {
        bucketName: "product-images",
        objectName: ticket.path,
        contentType: ticket.content_type,
        cacheControl: "3600",
      },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      uploadDataDuringCreation: true,
      storeFingerprintForResuming: false,
      removeFingerprintOnSuccess: true,
      onProgress(bytesSent, bytesTotal) {
        onProgress(bytesTotal > 0 ? Math.floor((bytesSent / bytesTotal) * 100) : 0);
      },
      onError: reject,
      onSuccess: resolve,
    });
    upload.start();
  }));
}

export default function ProductImageManager({ locale, shopId, productId }) {
  const text = COPY[locale] ?? COPY.en;
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [previews, setPreviews] = useState([]);
  const inputRef = useRef(null);
  const previewsRef = useRef([]);
  const url = endpoint(locale, `?shop_id=${encodeURIComponent(shopId)}&product_id=${encodeURIComponent(productId)}`);

  async function reload() {
    setMessage(text.loading);
    try {
      const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.images)) throw new Error("load failed");
      setImages(data.images);
      setMessage("");
    } catch {
      setMessage(text.unavailable);
    }
  }

  useEffect(() => {
    if (open) void reload();
  }, [open, locale, shopId, productId]);

  useEffect(() => () => previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview)), []);

  async function uploadFiles(event) {
    event.preventDefault();
    const selected = [...(inputRef.current?.files ?? [])];
    if (!selected.length || busy) return;
    previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
    previewsRef.current = selected.map((file) => URL.createObjectURL(file));
    setPreviews(selected.map((file, index) => ({ file, src: previewsRef.current[index] })));
    const valid = selected.filter((file) => IMAGE_TYPES.has(file.type) && file.size > 0 && file.size <= MAX_IMAGE_BYTES);
    const accepted = valid.slice(0, Math.max(0, 10 - images.length));
    setBusy(true);
    if (accepted.length !== selected.length) setMessage(valid.length !== selected.length ? text.invalid : text.tooMany);
    try {
      for (let index = 0; index < accepted.length; index += 1) {
        const file = accepted[index];
        setMessage(text.progress(index + 1, accepted.length, 0));
        const ticket = await post({
          intent: "begin-upload", shop_id: shopId, product_id: productId,
          content_type: file.type, size: String(file.size),
        }, locale);
        await uploadWithTus(file, ticket, (percent) => setMessage(text.progress(index + 1, accepted.length, percent)));
        await post({ intent: "finalize-upload", shop_id: shopId, product_id: productId, image_id: ticket.image_id }, locale);
      }
      if (accepted.length) setMessage(accepted.length < selected.length ? (valid.length !== selected.length ? text.invalid : text.tooMany) : text.success);
    } catch {
      setMessage(text.failed);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
      previewsRef.current.forEach((preview) => URL.revokeObjectURL(preview));
      previewsRef.current = [];
      setPreviews([]);
      await reload();
    }
  }

  async function removeImage(imageId) {
    setBusy(true);
    try {
      await post({ intent: "delete-image", shop_id: shopId, product_id: productId, image_id: imageId }, locale);
      setMessage(text.success);
    } catch {
      setMessage(text.deleting);
    } finally {
      setBusy(false);
      await reload();
    }
  }

  async function moveImage(index, direction) {
    const reordered = [...images];
    const target = index + direction;
    if (target < 0 || target >= reordered.length || reordered.some((image) => image.status !== "active")) return;
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setBusy(true);
    try {
      await post({ intent: "reorder-images", shop_id: shopId, product_id: productId, image_ids: JSON.stringify(reordered.map((image) => image.id)) }, locale);
      setImages(reordered.map((image, sort_order) => ({ ...image, sort_order })));
      setMessage(text.success);
    } catch {
      setMessage(text.failed);
    } finally {
      setBusy(false);
    }
  }

  const count = images.length;
  const canReorder = images.length > 1 && images.every((image) => image.status === "active");
  return <section className="product-image-manager">
    <button type="button" className="button button-secondary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>{text.manage}</button>
    {open && <div className="product-image-panel">
      <p>{text.limit}</p>
      {images.length === 0 && !message && <p>{text.empty}</p>}
      {images.length > 0 && <ol className="product-image-list">{images.map((image, index) => <li key={image.id}>
        {image.src && <img src={image.src} alt={`${locale === "ar" ? "\u0635\u0648\u0631\u0629" : "Photo"} ${index + 1}`} width="88" height="88" loading="lazy" />}
        <div><span>{image.status === "pending" ? text.pending : image.status === "deleting" ? text.deleting : `${index + 1}`}</span>
          {canReorder && <><button type="button" className="button button-secondary" disabled={busy || index === 0} onClick={() => void moveImage(index, -1)}>{text.moveUp}</button><button type="button" className="button button-secondary" disabled={busy || index === images.length - 1} onClick={() => void moveImage(index, 1)}>{text.moveDown}</button></>}
          <button type="button" className="button button-secondary" disabled={busy} onClick={() => void removeImage(image.id)}>{text.remove}</button>
        </div>
      </li>)}</ol>}
      {previews.length > 0 && <ol className="product-image-list" aria-label={locale === "ar" ? "\u0645\u0639\u0627\u064a\u0646\u0629 \u0627\u0644\u0635\u0648\u0631" : "Selected photo previews"}>{previews.map(({ file, src }) => <li key={src}><img src={src} alt={file.name} width="88" height="88" /> <span>{file.name}</span></li>)}</ol>}
      <form onSubmit={uploadFiles}>
        <label>{text.upload}<input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy || count >= 10} onChange={() => setMessage("")} /></label>
        <button className="button button-primary" type="submit" disabled={busy || count >= 10}>{text.upload}</button>
      </form>
      {message && <p role={message === text.failed || message === text.invalid || message === text.unavailable ? "alert" : "status"} aria-live="polite">{message}</p>}
    </div>}
  </section>;
}
