"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";

type CategoryOption = {
  id: string;
  name: string;
  depth: number;
};

type InitialImage = {
  fileName: string;
  storagePath: string;
  altText?: string;
  caption?: string;
  sortOrder: number;
};

type ImageDraft = {
  clientId: string;
  fileName: string;
  storagePath?: string;
  previewSrc: string;
  altText: string;
  caption: string;
  sortOrder: number;
  file?: File;
  isPending: boolean;
};

type ObservationDraft = {
  clientId: string;
  title: string;
  notes: string;
  observedAt: string;
  locationText: string;
  habitatTagsInput: string;
  behaviorText: string;
};

type EntryFormProps = {
  categories: CategoryOption[];
  mode: "create" | "edit";
  entryId?: string;
  initialValues?: {
    categoryId: string;
    name?: string | null;
    description: string;
    identificationStatus: "CONFIRMED" | "POSSIBLE" | "UNKNOWN";
    locationText?: string | null;
    habitatText?: string | null;
    habitatTags: string[];
    behaviorText?: string | null;
    images: InitialImage[];
    observations: Array<{
      title?: string | null;
      notes: string;
      observedAt: string | Date;
      locationText?: string | null;
      habitatTags: string[];
      behaviorText?: string | null;
    }>;
  };
};

type IdentificationValue = "CONFIRMED" | "POSSIBLE" | "UNKNOWN";

const statusOptions = [
  { value: "UNKNOWN", label: "Unknown" },
  { value: "POSSIBLE", label: "Possible" },
  { value: "CONFIRMED", label: "Confirmed" }
] as const;

function createDraftId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function formatDateTimeLocal(value?: string | Date | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function createObservationDraft(observation?: NonNullable<EntryFormProps["initialValues"]>["observations"][number]): ObservationDraft {
  return {
    clientId: createDraftId(),
    title: observation?.title ?? "",
    notes: observation?.notes ?? "",
    observedAt: formatDateTimeLocal(observation?.observedAt) || formatDateTimeLocal(new Date()),
    locationText: observation?.locationText ?? "",
    habitatTagsInput: observation?.habitatTags.join(", ") ?? "",
    behaviorText: observation?.behaviorText ?? ""
  };
}

function hasObservationContent(observation: ObservationDraft) {
  return [
    observation.title,
    observation.notes,
    observation.locationText,
    observation.habitatTagsInput,
    observation.behaviorText
  ].some((value) => value.trim().length > 0);
}

function createStoredImageDraft(image: InitialImage): ImageDraft {
  return {
    clientId: createDraftId(),
    fileName: image.fileName,
    storagePath: image.storagePath,
    previewSrc: image.storagePath,
    altText: image.altText ?? "",
    caption: image.caption ?? "",
    sortOrder: image.sortOrder,
    isPending: false
  };
}

function normalizeImageOrder(images: ImageDraft[]) {
  return images.map((image, index) => ({
    ...image,
    sortOrder: index
  }));
}

export function EntryForm({ categories, entryId, initialValues, mode }: EntryFormProps) {
  const router = useRouter();
  const pendingObjectUrlsRef = useRef<Set<string>>(new Set());
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(initialValues?.description ?? "");
  const [categoryId, setCategoryId] = useState(initialValues?.categoryId ?? categories[0]?.id ?? "");
  const [identificationStatus, setIdentificationStatus] = useState<IdentificationValue>(initialValues?.identificationStatus ?? "UNKNOWN");
  const [locationText, setLocationText] = useState(initialValues?.locationText ?? "");
  const [habitatText, setHabitatText] = useState(initialValues?.habitatText ?? "");
  const [habitatTagsInput, setHabitatTagsInput] = useState(initialValues?.habitatTags.join(", ") ?? "");
  const [behaviorText, setBehaviorText] = useState(initialValues?.behaviorText ?? "");
  const [observations, setObservations] = useState<ObservationDraft[]>(() => initialValues?.observations.map(createObservationDraft) ?? []);
  const [images, setImages] = useState<ImageDraft[]>(() => normalizeImageOrder(initialValues?.images.map(createStoredImageDraft) ?? []));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const pendingObjectUrls = pendingObjectUrlsRef.current;

    return () => {
      pendingObjectUrls.forEach((url) => URL.revokeObjectURL(url));
      pendingObjectUrls.clear();
    };
  }, []);

  function revokePendingObjectUrl(url: string) {
    if (!pendingObjectUrlsRef.current.has(url)) {
      return;
    }

    URL.revokeObjectURL(url);
    pendingObjectUrlsRef.current.delete(url);
  }

  function addObservation() {
    setObservations((current) => [...current, createObservationDraft()]);
  }

  function updateObservation(clientId: string, updates: Partial<ObservationDraft>) {
    setObservations((current) =>
      current.map((observation) => (observation.clientId === clientId ? { ...observation, ...updates } : observation))
    );
  }

  function removeObservation(clientId: string) {
    setObservations((current) => current.filter((observation) => observation.clientId !== clientId));
  }

  function handleImageSelection(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);

    if (selectedFiles.length === 0) {
      return;
    }

    const newImages = selectedFiles.map((file) => {
      const previewSrc = URL.createObjectURL(file);
      pendingObjectUrlsRef.current.add(previewSrc);

      return {
        clientId: createDraftId(),
        fileName: file.name,
        previewSrc,
        altText: "",
        caption: "",
        sortOrder: 0,
        file,
        isPending: true
      } satisfies ImageDraft;
    });

    setImages((current) => normalizeImageOrder([...current, ...newImages]));
    event.target.value = "";
  }

  function updateImage(clientId: string, updates: Partial<ImageDraft>) {
    setImages((current) =>
      current.map((image) => (image.clientId === clientId ? { ...image, ...updates } : image))
    );
  }

  function moveImage(clientId: string, direction: -1 | 1) {
    setImages((current) => {
      const index = current.findIndex((image) => image.clientId === clientId);
      const nextIndex = index + direction;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const nextImages = [...current];
      const [movedImage] = nextImages.splice(index, 1);
      nextImages.splice(nextIndex, 0, movedImage);
      return normalizeImageOrder(nextImages);
    });
  }

  function removeImage(clientId: string) {
    setImages((current) => {
      const target = current.find((image) => image.clientId === clientId);
      if (target?.isPending) {
        revokePendingObjectUrl(target.previewSrc);
      }

      return normalizeImageOrder(current.filter((image) => image.clientId !== clientId));
    });
  }

  async function uploadPendingFiles(pendingImages: ImageDraft[]) {
    if (pendingImages.length === 0) {
      return [] as ImageDraft[];
    }

    const formData = new FormData();
    pendingImages.forEach((image) => {
      if (image.file) {
        formData.append("files", image.file);
      }
    });

    const uploadResponse = await fetch("/api/uploads", {
      method: "POST",
      body: formData
    });

    if (!uploadResponse.ok) {
      const errorPayload = (await uploadResponse.json().catch(() => null)) as { error?: string } | null;
      throw new Error(errorPayload?.error ?? "Image upload failed.");
    }

    const uploadPayload = (await uploadResponse.json()) as {
      images: Array<{
        fileName: string;
        storagePath: string;
      }>;
    };

    if (uploadPayload.images.length !== pendingImages.length) {
      throw new Error("Image upload response did not match the selected files.");
    }

    pendingImages.forEach((image) => revokePendingObjectUrl(image.previewSrc));

    return uploadPayload.images.map((image, index) => ({
      clientId: pendingImages[index].clientId,
      fileName: image.fileName,
      storagePath: image.storagePath,
      previewSrc: image.storagePath,
      altText: pendingImages[index].altText,
      caption: pendingImages[index].caption,
      sortOrder: pendingImages[index].sortOrder,
      isPending: false
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setFormError(null);

    try {
      const normalizedObservations = observations
        .filter(hasObservationContent)
        .map((observation) => ({
          title: observation.title.trim(),
          notes: observation.notes.trim(),
          observedAt: new Date(observation.observedAt || new Date()).toISOString(),
          locationText: observation.locationText.trim(),
          habitatTags: observation.habitatTagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          behaviorText: observation.behaviorText.trim()
        }));

      if (normalizedObservations.some((observation) => observation.notes.length < 3)) {
        throw new Error("Each saved observation needs at least a short note.");
      }

      const pendingImages = images.filter((image) => image.isPending);
      const uploadedImages = await uploadPendingFiles(pendingImages);
      const uploadedImageMap = new Map(uploadedImages.map((image) => [image.clientId, image]));
      const normalizedImages = normalizeImageOrder(
        images.map((image) => uploadedImageMap.get(image.clientId) ?? image)
      ).map((image) => {
        if (!image.storagePath) {
          throw new Error(`Image ${image.fileName} is missing a storage path.`);
        }

        return {
          fileName: image.fileName,
          storagePath: image.storagePath,
          altText: image.altText.trim() || undefined,
          caption: image.caption.trim() || undefined,
          sortOrder: image.sortOrder
        };
      });

      const response = await fetch(mode === "create" ? "/api/entries" : `/api/entries/${entryId}`, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          categoryId,
          name,
          description,
          identificationStatus,
          locationText,
          habitatText,
          habitatTags: habitatTagsInput
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          behaviorText,
          images: normalizedImages,
          observations: normalizedObservations
        })
      });

      const payload = (await response.json().catch(() => null)) as { error?: string; entry?: { id: string } } | null;

      if (!response.ok || !payload?.entry) {
        throw new Error(payload?.error ?? "Unable to save entry.");
      }

      router.push(`/entries/${payload.entry.id}`);
      router.refresh();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to save entry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <div className="entry-form__grid">
        <label className="field">
          <span>Name</span>
          <input onChange={(event) => setName(event.target.value)} placeholder="Optional common or working name" value={name} />
        </label>

        <label className="field">
          <span>Classification</span>
          <select onChange={(event) => setCategoryId(event.target.value)} value={categoryId}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {`${"· ".repeat(category.depth)}${category.name}`}
              </option>
            ))}
          </select>
        </label>

        <label className="field field--full">
          <span>Description</span>
          <textarea onChange={(event) => setDescription(event.target.value)} rows={5} value={description} />
        </label>

        <label className="field">
          <span>Identification status</span>
          <select onChange={(event) => setIdentificationStatus(event.target.value as typeof identificationStatus)} value={identificationStatus}>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Location</span>
          <input onChange={(event) => setLocationText(event.target.value)} placeholder="Forest edge, backyard, shoreline..." value={locationText} />
        </label>

        <label className="field field--full">
          <span>Habitat description</span>
          <textarea onChange={(event) => setHabitatText(event.target.value)} rows={3} value={habitatText} />
        </label>

        <label className="field field--full">
          <span>Habitat tags</span>
          <input onChange={(event) => setHabitatTagsInput(event.target.value)} placeholder="ground, tree, flying" value={habitatTagsInput} />
        </label>

        <label className="field field--full">
          <span>Observed behavior</span>
          <textarea onChange={(event) => setBehaviorText(event.target.value)} rows={3} value={behaviorText} />
        </label>

        <label className="field field--full">
          <span>Main image workflow</span>
          <small>Use the gallery manager below to add images, set a cover order, and edit caption and alt text before saving.</small>
        </label>
      </div>

      <section className="entry-form__section stack-sm">
        <div className="entry-form__section-header">
          <div className="stack-sm">
            <span className="eyebrow">Gallery manager</span>
            <p className="form-hint">The first image becomes the cover image in cards and book view. Reorder images to control presentation.</p>
          </div>
          <label className="button button--ghost button--small image-manager__upload-button">
            <span>Add images</span>
            <input accept="image/*" className="sr-only" multiple onChange={handleImageSelection} type="file" />
          </label>
        </div>

        {images.length > 0 ? (
          <div className="image-manager__grid">
            {images.map((image, index) => (
              <article className="image-manager__card" key={image.clientId}>
                <div className="image-manager__preview-wrap">
                  <Image
                    alt={image.altText || image.caption || image.fileName}
                    className="image-manager__preview"
                    fill
                    sizes="(min-width: 1024px) 24vw, (min-width: 640px) 40vw, 100vw"
                    src={image.previewSrc}
                    unoptimized
                  />
                </div>
                <div className="image-manager__meta stack-sm">
                  <div className="image-manager__card-header">
                    <div className="chip-row">
                      {index === 0 ? <span className="chip">Cover image</span> : null}
                      <span className="chip">{image.isPending ? "Pending upload" : "Saved image"}</span>
                    </div>
                    <small className="muted">{image.fileName}</small>
                  </div>
                  <div className="image-manager__actions">
                    <button className="button button--ghost button--small" disabled={index === 0} onClick={() => moveImage(image.clientId, -1)} type="button">
                      Move earlier
                    </button>
                    <button
                      className="button button--ghost button--small"
                      disabled={index === images.length - 1}
                      onClick={() => moveImage(image.clientId, 1)}
                      type="button"
                    >
                      Move later
                    </button>
                    <button className="button button--ghost button--small" onClick={() => removeImage(image.clientId)} type="button">
                      Remove
                    </button>
                  </div>
                  <label className="field">
                    <span>Caption</span>
                    <input onChange={(event) => updateImage(image.clientId, { caption: event.target.value })} placeholder="Leaf-top resting view" value={image.caption} />
                  </label>
                  <label className="field">
                    <span>Alt text</span>
                    <textarea
                      onChange={(event) => updateImage(image.clientId, { altText: event.target.value })}
                      placeholder="Describe the organism and visible context for screen readers."
                      rows={3}
                      value={image.altText}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No images selected yet. Add one or more images to build the entry gallery.</div>
        )}
      </section>

      <section className="entry-form__section stack-sm">
        <div className="entry-form__section-header">
          <div className="stack-sm">
            <span className="eyebrow">Observations</span>
            <p className="form-hint">Capture separate field moments with their own time, location, tags, and behavior notes.</p>
          </div>
          <button className="button button--ghost button--small" onClick={addObservation} type="button">
            Add observation
          </button>
        </div>

        {observations.length > 0 ? (
          <div className="observation-editor-list">
            {observations.map((observation, index) => (
              <article className="observation-editor" key={observation.clientId}>
                <div className="observation-editor__header">
                  <div className="stack-sm">
                    <strong>Observation {index + 1}</strong>
                    <span className="form-hint">These notes overwrite the current observation list for this entry.</span>
                  </div>
                  <button className="button button--ghost button--small" onClick={() => removeObservation(observation.clientId)} type="button">
                    Remove
                  </button>
                </div>
                <div className="observation-editor__grid">
                  <label className="field">
                    <span>Title</span>
                    <input
                      onChange={(event) => updateObservation(observation.clientId, { title: event.target.value })}
                      placeholder="Morning sighting"
                      value={observation.title}
                    />
                  </label>
                  <label className="field">
                    <span>Observed at</span>
                    <input
                      onChange={(event) => updateObservation(observation.clientId, { observedAt: event.target.value })}
                      type="datetime-local"
                      value={observation.observedAt}
                    />
                  </label>
                  <label className="field field--full">
                    <span>Notes</span>
                    <textarea
                      onChange={(event) => updateObservation(observation.clientId, { notes: event.target.value })}
                      placeholder="What was happening when you observed the specimen?"
                      rows={4}
                      value={observation.notes}
                    />
                  </label>
                  <label className="field">
                    <span>Observation location</span>
                    <input
                      onChange={(event) => updateObservation(observation.clientId, { locationText: event.target.value })}
                      placeholder="North side of stream"
                      value={observation.locationText}
                    />
                  </label>
                  <label className="field">
                    <span>Observation habitat tags</span>
                    <input
                      onChange={(event) => updateObservation(observation.clientId, { habitatTagsInput: event.target.value })}
                      placeholder="stream, canopy, feeding"
                      value={observation.habitatTagsInput}
                    />
                  </label>
                  <label className="field field--full">
                    <span>Observation behavior</span>
                    <textarea
                      onChange={(event) => updateObservation(observation.clientId, { behaviorText: event.target.value })}
                      rows={3}
                      value={observation.behaviorText}
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">No observation blocks yet. Add one when you want to capture a dated field note alongside the main entry summary.</div>
        )}
      </section>

      {formError ? <p className="form-error">{formError}</p> : null}

      <div className="entry-form__actions">
        <button className="button" disabled={isSubmitting} type="submit">
          {isSubmitting ? "Saving..." : mode === "create" ? "Create entry" : "Save changes"}
        </button>
      </div>
    </form>
  );
}