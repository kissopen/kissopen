/** Only browser-renderable images are requested; unsupported formats retain their file icon. */
export function libraryImageType(path: string): string | undefined {
    const extension = path.split(".").pop()?.toLowerCase();
    return (
        {
            png: "image/png",
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            gif: "image/gif",
            webp: "image/webp",
            svg: "image/svg+xml",
            bmp: "image/bmp",
            avif: "image/avif",
        } as Record<string, string>
    )[extension ?? ""];
}

/** Keep a small raster in memory, never original multi-megabyte data URLs. */
export async function libraryThumbnail(url: string): Promise<string | undefined> {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) return undefined;
    const scale = Math.min(1, 320 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.8);
}
