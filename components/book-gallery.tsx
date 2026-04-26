"use client";

import Image from "next/image";
import { useState } from "react";

type BookGalleryProps = {
  images: Array<{
    id: string;
    storagePath: string;
    caption: string | null;
    altText: string | null;
    fileName: string;
  }>;
};

const fallbackPath = "/uploads/demo/specimen-placeholder.svg";
const fallbackImage = {
  id: "fallback",
  storagePath: fallbackPath,
  caption: "No image uploaded yet.",
  altText: "Placeholder specimen illustration",
  fileName: "placeholder.svg"
};

export function BookGallery({ images }: BookGalleryProps) {
  const galleryImages = images.length > 0 ? images : [fallbackImage];
  const [selectedImageId, setSelectedImageId] = useState(galleryImages[0]?.id ?? "fallback");

  const selectedImage = galleryImages.find((image) => image.id === selectedImageId) ?? galleryImages[0];

  return (
    <section className="book-gallery" aria-label="Entry image gallery">
      <figure className="book-gallery__hero-frame">
        <div className="book-gallery__image-wrap book-gallery__image-wrap--hero">
          <Image
            alt={selectedImage.altText ?? selectedImage.caption ?? selectedImage.fileName}
            className="book-gallery__image"
            fill
            priority
            sizes="(min-width: 1024px) 40vw, 100vw"
            src={selectedImage.storagePath}
          />
        </div>
        <figcaption className="book-gallery__caption">
          <div className="book-gallery__caption-main">
            <strong>{selectedImage.caption ?? selectedImage.fileName}</strong>
            <span>{selectedImage.altText ?? "No alt text provided for this image."}</span>
          </div>
          <small>
            {galleryImages.findIndex((image) => image.id === selectedImage.id) + 1} of {galleryImages.length}
          </small>
        </figcaption>
      </figure>

      {galleryImages.length > 1 ? (
        <div className="book-gallery__thumbnail-rail" role="list" aria-label="Select gallery image">
          {galleryImages.map((image, index) => {
            const active = image.id === selectedImage.id;

            return (
              <button
                aria-current={active}
                aria-label={`Show image ${index + 1}: ${image.caption ?? image.fileName}`}
                className={active ? "book-gallery__thumbnail book-gallery__thumbnail--active" : "book-gallery__thumbnail"}
                key={image.id}
                onClick={() => setSelectedImageId(image.id)}
                type="button"
              >
                <div className="book-gallery__thumbnail-image-wrap">
                  <Image
                    alt={image.altText ?? image.caption ?? image.fileName}
                    className="book-gallery__image"
                    fill
                    sizes="(min-width: 1024px) 9vw, 22vw"
                    src={image.storagePath}
                  />
                </div>
                <span className="book-gallery__thumbnail-label">{image.caption ?? `Image ${index + 1}`}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}