/**
 * Single source of truth for how the product names and marks itself. (Fixes 1.2, 4.6)
 *
 * Naming: the sidebar said "Synthetic Data ROI", the header beside it said
 * "YData ROI Framework", the browser tab said "Synthetic Data ROI Calculator",
 * and the PPTX author string said the same — four names, none of which was the
 * name the project actually goes by.
 */
export const APP_NAME = "Synthetic Data ROI";
export const APP_SHORT_NAME = "Synthetic Data ROI";
export const APP_TAGLINE = "Internal ROI business case for a synthetic data initiative";
export const APP_ENDORSEMENT = "YData by";

/**
 * The KPMG wordmark for the blue sidebar.
 *
 * It used to be loaded from `kpmg-white.png.asset.json`, whose `url` field is a
 * Lovable-internal path (`/__l5e/assets-v1/...`). That file is not bundled by
 * Vite, so the mark was a broken image on every host except Lovable's preview.
 *
 * TO RESTORE THE OFFICIAL MARK:
 *   1. Save the approved white-on-transparent PNG to src/assets/kpmg-white.png
 *   2. Uncomment the import below and set KPMG_MARK_SRC to it
 *
 * Until then the sidebar renders a plain text wordmark, which is correct on the
 * blue bar and never shows a broken image.
 */
import kpmgWhite from "@/assets/kpmg-white.png";
export const KPMG_MARK_SRC: string | null = kpmgWhite;
