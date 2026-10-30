import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { hashImageUrl } from "@/utils/images/common";
import { ImageMetadataProvider } from "./ImageMetadataProvider";
import { MetadataImage } from "./MetadataImage";

/** Removing context propagation or deferring metadata to an effect loses geometry from the initial HTML. */
test("saved image dimensions and BlurHash are emitted in server HTML", () => {
  const src = "/images/portrait.jpg";
  const html = renderToStaticMarkup(
    <ImageMetadataProvider meta={{ images: { [hashImageUrl(src)]: { src, width: 400, height: 1200, blurhash: "000000", bytes: 2048 } } }}>
      <span className="relative">
        <MetadataImage src={src} alt="Portrait" reserveRatio />
      </span>
    </ImageMetadataProvider>,
  );
  assert.match(html, /<img[^>]+width="400"[^>]+height="1200"/);
  assert.match(html, /data-blurhash="000000"/);
  assert.match(html, /data-image-bytes="2048"/);
  assert.match(html, /aspect-ratio:400 \/ 1200/);
  assert.match(html, /<canvas[^>]+aria-hidden="true"/);
});
