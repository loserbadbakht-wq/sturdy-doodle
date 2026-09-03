// ===== Helper functions =====
function encodeUrl(url) {
  return btoa(url)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function decodeUrl(hash) {
  let base64 = hash.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) base64 += '=';
  return atob(base64);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const baseUrl = url.origin;
    const isEmbed = url.searchParams.get('embed') === '1';

    // ----- oEmbed endpoint -----
    if (url.pathname === '/oembed') {
      const requestedUrl = url.searchParams.get('url') || '';
      let hash = '';
      try {
        const reqUrl = new URL(requestedUrl);
        if (reqUrl.pathname.startsWith('/watch/')) {
          hash = reqUrl.pathname.split('/watch/')[1];
        }
      } catch {}
      const videoUrl = hash ? decodeUrl(hash) : '';

      const iframeSrc = `${baseUrl}/watch/${hash}?embed=1`;
      const iframeHtml = `<iframe src="${iframeSrc}" width="100%" height="190" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;

      return new Response(JSON.stringify({
        version: '1.0',
        type: 'rich',
        provider_name: 'MyPlayer',
        provider_url: baseUrl,
        title: videoUrl ? videoUrl.split('/').pop() : 'Video Player',
        html: iframeHtml,
        width: 640,
        height: 400,
        thumbnail_url: 'https://via.placeholder.com/640x360/1DB954/000000?text=Video',
        thumbnail_width: 640,
        thumbnail_height: 360
      }), {
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    // ----- Main player page -----
    let videoUrl = '';
    let hash = '';

    if (url.pathname.startsWith('/watch/')) {
      hash = url.pathname.split('/watch/')[1];
      if (hash) {
        try {
          videoUrl = decodeUrl(hash);
        } catch {
          videoUrl = '';
        }
      }
    }

    if (!videoUrl) {
      const direct = url.searchParams.get('video');
      if (direct) {
        videoUrl = direct;
      }
    }

    const title = videoUrl ? videoUrl.split('/').pop() : 'My Video Player';
    const thumbnail = url.searchParams.get('thumb') || 'https://via.placeholder.com/640x360/1DB954/000000?text=Video';
    const pageUrl = hash ? `${baseUrl}/watch/${hash}` : url.href;
    const oembedPageUrl = hash ? `${baseUrl}/watch/${hash}` : url.href;

    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
    <title>__TITLE__</title>

    <meta property="og:title" content="__TITLE__" />
    <meta property="og:description" content="Watch this video on MyPlayer" />
    <meta property="og:image" content="__THUMBNAIL__" />
    <meta property="og:url" content="__PAGE_URL__" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />

    <link rel="alternate" type="application/json+oembed" 
          href="__BASE_URL__/oembed?url=__ENCODED_PAGE_URL__" />

    <script type="module" src="https://cdn.jsdelivr.net/npm/@videojs/html@10.0.0-beta.31/cdn/video.js"></script>
    <style>
      /* ===== YOUR PROVIDED CSS (inlined) ===== */
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        background-color: #141414;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        font-family: sans-serif;
        padding: 20px;
      }
      .main-container {
        width: 100%;
        max-width: 800px;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0,0,0,0.8);
      }
      .player-wrapper {
        position: relative;
        background: #000;
        aspect-ratio: 16 / 9;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        touch-action: none;
      }
      /* Insert all your custom CSS here (the huge block you provided) */
      /* For brevity, I'm including only the essential parts; you should paste the entire CSS you provided */
      video-player,
      live-video-player,
      media-i18n,
      media-dialog,
      media-alert-dialog,
      media-error-dialog,
      media-controls {
        display: contents;
      }
      media-container video,
      media-container [slot="poster"] {
        display: block;
        width: 100%;
        height: 100%;
      }
      media-container video::-webkit-media-text-track-container {
        z-index: 1;
        font-family: inherit;
        scale: 0.98;
        translate: 0 var(--media-caption-track-y, 0);
        transition: translate var(--media-caption-track-duration, 0) ease-out;
        transition-delay: var(--media-caption-track-delay, 0);
      }
      media-tooltip-group,
      media-dialog,
      media-alert-dialog,
      media-error-dialog,
      media-controls {
        display: contents;
      }
      :host {
        display: grid;
        width: 100%;
      }
      media-container {
        min-width: 0;
        min-height: 0;
      }
      .media-popover--volume:has(media-volume-slider[data-hidden]) {
        display: none;
      }
      .media-sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        white-space: nowrap;
        border: 0;
        clip: rect(0, 0, 0, 0);
      }
      .media-default-skin *,
      .media-default-skin *::before,
      .media-default-skin *::after {
        box-sizing: border-box;
      }
      .media-default-skin img,
      .media-default-skin video,
      .media-default-skin svg {
        display: block;
        max-width: 100%;
      }
      .media-default-skin button {
        font: inherit;
      }
      .media-default-skin [hidden][hidden] {
        display: none;
      }
      @media (prefers-reduced-motion: no-preference) {
        .media-default-skin {
          interpolate-size: allow-keywords;
        }
      }
      .media-default-skin {
        --media-internal-accent-color: var(--media-accent-color, var(--media-default-accent-color));
        --media-accent-contrast-color: contrast-color(var(--media-internal-accent-color));
        --media-accent-background-color: var(
          --media-accent-color,
          oklch(from var(--media-default-accent-color) l c h / calc(alpha * 0.1))
        );
        --media-internal-accent-text-color: var(
          --media-accent-text-color,
          contrast-color(var(--media-accent-color, oklch(0 0 0)))
        );
        --media-shadow-current-color: oklch(from currentColor 0 0 0 / clamp(0, calc((l - 0.5) * 0.5), 0.15));
        --media-shadow-subtle-current-color: oklch(from var(--media-shadow-current-color) l c h / calc(alpha * 0.4));
        --media-scrollbar-thumb-color: oklch(from currentColor l c h / 0.3);
        --media-scale: 1;
        --media-internal-scale-unit: var(--media-scale-unit, 16px);
        --media-size: calc(var(--media-internal-scale-unit) * var(--media-scale));
        --media-spacing: calc(var(--media-size) / 4);
        --media-font-size-medium: calc(0.9375 * var(--media-size));
        --media-font-size-base: calc(0.8125 * var(--media-size));
        --media-font-size-small: calc(0.6875 * var(--media-size));
        --media-font-size-tiny: calc(0.5625 * var(--media-size));
        --media-icon-size: calc(1.125 * var(--media-size));
        --media-container-border-radius: var(--media-border-radius, 1.75rem);
        position: relative;
        display: block;
        width: 100%;
        height: 100%;
        container: media-root / inline-size;
        font-family:
          Inter Variable,
          Inter,
          ui-sans-serif,
          system-ui,
          sans-serif;
        font-size: var(--media-font-size-base);
        -webkit-font-smoothing: auto;
        -moz-osx-font-smoothing: auto;
        line-height: 1.5;
        letter-spacing: normal;
        outline: 2px solid transparent;
        outline-offset: -4px;
        scrollbar-color: var(--media-scrollbar-thumb-color) transparent;
        scrollbar-width: thin;
        border-radius: var(--media-container-border-radius, 1.75rem);
        isolation: isolate;
        transition-timing-function: ease-out;
        transition-duration: 100ms;
        transition-property: outline-offset, outline-color;
      }
      .media-default-skin:focus-visible {
        outline-color: var(--media-focus-ring-color);
        outline-offset: 2px;
      }
      .media-default-skin::-webkit-scrollbar-thumb {
        background: var(--media-scrollbar-thumb-color);
        border-radius: 9999px;
      }
      @media (prefers-reduced-transparency: reduce) or (prefers-contrast: more) {
        .media-default-skin {
          --media-scrollbar-thumb-color: oklch(from currentColor l c h / 0.8);
          scrollbar-width: auto;
        }
      }
      .media-default-skin .media-surface {
        background-color: var(--media-surface-background-color);
        box-shadow:
          0 0 0 1px var(--media-surface-outer-border-color),
          0 1px 3px 0 var(--media-surface-shadow-color),
          0 1px 2px -1px var(--media-surface-shadow-color);
        backdrop-filter: var(--media-surface-backdrop-filter);
      }
      .media-default-skin .media-surface::after {
        position: absolute;
        inset: 0;
        z-index: 10;
        pointer-events: none;
        content: "";
        border-radius: inherit;
        box-shadow:
          inset 0 1px 0 0 var(--media-surface-inner-border-color),
          inset 0 0 0 1px oklch(from var(--media-surface-inner-border-color) l c h / calc(alpha * 0.5));
      }
      .media-default-skin ::slotted(video),
      .media-default-skin video {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: var(--media-object-fit, contain);
        object-position: var(--media-object-position, center);
      }
      .media-default-skin ::slotted(video) {
        border-radius: var(--media-container-border-radius);
      }
      .media-default-skin video {
        border-radius: inherit;
      }
      .media-default-skin:fullscreen ::slotted(video),
      .media-default-skin:fullscreen video {
        object-fit: contain;
      }
      .media-default-skin .media-controls__backdrop {
        position: absolute;
        inset: 0;
        z-index: 10;
        pointer-events: none;
        background-image: linear-gradient(to top, oklch(0 0 0 / 0.5), oklch(0 0 0 / 0.3) 25%, oklch(0 0 0 / 0));
        border-radius: inherit;
        opacity: 0;
        transition-timing-function: ease-out;
        transition-duration: var(--media-controls-transition-duration);
        transition-property: opacity;
      }
      .media-default-skin .media-controls__backdrop[data-visible] {
        opacity: 1;
      }
      .media-default-skin .media-buffering-indicator {
        position: absolute;
        inset: 0;
        z-index: 10;
        display: none;
        place-content: center;
        color: oklch(1 0 0);
        pointer-events: none;
      }
      .media-default-skin .media-buffering-indicator::before {
        position: absolute;
        inset: 0;
        content: "";
        background: oklch(0 0 0 / 0.35);
        backdrop-filter: blur(8px);
      }
      .media-default-skin .media-buffering-indicator > * {
        position: relative;
        z-index: 20;
      }
      .media-default-skin .media-buffering-indicator:not([data-visible]) {
        --media-spinner-animation: none;
      }
      .media-default-skin .media-buffering-indicator[data-visible] {
        display: grid;
      }
      @media (prefers-reduced-motion: reduce) {
        .media-default-skin .media-buffering-indicator {
          --media-spinner-animation: none;
        }
      }
      .media-default-skin media-error-dialog {
        position: absolute;
        inset: 0;
        z-index: 20;
        display: flex;
        align-items: center;
        justify-content: center;
        outline: none;
      }
      .media-default-skin media-error-dialog:not([data-open]) {
        display: none;
      }
      .media-default-skin .media-dialog__backdrop {
        position: absolute;
        inset: 0;
        z-index: 10;
        pointer-events: none;
        background: oklch(0 0 0 / 0.2);
        backdrop-filter: blur(16px) saturate(1.5);
        opacity: 1;
        transition-timing-function: var(--media-dialog-transition-timing-function);
        transition-duration: var(--media-dialog-transition-duration);
        transition-property: opacity;
        transition-delay: var(--media-dialog-transition-delay);
      }
      .media-default-skin .media-dialog__backdrop[data-starting-style],
      .media-default-skin .media-dialog__backdrop[data-ending-style] {
        opacity: 0;
      }
      .media-default-skin .media-dialog__backdrop[data-ending-style] {
        transition-delay: 0ms;
      }
      .media-default-skin .media-dialog__backdrop:not([data-open]) {
        display: none;
      }
      .media-default-skin .media-dialog__popup {
        outline: none;
      }
      .media-default-skin .media-dialog__title {
        font-weight: 600;
        line-height: 1.25;
      }
      .media-default-skin .media-dialog__description {
        overflow-wrap: anywhere;
        opacity: 0.7;
      }
      .media-default-skin .media-dialog__actions {
        display: flex;
        gap: calc(var(--media-spacing) * 2);
      }
      .media-default-skin .media-dialog__actions > * {
        flex: 1;
      }
      .media-default-skin .media-controls {
        --media-popover-side-offset: calc(var(--media-spacing) * (var(--media-base-side-offset, 2) + 1));
        --media-tooltip-side-offset: var(--media-popover-side-offset);
        --media-popover-boundary-offset: calc(var(--media-spacing) * var(--media-base-boundary-offset, 2));
        --media-tooltip-boundary-offset: var(--media-popover-boundary-offset);
        display: flex;
        align-items: center;
        padding: calc(var(--media-spacing) * 1);
        container: media-controls / inline-size;
        text-shadow: 0 1px 0 var(--media-shadow-current-color);
        border-radius: calc(Infinity * 1px);
      }
      .media-default-skin .media-controls:dir(rtl) {
        flex-direction: row-reverse;
      }
      .media-default-skin .media-time-controls {
        display: flex;
        flex: 1;
        gap: calc(var(--media-spacing) * 2.5);
        align-items: center;
        container: media-time-controls / inline-size;
      }
      .media-default-skin .media-time-controls:dir(rtl) {
        flex-direction: row-reverse;
      }
      .media-default-skin .media-time-controls > .media-time:last-child {
        @container media-time-controls (width < 16rem) {
          display: none;
        }
      }
      .media-default-skin .media-time {
        font-variant-numeric: tabular-nums;
      }
      .media-default-skin .media-time[role="button"] {
        cursor: pointer;
        outline: 2px solid transparent;
        outline-offset: -2px;
        border-radius: calc(var(--media-spacing) * 1);
        transition-timing-function: ease-out;
        transition-duration: 100ms;
        transition-property: outline-color, outline-offset;
      }
      .media-default-skin .media-time[role="button"]:focus-visible {
        outline-color: var(--media-focus-ring-color);
        outline-offset: 2px;
      }
      .media-default-skin .media-button {
        display: flex;
        flex-shrink: 0;
        align-items: center;
        justify-content: center;
        height: calc(var(--media-spacing) * 9);
        min-height: 0;
        padding: calc(var(--media-spacing) * 2) calc(var(--media-spacing) * 4);
        text-align: center;
        touch-action: manipulation;
        cursor: pointer;
        user-select: none;
        outline: 2px solid transparent;
        outline-offset: -2px;
        border: none;
        border-radius: calc(Infinity * 1px);
        transition-timing-function: ease-out;
        transition-duration: 150ms;
        transition-property: background-color, color, outline-offset, scale;
        will-change: scale;
      }
      .media-default-skin .media-button:focus-visible {
        outline-color: var(--media-focus-ring-color);
        outline-offset: 2px;
      }
      .media-default-skin .media-button:active:not([aria-disabled="true"]) {
        scale: 0.97;
      }
      .media-default-skin .media-button[aria-disabled="true"] {
        cursor: not-allowed;
        opacity: 0.5;
      }
      .media-default-skin .media-button--primary {
        font-weight: 500;
        color: var(--media-accent-contrast-color);
        text-shadow: none;
        background: var(--media-internal-accent-color);
      }
      .media-default-skin .media-button--subtle {
        color: inherit;
        text-shadow: inherit;
        background: transparent;
      }
      .media-default-skin .media-button--subtle:not([aria-disabled="true"]):hover,
      .media-default-skin .media-button--subtle:not([aria-disabled="true"]):focus-visible,
      .media-default-skin .media-button--subtle:not([aria-disabled="true"])[aria-expanded="true"] {
        color: var(--media-internal-accent-text-color);
        text-decoration: none;
        background-color: var(--media-accent-background-color);
      }
      .media-default-skin .media-button--icon {
        display: grid;
        aspect-ratio: 1;
        padding: 0;
      }
      .media-default-skin .media-button--icon:active:not([aria-disabled="true"]) {
        scale: 0.97;
      }
      .media-default-skin .media-button--icon .media-icon__container {
        display: grid;
      }
      .media-default-skin .media-button--icon .media-icon {
        grid-area: 1 / 1;
        filter: drop-shadow(0 1px 0 var(--media-shadow-current-color));
        transition-timing-function: ease-out;
        transition-duration: 150ms;
        transition-property: opacity, scale;
      }
      .media-default-skin .media-button--seek .media-icon__label {
        position: absolute;
        right: -1px;
        bottom: -3px;
        font-size: 0.715em;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.05em;
      }
      .media-default-skin .media-button--seek:has(.media-icon--flipped) .media-icon__label {
        right: unset;
        left: -1px;
      }
      .media-default-skin .media-button--playback-rate {
        padding: 0;
        font-variant-numeric: tabular-nums;
      }
      .media-default-skin .media-button--playback-rate::after {
        width: 4ch;
        content: attr(data-rate) "\\00D7";
      }
      .media-default-skin .media-button--playback-rate[data-inline-rate-label]::after {
        content: none;
      }
      .media-default-skin .media-button--settings .media-icon--settings {
        transition: transform 150ms ease-in-out;
      }
      @media (prefers-reduced-motion: reduce) {
        .media-default-skin .media-button--settings .media-icon--settings {
          transition-duration: 0ms;
        }
      }
      .media-default-skin .media-button--settings[aria-expanded="true"] .media-icon--settings {
        transform: rotate(90deg);
      }
      .media-default-skin .media-button--live {
        display: inline-flex;
        gap: calc(var(--media-spacing) * 1.5);
        align-items: center;
        width: auto;
        aspect-ratio: auto;
        padding: calc(var(--media-spacing) * 2) calc(var(--media-spacing) * 3);
        font-size: var(--media-font-size-small);
        font-weight: 600;
        line-height: 1;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }
      .media-default-skin .media-button--live::before {
        display: inline-block;
        flex-shrink: 0;
        width: calc(var(--media-spacing) * 2);
        height: calc(var(--media-spacing) * 2);
        content: "";
        background-color: oklch(from currentColor l c h / 0.4);
        border-radius: 50%;
        transition: background-color 150ms ease-out;
      }
      .media-default-skin .media-button--live[data-live-edge]::before {
        background-color: oklch(0.65 0.22 27);
      }
      @media (prefers-reduced-motion: reduce) {
        .media-default-skin .media-button {
          scale: 1;
          transition-property: background-color, color;
          will-change: auto;
        }
      }
      .media-default-skin .media-button-group {
        display: flex;
        gap: 1px;
        align-items: center;
      }
      .media-default-skin .media-button-group:dir(rtl) {
        flex-direction: row-reverse;
      }
      .media-default-skin .media-badge {
        padding: calc(var(--media-spacing) * 0.5) calc(var(--media-spacing) * 1.5);
        font-size: var(--media-font-size-small);
        font-weight: 500;
        line-height: 1;
        color: oklch(from currentColor l c h / 0.85);
        white-space: nowrap;
        background-color: oklch(from currentColor l c h / 0.1);
        border-radius: calc(Infinity * 1px);
      }
      .media-default-skin .media-icon__container {
        position: relative;
      }
      .media-default-skin .media-icon {
        flex-shrink: 0;
        width: var(--media-icon-size);
        height: var(--media-icon-size);
      }
      .media-default-skin .media-icon--flipped,
      .media-default-skin:dir(rtl) .media-menu__chevron {
        scale: -1 1;
      }
      .media-default-skin:dir(rtl) .media-menu__chevron.media-icon--flipped {
        scale: 1 1;
      }
      .media-default-skin media-poster,
      .media-default-skin > img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        transition: opacity 0.25s;
      }
      .media-default-skin media-poster:not([data-visible]),
      .media-default-skin > img:not([data-visible]) {
        opacity: 0;
      }
      .media-default-skin media-poster ::slotted(img),
      .media-default-skin media-poster img {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
        object-fit: var(--media-object-fit, contain);
        object-position: var(--media-object-position, center);
        border-radius: var(--media-container-border-radius);
      }
      .media-default-skin > img {
        object-fit: var(--media-object-fit, contain);
        object-position: var(--media-object-position, center);
        border-radius: inherit;
      }
      .media-default-skin:fullscreen media-poster ::slotted(img),
      .media-default-skin:fullscreen media-poster img,
      .media-default-skin:fullscreen > img {
        object-fit: contain;
      }
      .media-default-skin .media-thumbnail {
        position: relative;
        pointer-events: none;
        background-color: oklch(0 0 0 / 0.9);
        border-radius: calc(var(--media-spacing) * 3);
      }
      .media-default-skin .media-thumbnail .media-thumbnail__image {
        position: relative;
        display: block;
        max-width: var(--media-thumbnail-max-width);
        max-height: var(--media-thumbnail-max-height);
        overflow: clip;
        border-radius: inherit;
      }
      .media-default-skin .media-thumbnail .media-thumbnail__image::after {
        position: absolute;
        inset: 0;
        content: "";
        background-image: linear-gradient(to top, oklch(0 0 0 / 0.5), oklch(0 0 0 / 0.1), oklch(0 0 0 / 0));
        border-radius: inherit;
      }
      .media-default-skin .media-thumbnail .media-thumbnail__spinner {
        position: absolute;
        top: 50%;
        left: 50%;
        opacity: 0;
        translate: -50% -50%;
      }
      .media-default-skin .media-thumbnail .media-thumbnail__image,
      .media-default-skin .media-thumbnail .media-thumbnail__spinner {
        transition: opacity 150ms ease-out;
      }
      .media-default-skin .media-thumbnail:not(:has(.media-thumbnail__image[data-loading])) {
        .media-thumbnail__spinner {
          --media-spinner-animation: none;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .media-default-skin .media-thumbnail {
          --media-spinner-animation: none;
        }
      }
      .media-default-skin .media-thumbnail:has(.media-thumbnail__image[data-loading]) {
        width: var(--media-thumbnail-max-width);
        max-width: 100%;
        aspect-ratio: 16 / 9;
        overflow: hidden;
      }
      .media-default-skin .media-thumbnail:has(.media-thumbnail__image[data-loading]) .media-thumbnail__image {
        opacity: 0;
      }
      .media-default-skin .media-thumbnail:has(.media-thumbnail__image[data-loading]) .media-thumbnail__spinner {
        opacity: 1;
      }
      .media-default-skin .media-slider {
        --media-track-size: calc(var(--media-spacing) * 1);
        --media-track-highlighted-size: calc(var(--media-spacing) * 1.75);
        --media-track-border-radius: 99px;
        --media-track-transition-duration: 100ms;
        --media-thumb-size: calc(var(--media-spacing) * 3);
        --media-chapter-gap: calc(var(--media-spacing) * 1);
        --media-internal-chapter-inset-start: calc(var(--media-chapter-gap) / 2);
        --media-internal-chapter-inset-end: calc(var(--media-chapter-gap) / 2);
        position: relative;
        display: flex;
        flex: 1;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        outline: none;
      }
      .media-default-skin .media-slider[data-orientation="horizontal"] {
        width: var(--media-slider-width, 100%);
        min-width: calc(var(--media-spacing) * 20);
        height: var(--media-slider-height, calc(var(--media-spacing) * 8));
      }
      .media-default-skin .media-slider[data-orientation="vertical"] {
        width: var(--media-slider-width, calc(var(--media-spacing) * 8));
        height: var(--media-slider-height, calc(var(--media-spacing) * 20));
      }
      .media-default-skin .media-slider .media-slider__track {
        position: relative;
        overflow: hidden;
        user-select: none;
        background-color: oklch(from currentColor l c h / 0.2);
        border-radius: var(--media-track-border-radius);
        isolation: isolate;
      }
      .media-default-skin .media-slider .media-slider__track[data-orientation="horizontal"] {
        width: 100%;
        height: var(--media-track-size);
      }
      .media-default-skin .media-slider .media-slider__track[data-orientation="vertical"] {
        width: var(--media-track-size);
        height: 100%;
      }
      .media-default-skin .media-slider .media-slider__buffer,
      .media-default-skin .media-slider .media-slider__fill {
        position: absolute;
        pointer-events: none;
        border-radius: inherit;
      }
      .media-default-skin .media-slider .media-slider__buffer[data-orientation="horizontal"],
      .media-default-skin .media-slider .media-slider__fill[data-orientation="horizontal"] {
        inset-block: 0;
        left: 0;
        width: 100%;
      }
      .media-default-skin .media-slider .media-slider__buffer[data-orientation="vertical"],
      .media-default-skin .media-slider .media-slider__fill[data-orientation="vertical"] {
        inset-inline: 0;
        bottom: 0;
        height: 100%;
      }
      @media (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-slider .media-slider__buffer,
        .media-default-skin .media-slider .media-slider__fill {
          transition: clip-path var(--media-track-transition-duration) ease-out;
        }
      }
      .media-default-skin .media-slider[data-dragging] .media-slider__fill,
      .media-default-skin .media-slider[data-dragging] .media-slider__buffer {
        transition-duration: 0ms;
      }
      .media-default-skin .media-slider .media-slider__buffer {
        background-color: oklch(from currentColor l c h / 0.2);
      }
      .media-default-skin .media-slider .media-slider__buffer[data-orientation="horizontal"] {
        clip-path: inset(0 calc(100% - var(--media-slider-buffer)) 0 0 round var(--media-track-border-radius));
      }
      .media-default-skin .media-slider .media-slider__buffer[data-orientation="vertical"] {
        clip-path: inset(calc(100% - var(--media-slider-buffer)) 0 0 0 round var(--media-track-border-radius));
      }
      .media-default-skin .media-slider .media-slider__fill {
        background-color: var(--media-internal-accent-color);
      }
      .media-default-skin .media-slider .media-slider__fill[data-orientation="horizontal"] {
        clip-path: inset(0 calc(100% - var(--media-slider-fill)) 0 0 round var(--media-track-border-radius));
      }
      .media-default-skin .media-slider .media-slider__fill[data-orientation="vertical"] {
        clip-path: inset(calc(100% - var(--media-slider-fill)) 0 0 0 round var(--media-track-border-radius));
      }
      .media-default-skin .media-slider[data-dragging] .media-slider__fill[data-orientation="horizontal"] {
        clip-path: inset(0 calc(100% - var(--media-slider-pointer)) 0 0 round var(--media-track-border-radius));
      }
      .media-default-skin .media-slider[data-dragging] .media-slider__fill[data-orientation="vertical"] {
        clip-path: inset(calc(100% - var(--media-slider-pointer)) 0 0 0 round var(--media-track-border-radius));
      }
      .media-default-skin .media-slider .media-slider__chapters {
        position: relative;
        display: flex;
        flex: 1;
        align-items: center;
        min-width: 0;
        min-height: 0;
        border-radius: inherit;
      }
      .media-default-skin .media-slider .media-slider__chapters[data-orientation="horizontal"] {
        width: 100%;
        height: 100%;
      }
      .media-default-skin .media-slider .media-slider__chapters[data-orientation="vertical"] {
        flex-direction: column-reverse;
        width: 100%;
        height: 100%;
      }
      .media-default-skin .media-slider .media-slider__chapter {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        min-width: 0;
        min-height: 0;
        border-radius: inherit;
      }
      .media-default-skin .media-slider .media-slider__chapter:first-child {
        --media-internal-chapter-inset-start: 0px;
      }
      .media-default-skin .media-slider .media-slider__chapter:last-child {
        --media-internal-chapter-inset-end: 0px;
      }
      .media-default-skin .media-slider .media-slider__chapter .media-slider__chapter-track {
        border-radius: inherit;
      }
      @media (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-slider .media-slider__chapter .media-slider__chapter-track {
          transition: 200ms ease-out;
          transition-property: height, width;
        }
      }
      .media-default-skin .media-slider .media-slider__chapter[data-orientation="horizontal"] {
        clip-path: inset(0 calc(100% - var(--media-slider-chapter-end)) 0 var(--media-slider-chapter-start));
      }
      .media-default-skin .media-slider .media-slider__chapter[data-orientation="horizontal"] .media-slider__chapter-track {
        height: var(--media-track-size);
        clip-path: inset(
          0 calc(100% - var(--media-slider-chapter-end) + var(--media-internal-chapter-inset-end)) 0
            calc(var(--media-slider-chapter-start) + var(--media-internal-chapter-inset-start)) round
            var(--media-track-border-radius)
        );
      }
      .media-default-skin .media-slider .media-slider__chapter[data-orientation="horizontal"][data-highlighted] .media-slider__chapter-track {
        height: var(--media-track-highlighted-size);
      }
      .media-default-skin .media-slider .media-slider__chapter[data-orientation="vertical"] {
        clip-path: inset(calc(100% - var(--media-slider-chapter-end)) 0 var(--media-slider-chapter-start) 0);
      }
      .media-default-skin .media-slider .media-slider__chapter[data-orientation="vertical"] .media-slider__chapter-track {
        width: var(--media-track-size);
        clip-path: inset(
          calc(100% - var(--media-slider-chapter-end) + var(--media-internal-chapter-inset-end)) 0
            calc(var(--media-slider-chapter-start) + var(--media-internal-chapter-inset-start)) 0 round
            var(--media-track-border-radius)
        );
      }
      .media-default-skin .media-slider .media-slider__chapter[data-orientation="vertical"][data-highlighted] .media-slider__chapter-track {
        width: var(--media-track-highlighted-size);
      }
      .media-default-skin .media-slider .media-slider__thumb {
        position: absolute;
        z-index: 10;
        width: var(--media-thumb-size);
        height: var(--media-thumb-size);
        user-select: none;
        outline: 4px solid transparent;
        outline-offset: -4px;
        background-color: currentColor;
        border-radius: calc(Infinity * 1px);
        box-shadow:
          0 0 0 1px var(--media-shadow-current-color, oklch(0 0 0 / 0.1)),
          0 1px 3px 0 oklch(0 0 0 / 0.35),
          0 1px 2px -1px oklch(0 0 0 / 0.35);
        opacity: 0;
        scale: 0.8;
        translate: -50% -50%;
      }
      .media-default-skin .media-slider .media-slider__thumb[data-orientation="horizontal"] {
        top: 50%;
        left: var(--media-slider-fill);
      }
      .media-default-skin .media-slider .media-slider__thumb[data-orientation="vertical"] {
        top: calc(100% - var(--media-slider-fill));
        left: 50%;
      }
      .media-default-skin .media-slider .media-slider__thumb:focus-visible {
        outline-color: oklch(from currentColor l c h / 0.15);
        outline-offset: 0;
        opacity: 1;
      }
      .media-default-skin .media-slider .media-slider__thumb::after {
        position: absolute;
        inset: -4px;
        content: "";
        border-radius: inherit;
        box-shadow: 0 0 0 2px currentColor;
      }
      .media-default-skin .media-slider .media-slider__thumb:not(:focus-visible)::after {
        opacity: 0;
        scale: 0.5;
      }
      .media-default-skin .media-slider .media-slider__thumb.media-slider__thumb--persistent {
        opacity: 1;
        scale: 1;
      }
      @media (hover: hover) and (pointer: fine) {
        .media-default-skin .media-slider .media-slider__thumb:hover {
          outline-color: oklch(from currentColor l c h / 0.15);
          outline-offset: 0;
        }
      }
      @media (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-slider .media-slider__thumb {
          transition-timing-function: ease-out;
          transition-duration: var(--media-track-transition-duration);
          transition-property: opacity, outline-offset, left, top, scale;
        }
        .media-default-skin .media-slider .media-slider__thumb::after {
          transition-timing-function: ease-out;
          transition-duration: 150ms;
          transition-property: opacity, scale;
        }
      }
      @media (hover: hover) and (pointer: fine) {
        .media-default-skin .media-slider:hover .media-slider__thumb {
          opacity: 1;
          scale: 1;
        }
      }
      .media-default-skin .media-slider[data-dragging] .media-slider__thumb {
        opacity: 1;
        scale: 0.9;
      }
      @media (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-slider[data-dragging] .media-slider__thumb {
          transition-property: opacity, outline-offset, scale;
        }
      }
      .media-default-skin .media-slider[data-dragging] .media-slider__thumb[data-orientation="horizontal"] {
        left: var(--media-slider-pointer);
      }
      .media-default-skin .media-slider[data-dragging] .media-slider__thumb[data-orientation="vertical"] {
        top: calc(100% - var(--media-slider-pointer));
      }
      .media-default-skin .media-slider .media-slider__preview {
        --media-max-size-factor: 36;
        --media-max-size: min(calc(var(--media-spacing) * var(--media-max-size-factor)), 100cqi);
        min-width: var(--media-max-size);
        height: calc(var(--media-spacing) * 1);
      }
      @container media-root (width > 42rem) {
        .media-default-skin .media-slider .media-slider__preview {
          --media-max-size-factor: 48;
        }
      }
      .media-default-skin .media-slider .media-slider__preview .media-slider__thumbnail,
      .media-default-skin .media-slider .media-slider__preview .media-slider__value {
        position: absolute;
        left: 50%;
        max-width: var(--media-max-size);
        opacity: 0;
        filter: blur(8px);
        transform-origin: bottom;
        scale: 0.8;
        translate: -50% calc(var(--media-spacing) * 2);
        transition-timing-function: ease-out;
        transition-duration: 150ms;
      }
      .media-default-skin .media-slider .media-slider__preview .media-slider__thumbnail {
        --media-thumbnail-max-width: var(--media-max-size);
        --media-thumbnail-max-height: var(--media-max-size);
        bottom: calc(100% + (var(--media-spacing) * 9));
      }
      .media-default-skin .media-slider .media-slider__preview .media-slider__value {
        bottom: calc(100% + (var(--media-spacing) * 10.5));
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .media-default-skin .media-slider .media-slider__preview .media-slider__chapter-title {
        min-width: 0;
        max-width: var(--media-max-size);
        padding-inline: calc(var(--media-spacing) * 6);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .media-default-skin .media-slider .media-slider__preview .media-slider__chapter-title:empty {
        display: none;
      }
      .media-default-skin .media-slider .media-slider__preview::before {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 1;
        width: calc(var(--media-spacing) * 1);
        height: calc(var(--media-spacing) * 1);
        pointer-events: none;
        content: "";
        background-color: currentColor;
        border-radius: 100%;
        box-shadow:
          0 0 0 1px var(--media-shadow-current-color, oklch(0 0 0 / 0.15)),
          0 1px 2px 0 oklch(0 0 0 / 0.35);
        opacity: 0;
        scale: 0.5;
        translate: -50% -50%;
        transition-timing-function: ease-out;
        transition-duration: 200ms;
        transition-property: opacity, scale;
      }
      .media-default-skin .media-slider:is([data-pointing], :has(:focus-visible))
        .media-slider__preview
        :is(.media-slider__value, .media-slider__thumbnail),
      .media-default-skin .media-slider .media-slider__preview[data-pointing]:not([data-dragging])::before {
        opacity: 1;
        filter: blur(0);
        scale: 1;
      }
      .media-default-skin {
        --media-popup-transition:
          opacity var(--media-popup-transition-timing-function) var(--media-popup-transition-duration),
          filter var(--media-popup-transition-timing-function) var(--media-popup-transition-duration),
          transform var(--media-popup-transition-timing-function) var(--media-popup-transition-duration),
          scale var(--media-popup-transition-timing-function) var(--media-popup-transition-duration);
      }
      .media-default-skin .media-popover,
      .media-default-skin .media-tooltip {
        --media-popup-translate-distance: calc(0.5 * var(--media-internal-scale-unit));
        margin: 0;
        overflow: visible;
        color: inherit;
        border: 0;
        transition: var(--media-popup-transition);
      }
      .media-default-skin .media-popover[data-starting-style],
      .media-default-skin .media-popover[data-ending-style],
      .media-default-skin .media-tooltip[data-starting-style],
      .media-default-skin .media-tooltip[data-ending-style] {
        opacity: 0;
        filter: blur(4px);
        transform: translate(var(--media-popup-translate-x-distance, 0), var(--media-popup-translate-y-distance, 0));
        scale: 0.95;
      }
      .media-default-skin .media-popover[data-ending-style],
      .media-default-skin .media-tooltip[data-ending-style] {
        transform: none;
        transition-duration: max(0ms, calc(var(--media-popup-transition-duration) - 50ms));
      }
      .media-default-skin .media-popover[data-side="top"],
      .media-default-skin .media-tooltip[data-side="top"] {
        --media-popup-translate-y-distance: var(--media-popup-translate-distance);
        transform-origin: bottom;
      }
      .media-default-skin .media-popover[data-side="bottom"],
      .media-default-skin .media-tooltip[data-side="bottom"] {
        --media-popup-translate-y-distance: calc(var(--media-popup-translate-distance) * -1);
        transform-origin: top;
      }
      .media-default-skin .media-popover[data-side="left"],
      .media-default-skin .media-tooltip[data-side="left"] {
        --media-popup-translate-x-distance: var(--media-popup-translate-distance);
        transform-origin: right;
      }
      .media-default-skin .media-popover[data-side="right"],
      .media-default-skin .media-tooltip[data-side="right"] {
        --media-popup-translate-x-distance: calc(var(--media-popup-translate-distance) * -1);
        transform-origin: left;
      }
      .media-default-skin .media-popover::before,
      .media-default-skin .media-tooltip::before {
        position: absolute;
        pointer-events: inherit;
        content: "";
      }
      .media-default-skin .media-popover[data-side="top"]::before,
      .media-default-skin .media-popover[data-side="bottom"]::before,
      .media-default-skin .media-tooltip[data-side="top"]::before,
      .media-default-skin .media-tooltip[data-side="bottom"]::before {
        inset-inline: 0;
        width: 100%;
      }
      .media-default-skin .media-popover[data-side="top"]::before,
      .media-default-skin .media-tooltip[data-side="top"]::before {
        top: 100%;
      }
      .media-default-skin .media-popover[data-side="bottom"]::before,
      .media-default-skin .media-tooltip[data-side="bottom"]::before {
        bottom: 100%;
      }
      .media-default-skin .media-popover[data-side="left"]::before,
      .media-default-skin .media-popover[data-side="right"]::before,
      .media-default-skin .media-tooltip[data-side="left"]::before,
      .media-default-skin .media-tooltip[data-side="right"]::before {
        inset-block: 0;
        height: 100%;
      }
      .media-default-skin .media-popover[data-side="left"]::before,
      .media-default-skin .media-tooltip[data-side="left"]::before {
        left: 100%;
      }
      .media-default-skin .media-popover[data-side="right"]::before,
      .media-default-skin .media-tooltip[data-side="right"]::before {
        right: 100%;
      }
      .media-default-skin .media-popover[data-side="top"]::before,
      .media-default-skin .media-popover[data-side="bottom"]::before {
        height: var(--media-popover-side-offset);
      }
      .media-default-skin .media-popover[data-side="left"]::before,
      .media-default-skin .media-popover[data-side="right"]::before {
        width: var(--media-popover-side-offset);
      }
      .media-default-skin .media-popover--volume {
        padding: calc(var(--media-spacing) * 3) 0;
        border-radius: calc(Infinity * 1px);
      }
      .media-default-skin .media-popover--volume:has(media-volume-slider[data-hidden]) {
        display: none;
      }
      .media-default-skin .media-tooltip {
        padding: calc(var(--media-spacing) * 1) calc(var(--media-spacing) * 2.5);
        font-size: var(--media-font-size-base);
        white-space: nowrap;
        border-radius: calc(Infinity * 1px);
      }
      .media-default-skin .media-tooltip[data-open] {
        display: flex;
        column-gap: calc(var(--media-spacing) * 1);
        align-items: center;
      }
      .media-default-skin .media-tooltip[data-side="top"]::before,
      .media-default-skin .media-tooltip[data-side="bottom"]::before {
        height: var(--media-tooltip-side-offset);
      }
      .media-default-skin .media-tooltip[data-side="left"]::before,
      .media-default-skin .media-tooltip[data-side="right"]::before {
        width: var(--media-tooltip-side-offset);
      }
      .media-default-skin .media-tooltip .media-tooltip__kbd {
        min-width: 1.5em;
        padding: 0.1em;
        font-family: inherit;
        font-size: var(--media-font-size-small);
        font-weight: 600;
        line-height: 1.25;
        text-align: center;
        background-color: oklch(from currentColor l c h / 0.3);
        border-radius: calc(var(--media-spacing) * 1);
      }
      .media-default-skin .media-menu {
        --media-menu-transition-duration: 250ms;
        --media-menu-max-height: calc(var(--media-spacing) * 56);
        --media-menu-padding: calc(var(--media-spacing) * 1);
        --media-menu-border-radius: calc(var(--media-spacing) * 3);
        --media-menu-item-border-radius: calc(var(--media-menu-border-radius) - var(--media-menu-padding));
        box-sizing: border-box;
        min-width: max-content;
        max-width: var(--media-menu-available-width, none);
        max-height: min(var(--media-menu-available-height, var(--media-menu-max-height)), var(--media-menu-max-height));
        padding: var(--media-menu-padding);
        overflow: auto;
        overscroll-behavior: none;
        border-radius: var(--media-menu-border-radius);
      }
      @media (prefers-reduced-motion: reduce) {
        .media-default-skin .media-menu {
          --media-menu-transition-duration: 0ms;
        }
      }
      .media-default-skin .media-menu > .media-menu__panel {
        --media-menu-content-enter-translate: 100%;
        position: absolute;
        inset-inline: 0;
        top: 0;
        z-index: 10;
        max-height: inherit;
        padding: var(--media-menu-padding);
        overflow: auto;
        overscroll-behavior: none;
        outline: none;
        translate: 0 0;
        transition-timing-function: ease-out;
        transition-duration: var(--media-menu-transition-duration);
        transition-property: translate, filter;
      }
      .media-default-skin .media-menu > .media-menu__panel:where([data-starting-style], [data-ending-style]) {
        overflow: hidden;
        pointer-events: none;
        filter: blur(8px);
        translate: var(--media-menu-content-enter-translate) 0;
      }
      .media-default-skin .media-menu > .media-menu__panel:dir(rtl):where([data-starting-style], [data-ending-style]) {
        --media-menu-content-enter-translate: -100%;
      }
      .media-default-skin .media-menu .media-menu__separator {
        margin-block: calc(var(--media-spacing) * 1);
        border-bottom: 1px solid oklch(0 0 0 / 0.1);
        box-shadow: 0 1px 0 0 oklch(1 0 0 / 0.075);
      }
      .media-default-skin .media-menu .media-menu__content,
      .media-default-skin .media-menu .media-menu__group {
        anchor-scope: --menu-item-highlight-anchor;
        display: flex;
        flex-direction: column;
        gap: calc(var(--media-spacing) * 0.5);
      }
      @supports (top: anchor(top)) {
        .media-default-skin .media-menu .media-menu__content::before,
        .media-default-skin .media-menu .media-menu__group::before {
          position: absolute;
          position-anchor: --menu-item-highlight-anchor;
          inset: anchor(inside);
          overflow-anchor: none;
          pointer-events: none;
          content: "";
          background-color: var(--media-accent-background-color);
          border-radius: var(--media-menu-item-border-radius);
          transition: inset 100ms ease-in-out;
        }
        .media-default-skin .media-menu .media-menu__content:has([data-highlighted=""])::before,
        .media-default-skin .media-menu .media-menu__group:has([data-highlighted=""])::before {
          transition-duration: 0ms;
        }
      }
      .media-default-skin .media-menu .media-menu__item,
      .media-default-skin .media-menu .media-menu__back {
        position: relative;
        display: flex;
        gap: calc(var(--media-spacing) * 1.5);
        align-items: center;
        padding: calc(var(--media-spacing) * 1.5) calc(var(--media-spacing) * 2);
        text-align: start;
        white-space: nowrap;
        text-shadow: 0 1px 0 var(--media-shadow-current-color);
        cursor: pointer;
        user-select: none;
        outline: 2px solid transparent;
        outline-offset: -2px;
        border-radius: var(--media-menu-item-border-radius);
        transition: background-color, color;
        transition-timing-function: ease-in-out;
        transition-duration: 100ms;
      }
      .media-default-skin .media-menu .media-menu__item .media-icon,
      .media-default-skin .media-menu .media-menu__back .media-icon {
        flex-shrink: 0;
        color: oklch(from currentColor l c h / 0.65);
        filter: drop-shadow(0 1px 0 var(--media-shadow-current-color));
      }
      .media-default-skin .media-menu .media-menu__item:focus-visible,
      .media-default-skin .media-menu .media-menu__back:focus-visible {
        outline-color: var(--media-focus-ring-color);
        outline-offset: 2px;
      }
      .media-default-skin .media-menu .media-menu__item:hover,
      .media-default-skin .media-menu .media-menu__item[data-highlighted],
      .media-default-skin .media-menu .media-menu__back:hover,
      .media-default-skin .media-menu .media-menu__back[data-highlighted] {
        color: var(--media-internal-accent-text-color);
        background-color: var(--media-accent-background-color);
      }
      .media-default-skin .media-menu .media-menu__item:hover .media-icon,
      .media-default-skin .media-menu .media-menu__item[data-highlighted] .media-icon,
      .media-default-skin .media-menu .media-menu__back:hover .media-icon,
      .media-default-skin .media-menu .media-menu__back[data-highlighted] .media-icon {
        color: inherit;
      }
      @supports (top: anchor(top)) {
        .media-default-skin .media-menu .media-menu__item,
        .media-default-skin .media-menu .media-menu__back {
          transition-duration: 50ms;
        }
        .media-default-skin .media-menu .media-menu__item:hover,
        .media-default-skin .media-menu .media-menu__item[data-highlighted],
        .media-default-skin .media-menu .media-menu__back:hover,
        .media-default-skin .media-menu .media-menu__back[data-highlighted] {
          transition-duration: 200ms;
        }
      }
      .media-default-skin .media-menu .media-menu__indicator {
        flex-shrink: 0;
        margin-inline: auto calc(var(--media-spacing) * -1);
        opacity: 0;
      }
      .media-default-skin .media-menu .media-menu__indicator .media-icon {
        filter: drop-shadow(0 1px 0 var(--media-shadow-current-color));
      }
      .media-default-skin .media-menu .media-menu__item {
        justify-content: space-between;
        font-variant-numeric: tabular-nums;
        color: inherit;
      }
      .media-default-skin .media-menu .media-menu__item[aria-disabled="true"] {
        pointer-events: none;
        cursor: not-allowed;
        opacity: 0.5;
      }
      .media-default-skin .media-menu .media-menu__item[aria-checked="true"] .media-menu__indicator {
        opacity: 1;
      }
      .media-default-skin .media-menu .media-menu__item[data-availability="unavailable"],
      .media-default-skin .media-menu .media-menu__item[data-availability="unsupported"] {
        display: none;
      }
      @supports (top: anchor(top)) {
        .media-default-skin .media-menu .media-menu__item[data-highlighted] {
          anchor-name: --menu-item-highlight-anchor;
          background-color: transparent;
        }
      }
      .media-default-skin .media-menu .media-menu__tier {
        padding-inline-start: calc(var(--media-spacing) * 0.5);
        padding-top: 1px;
        font-size: var(--media-font-size-tiny);
        font-weight: 600;
        line-height: 1;
        color: oklch(from currentColor l c h / 0.7);
      }
      .media-default-skin .media-menu .media-menu__back {
        width: 100%;
        margin-bottom: calc(var(--media-spacing) * 0.5);
      }
      .media-default-skin .media-menu .media-menu__hint {
        display: inline-flex;
        gap: calc(var(--media-spacing) * 1);
        align-items: center;
        min-width: 0;
        padding-inline-start: calc(var(--media-spacing) * 2);
        margin-inline-start: auto;
        color: oklch(from currentColor l c h / 0.65);
      }
      .media-default-skin .media-menu .media-menu__hint-label {
        max-width: calc(var(--media-spacing) * 24);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .media-default-skin .media-menu .media-menu__chevron {
        width: calc(var(--media-spacing) * 3.5);
        height: calc(var(--media-spacing) * 3.5);
      }
      .media-default-skin .media-menu.media-menu--settings {
        width: var(--media-menu-width);
        min-width: calc(var(--media-spacing) * 44);
        height: var(--media-menu-height);
        overflow: hidden;
        transition:
          var(--media-popup-transition),
          width var(--media-popup-transition-timing-function) var(--media-menu-transition-duration),
          height var(--media-popup-transition-timing-function) var(--media-menu-transition-duration);
      }
      .media-default-skin .media-menu.media-menu--settings > .media-menu__content {
        --media-menu-content-exit-translate: -100%;
        translate: 0 0;
        transition:
          translate var(--media-menu-transition-duration) ease-out,
          filter var(--media-menu-transition-duration) ease-out;
      }
      .media-default-skin .media-menu.media-menu--settings > .media-menu__content:dir(rtl) {
        --media-menu-content-exit-translate: 100%;
      }
      .media-default-skin .media-menu.media-menu--settings > .media-menu__content[data-child-open] {
        filter: blur(8px);
        translate: var(--media-menu-content-exit-translate) 0;
      }
      .media-default-skin .media-menu.media-menu--settings > .media-menu__content[data-child-open]::before,
      .media-default-skin .media-menu.media-menu--settings:has(> .media-menu__panel[data-ending-style]) > .media-menu__content::before {
        display: none;
      }
      .media-default-skin .media-menu.media-menu--settings[data-starting-style],
      .media-default-skin .media-menu.media-menu--settings[data-ending-style] {
        transition: var(--media-popup-transition);
      }
      .media-default-skin {
        --media-caption-track-duration: var(--media-controls-transition-duration);
        --media-caption-track-delay: 25ms;
        --media-caption-track-y: calc(var(--media-spacing) * -2);
      }
      .media-default-skin:has(.media-controls[data-visible]) {
        --media-caption-track-y: calc(var(--media-spacing) * -14);
      }
      .media-default-skin video::-webkit-media-text-track-container {
        z-index: 1;
        font-family: inherit;
        scale: 0.98;
        translate: 0 var(--media-caption-track-y);
        transition: translate var(--media-caption-track-duration) ease-out;
        transition-delay: var(--media-caption-track-delay);
      }
      .media-default-skin .media-input-indicator {
        position: absolute;
        inset: 0;
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        align-items: center;
        justify-items: center;
        color: oklch(1 0 0);
        pointer-events: none;
      }
      .media-default-skin .media-volume-indicator,
      .media-default-skin .media-status-indicator--state {
        --media-surface-background-color: oklch(0 0 0 / 0.25);
        position: absolute;
        top: calc(var(--media-spacing) * 3);
        font-weight: 500;
        color: inherit;
        pointer-events: none;
        border-radius: calc(Infinity * 1px);
        transform-origin: top center;
        transition-timing-function: ease-out;
        transition-duration: 100ms;
      }
      .media-default-skin .media-volume-indicator .media-volume-indicator__content,
      .media-default-skin .media-volume-indicator .media-status-indicator__content,
      .media-default-skin .media-status-indicator--state .media-volume-indicator__content,
      .media-default-skin .media-status-indicator--state .media-status-indicator__content {
        display: flex;
        gap: calc(var(--media-spacing) * 2);
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: calc(var(--media-spacing) * 1) calc(var(--media-spacing) * 2.5);
      }
      .media-default-skin .media-volume-indicator .media-volume-indicator__content *,
      .media-default-skin .media-volume-indicator .media-status-indicator__content *,
      .media-default-skin .media-status-indicator--state .media-volume-indicator__content *,
      .media-default-skin .media-status-indicator--state .media-status-indicator__content * {
        mix-blend-mode: difference;
      }
      .media-default-skin .media-volume-indicator .media-icon,
      .media-default-skin .media-status-indicator--state .media-icon {
        display: none;
        flex-shrink: 0;
      }
      .media-default-skin .media-volume-indicator .media-volume-indicator__value,
      .media-default-skin .media-volume-indicator .media-status-indicator__value,
      .media-default-skin .media-status-indicator--state .media-volume-indicator__value,
      .media-default-skin .media-status-indicator--state .media-status-indicator__value {
        margin-left: auto;
      }
      @media (pointer: coarse) {
        .media-default-skin .media-volume-indicator,
        .media-default-skin .media-status-indicator--state {
          transition-property: scale, translate, opacity;
          will-change: scale, translate, opacity;
        }
      }
      @media (pointer: fine) and (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-volume-indicator,
        .media-default-skin .media-status-indicator--state {
          transition-property: scale, translate, filter, opacity;
          will-change: scale, translate, filter, opacity;
        }
      }
      @media (prefers-reduced-transparency: reduce) or (prefers-contrast: more) {
        .media-default-skin .media-volume-indicator,
        .media-default-skin .media-status-indicator--state {
          --media-surface-background-color: oklch(0 0 0);
        }
      }
      .media-default-skin .media-volume-indicator[data-starting-style],
      .media-default-skin .media-volume-indicator[data-ending-style],
      .media-default-skin .media-status-indicator--state[data-starting-style],
      .media-default-skin .media-status-indicator--state[data-ending-style] {
        opacity: 0;
        transition-timing-function: ease-in;
        transition-duration: 250ms;
      }
      @media (pointer: fine) and (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-volume-indicator[data-starting-style],
        .media-default-skin .media-volume-indicator[data-ending-style],
        .media-default-skin .media-status-indicator--state[data-starting-style],
        .media-default-skin .media-status-indicator--state[data-ending-style] {
          filter: blur(8px);
          scale: 0.9;
        }
      }
      .media-default-skin .media-volume-indicator[data-ending-style],
      .media-default-skin .media-status-indicator--state[data-ending-style] {
        @media (prefers-reduced-motion: no-preference) {
          translate: 0 -25%;
        }
      }
      .media-default-skin .media-seek-indicator,
      .media-default-skin .media-status-indicator--playback {
        display: grid;
        grid-row: 1;
        grid-column: 2;
        place-content: center;
        padding: calc(var(--media-spacing) * 4);
        text-align: center;
      }
      .media-default-skin .media-volume-indicator {
        width: min(80%, calc(var(--media-spacing) * 48));
        transform: translateX(0);
      }
      .media-default-skin .media-volume-indicator .media-volume-indicator__content {
        background-image: linear-gradient(currentColor, currentColor);
        background-repeat: no-repeat;
        background-position: left;
        background-size: var(--media-volume-fill, 0%) 100%;
        border-radius: inherit;
        transition: background-size 200ms linear;
      }
      .media-default-skin .media-volume-indicator[data-level="high"] .media-icon--volume-high,
      .media-default-skin .media-volume-indicator[data-level="low"] .media-icon--volume-low,
      .media-default-skin .media-volume-indicator[data-level="off"] .media-icon--volume-off {
        display: block;
      }
      @media (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-volume-indicator[data-min]:not([data-starting-style], [data-ending-style]),
        .media-default-skin .media-volume-indicator[data-max]:not([data-starting-style], [data-ending-style]) {
          transform: translateX(0.25px);
          transition: transform 300ms linear(0, -24 20%, 16 40%, -8 60%, 4 80%, 1);
        }
      }
      .media-default-skin .media-status-indicator--state[data-status="captions-on"] .media-icon--captions-on,
      .media-default-skin .media-status-indicator--state[data-status="captions-off"] .media-icon--captions-off,
      .media-default-skin .media-status-indicator--state[data-status="fullscreen"] .media-icon--fullscreen-enter,
      .media-default-skin .media-status-indicator--state[data-status="exit-fullscreen"] .media-icon--fullscreen-exit,
      .media-default-skin .media-status-indicator--state[data-status="pip"] .media-icon--pip-enter,
      .media-default-skin .media-status-indicator--state[data-status="exit-pip"] .media-icon--pip-exit {
        display: block;
      }
      .media-default-skin .media-status-indicator--playback {
        background: oklch(0 0 0 / 0.35);
        border-radius: 100%;
        backdrop-filter: blur(8px);
        transition-timing-function: ease-out;
        transition-duration: 200ms;
        transition-property: opacity, scale;
      }
      .media-default-skin .media-status-indicator--playback .media-icon {
        grid-area: 1 / 1;
        width: calc(var(--media-icon-size) * 1.5);
        height: calc(var(--media-icon-size) * 1.5);
        opacity: 0;
        scale: 0;
        transition-timing-function: ease-out;
        transition-duration: 150ms;
        transition-property: opacity, scale;
      }
      .media-default-skin .media-status-indicator--playback .media-icon.media-icon--play {
        translate: 1px 0;
      }
      .media-default-skin .media-status-indicator--playback[data-status="pause"] .media-icon--pause,
      .media-default-skin .media-status-indicator--playback[data-status="play"] .media-icon--play {
        opacity: 1;
        scale: 1;
      }
      .media-default-skin .media-status-indicator--playback[data-starting-style],
      .media-default-skin .media-status-indicator--playback[data-ending-style] {
        opacity: 0;
        scale: 0.85;
      }
      .media-default-skin .media-status-indicator--playback[data-ending-style] {
        transition-timing-function: ease-in;
        transition-duration: 100ms;
      }
      @media (prefers-reduced-motion: reduce) {
        .media-default-skin .media-status-indicator--playback {
          transition-duration: 50ms;
          transition-property: opacity;
        }
        .media-default-skin .media-status-indicator--playback[data-starting-style],
        .media-default-skin .media-status-indicator--playback[data-ending-style],
        .media-default-skin .media-status-indicator--playback .media-icon {
          scale: 1;
        }
        .media-default-skin .media-status-indicator--playback .media-icon {
          transition-duration: 50ms;
          transition-property: opacity;
        }
      }
      .media-default-skin .media-seek-indicator {
        gap: calc(var(--media-spacing) * 1);
      }
      .media-default-skin .media-seek-indicator .media-seek-indicator__value {
        font-variant-numeric: tabular-nums;
      }
      @container media-root (width > 24rem) {
        .media-default-skin .media-seek-indicator {
          padding: calc(var(--media-spacing) * 6);
        }
      }
      .media-default-skin .media-seek-indicator[data-direction="backward"] {
        grid-column: 1;
        justify-self: left;
      }
      .media-default-skin .media-seek-indicator[data-direction="forward"] {
        grid-column: 3;
        justify-self: right;
      }
      .media-default-skin .media-seek-indicator .media-icon--seek {
        display: block;
        width: calc(var(--media-icon-size) * 1.5);
        height: calc(var(--media-icon-size) * 1.5);
      }
      .media-default-skin .media-seek-indicator[data-direction="backward"] .media-icon--seek {
        scale: -1 1;
      }
      @media (prefers-reduced-motion: no-preference) {
        .media-default-skin .media-seek-indicator .media-icon--seek {
          transition-timing-function: ease-in-out;
          transition-duration: 200ms;
          transition-property: translate, opacity;
        }
        .media-default-skin .media-seek-indicator[data-starting-style] .media-icon--seek,
        .media-default-skin .media-seek-indicator[data-ending-style] .media-icon--seek {
          opacity: 0;
        }
        .media-default-skin .media-seek-indicator[data-direction="forward"][data-starting-style] .media-icon--seek {
          translate: -60% 0;
        }
        .media-default-skin .media-seek-indicator[data-direction="backward"][data-starting-style] .media-icon--seek {
          translate: 60% 0;
        }
      }
      /* ==========================================================================
         Icon State Visibility for Video Skins
         ========================================================================== */
      .media-button--play .media-icon,
      .media-button--mute .media-icon,
      .media-button--fullscreen .media-icon,
      .media-button--pip .media-icon,
      .media-button--cast .media-icon,
      .media-button--airplay .media-icon,
      .media-button--captions .media-icon {
        opacity: 0;
      }
      .media-button--play .media-icon {
        scale: 0;
      }
      .media-button--play[data-ended] .media-icon--restart,
      .media-button--play:not([data-ended])[data-paused] .media-icon--play,
      .media-button--play:not([data-ended]):not([data-started]) .media-icon--play,
      .media-button--play[data-started]:not([data-paused]):not([data-ended]) .media-icon--pause,
      .media-button--mute[data-muted] .media-icon--volume-off,
      .media-button--mute:not([data-muted])[data-volume-level="low"] .media-icon--volume-low,
      .media-button--mute:not([data-muted]):not([data-volume-level="low"]) .media-icon--volume-high,
      .media-button--fullscreen:not([data-fullscreen]) .media-icon--fullscreen-enter,
      .media-button--fullscreen[data-fullscreen] .media-icon--fullscreen-exit,
      .media-button--pip:not([data-pip]) .media-icon--pip-enter,
      .media-button--pip[data-pip] .media-icon--pip-exit,
      .media-button--cast:not([data-cast-state="connected"]) .media-icon--cast-enter,
      .media-button--cast[data-cast-state="connected"] .media-icon--cast-exit,
      .media-button--airplay:not([data-airplay-state="connected"]) .media-icon--airplay-enter,
      .media-button--airplay[data-airplay-state="connected"] .media-icon--airplay-exit,
      .media-button--captions:not([data-active]) .media-icon--captions-off,
      .media-button--captions[data-active] .media-icon--captions-on {
        opacity: 1;
        scale: 1;
      }
      .media-button--airplay:not([data-airplay-state="connected"]) {
        --media-icon-airplay-fill-animation: none;
        --media-icon-airplay-triangle-animation: none;
      }
      @media (prefers-reduced-motion: reduce) {
        .media-button--airplay {
          --media-icon--airplay__fill-animation: none;
          --media-icon--airplay__triangle-animation: none;
        }
      }
      /* Video-specific container styles */
      .media-default-skin--video {
        --media-default-accent-color: oklch(1 0 0);
        --media-border-color: light-dark(oklch(0 0 0 / 0.1), oklch(1 0 0 / 0.15));
        --media-focus-ring-color: light-dark(oklch(0 0 0), oklch(1 0 0));
        --media-video-border-radius: var(--media-container-border-radius);
        --media-surface-background-color: oklch(1 0 0 / 0.1);
        --media-surface-inner-border-color: oklch(1 0 0 / 0.1);
        --media-surface-outer-border-color: oklch(0 0 0 / 0.1);
        --media-surface-shadow-color: oklch(0 0 0 / 0.15);
        --media-surface-backdrop-filter: blur(16px) saturate(1.5);
        --media-controls-transition-duration: 100ms;
        --media-controls-transition-timing-function: ease-out;
        --media-dialog-transition-duration: 350ms;
        --media-dialog-transition-delay: 100ms;
        --media-dialog-transition-timing-function: ease-out;
        --media-popup-transition-duration: 100ms;
        --media-popup-transition-timing-function: ease-out;
        overflow: clip;
        background: oklch(0 0 0);
      }
      @media (prefers-reduced-motion: reduce) {
        .media-default-skin--video {
          --media-dialog-transition-duration: 50ms;
          --media-dialog-transition-delay: 0ms;
          --media-popup-transition-duration: 0ms;
        }
        .media-default-skin--video .media-dialog__popup {
          scale: 1;
          transition-property: opacity;
        }
      }
      @media (prefers-reduced-transparency: reduce) or (prefers-contrast: more) {
        .media-default-skin--video {
          --media-surface-background-color: oklch(0 0 0);
          --media-surface-inner-border-color: oklch(1 0 0 / 0.25);
          --media-surface-outer-border-color: transparent;
        }
      }
      .media-default-skin--video:has(.media-controls--root:not([data-visible])) {
        @media (pointer: fine) {
          --media-controls-transition-duration: 300ms;
        }
        @media (pointer: coarse) {
          --media-controls-transition-duration: 150ms;
        }
        @media (prefers-reduced-motion: reduce) {
          --media-controls-transition-duration: 50ms;
        }
      }
      .media-default-skin--video::after {
        position: absolute;
        inset: 0;
        z-index: 10;
        pointer-events: none;
        content: "";
        border-radius: inherit;
        box-shadow: inset 0 0 0 1px var(--media-border-color);
      }
      .media-default-skin--video:fullscreen {
        --media-container-border-radius: 0;
      }
      .media-default-skin--video:fullscreen::after {
        display: none;
      }
      @media (width >= 1280px) {
        .media-default-skin--video:fullscreen {
          --media-scale: 1.25;
        }
      }
      @media (width >= 1536px) {
        .media-default-skin--video:fullscreen {
          --media-scale: 1.5;
        }
      }
      @media (width >= 1920px) {
        .media-default-skin--video:fullscreen {
          --media-scale: 1.75;
        }
      }
      .media-default-skin--video * {
        --media-focus-ring-color: oklch(1 0 0);
      }
      /* Dialog */
      .media-default-skin--video .media-dialog__popup {
        position: absolute;
        top: 50%;
        left: 50%;
        z-index: 20;
        display: flex;
        flex-direction: column;
        gap: calc(var(--media-spacing) * 3);
        width: 100%;
        max-width: calc(var(--media-spacing) * 72);
        padding: calc(var(--media-spacing) * 3);
        color: oklch(1 0 0);
        text-shadow: 0 1px 0 oklch(0 0 0 / 0.25);
        border-radius: calc(var(--media-spacing) * 7);
        translate: -50% -50%;
        transition-delay: var(--media-dialog-transition-delay);
        transition-timing-function: var(--media-dialog-transition-timing-function);
        transition-duration: var(--media-dialog-transition-duration);
        transition-property: opacity, scale;
      }
      .media-default-skin--video .media-dialog__popup[data-starting-style],
      .media-default-skin--video .media-dialog__popup[data-ending-style],
      .media-default-skin--video media-error-dialog[data-starting-style] .media-dialog__popup,
      .media-default-skin--video media-error-dialog[data-ending-style] .media-dialog__popup {
        opacity: 0;
        scale: 0.95;
      }
      .media-default-skin--video .media-dialog__popup[data-ending-style],
      .media-default-skin--video media-error-dialog[data-ending-style] .media-dialog__popup {
        transition-delay: 0ms;
      }
      .media-default-skin--video .media-dialog__content {
        display: flex;
        flex-direction: column;
        gap: calc(var(--media-spacing) * 2);
        padding: calc(var(--media-spacing) * 2) calc(var(--media-spacing) * 2) calc(var(--media-spacing) * 1.5);
        text-shadow: inherit;
      }
      .media-default-skin--video .media-dialog__title {
        font-size: var(--media-font-size-medium);
      }
      .media-default-skin--video .media-slider__value {
        text-shadow: 0 1px 0 var(--media-shadow-current-color);
      }
      /* Controls (hide/show behavior) */
      .media-default-skin--video .media-controls--root {
        --media-inset-factor: 2;
        --media-inset: calc(var(--media-spacing) * var(--media-inset-factor));
        --media-base-boundary-offset: var(--media-inset-factor);
        z-index: 10;
        display: contents;
        color: oklch(1 0 0);
        transition-timing-function: var(--media-controls-transition-timing-function);
        transition-duration: calc(var(--media-controls-transition-duration) / 2);
      }
      .media-default-skin--video .media-controls--root .media-controls--primary,
      .media-default-skin--video .media-controls--root .media-controls--secondary {
        position: absolute;
      }
      .media-default-skin--video .media-controls--root .media-controls--primary {
        z-index: 20;
      }
      .media-default-skin--video .media-controls--root .media-controls--secondary {
        z-index: 10;
      }
      .media-default-skin--video .media-controls--root .media-controls--primary {
        inset-inline: var(--media-inset);
        bottom: var(--media-inset);
        transform-origin: bottom;
      }
      .media-default-skin--video .media-controls--root .media-controls--secondary {
        top: var(--media-inset);
        right: var(--media-inset);
        container-type: normal;
        transform-origin: top;
      }
      .media-default-skin--video .media-controls--root .media-time-controls {
        flex: 1;
        padding-inline: calc(var(--media-spacing) * 2);
      }
      @container media-root (width < 32rem) {
        .media-default-skin--video .media-controls--root .media-controls--primary,
        .media-default-skin--video .media-controls--root .media-controls--secondary {
          transition-timing-function: inherit;
          transition-duration: inherit;
        }
        @media (pointer: fine) {
          .media-default-skin--video .media-controls--root .media-controls--primary,
          .media-default-skin--video .media-controls--root .media-controls--secondary {
            transition-property: filter, opacity, scale, translate;
          }
        }
        @media (pointer: coarse) {
          .media-default-skin--video .media-controls--root .media-controls--primary,
          .media-default-skin--video .media-controls--root .media-controls--secondary {
            transition-property: opacity, scale, translate;
          }
        }
        .media-default-skin--video .media-controls--root:after {
          display: none;
        }
        .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--primary,
        .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--secondary {
          pointer-events: none;
          opacity: 0;
          scale: 0.95;
          transition-duration: var(--media-controls-transition-duration);
        }
        @media (pointer: fine) and (prefers-reduced-motion: no-preference) {
          .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--primary,
          .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--secondary {
            filter: blur(8px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--primary,
          .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--secondary {
            scale: 1;
          }
        }
        .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--primary {
          @media (prefers-reduced-motion: no-preference) {
            translate: 0 4px;
          }
        }
        .media-default-skin--video .media-controls--root:not([data-visible]) .media-controls--secondary {
          @media (prefers-reduced-motion: no-preference) {
            translate: 0 -4px;
          }
        }
        .media-default-skin--video .media-controls--root .media-button--captions {
          display: none;
        }
      }
      @container media-root (width >= 32rem) {
        .media-default-skin--video .media-controls--root {
          position: absolute;
          inset-inline: var(--media-inset);
          bottom: var(--media-inset);
          display: flex;
          transform-origin: bottom;
        }
        .media-default-skin--video .media-controls--root .media-controls--primary,
        .media-default-skin--video .media-controls--root .media-controls--secondary {
          display: contents;
        }
        .media-default-skin--video .media-controls--root .media-controls--primary::after,
        .media-default-skin--video .media-controls--root .media-controls--secondary::after {
          display: none;
        }
        .media-default-skin--video .media-controls--root:not([data-visible]) {
          pointer-events: none;
          opacity: 0;
          scale: 0.95;
          transition-duration: var(--media-controls-transition-duration);
        }
        @media (pointer: fine) and (prefers-reduced-motion: no-preference) {
          .media-default-skin--video .media-controls--root:not([data-visible]) {
            filter: blur(8px);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .media-default-skin--video .media-controls--root:not([data-visible]) {
            scale: 1;
          }
        }
        .media-default-skin--video .media-controls--root:not([data-visible]) {
          @media (prefers-reduced-motion: no-preference) {
            translate: 0 4px;
          }
        }
        .media-default-skin--video .media-controls--root .media-time-controls {
          padding-inline: calc(var(--media-spacing) * 3);
        }
      }
      @media (pointer: fine) {
        .media-default-skin--video .media-controls--root {
          transition-property: filter, opacity, scale, translate;
        }
      }
      @media (pointer: coarse) {
        .media-default-skin--video .media-controls--root {
          transition-property: opacity, scale, translate;
        }
      }
      @container media-root (width > 42rem) {
        .media-default-skin--video .media-controls--root {
          --media-inset-factor: 3;
        }
      }
      .media-default-skin--video:has(.media-controls--root:not([data-visible])) {
        cursor: none;
      }
      .media-default-skin--video .media-slider__track {
        background-color: oklch(1 0 0 / 0.2);
      }
    </style>
</head>
<body>
  <div class="main-container">
    <div class="player-wrapper">
      <video-player poster="__THUMBNAIL__">
        <media-container class="media-default-skin media-default-skin--video">
          <video src="__VIDEO_URL__" playsinline></video>
          <media-poster>
            <img alt="" decoding="async" />
          </media-poster>
          <media-buffering-indicator class="media-buffering-indicator">
            <media-icon name="spinner" class="media-icon"></media-icon>
          </media-buffering-indicator>
          <media-error-dialog>
            <media-dialog-backdrop class="media-dialog__backdrop"></media-dialog-backdrop>
            <media-dialog-popup class="media-dialog__popup media-surface">
              <div class="media-dialog__content">
                <media-dialog-title class="media-dialog__title"></media-dialog-title>
                <media-dialog-description class="media-dialog__description"></media-dialog-description>
              </div>
              <div class="media-dialog__actions">
                <media-dialog-close class="media-button media-button--primary"></media-dialog-close>
              </div>
            </media-dialog-popup>
          </media-error-dialog>
          <media-controls>
            <media-controls-backdrop class="media-controls__backdrop"></media-controls-backdrop>
            <media-controls-content class="media-surface media-controls media-controls--root">
              <media-tooltip-group>
                <media-controls-group class="media-surface media-controls media-controls--primary">
                  <div class="media-button-group">
                    <media-play-button commandfor="play-tooltip" class="media-button media-button--subtle media-button--icon media-button--play">
                      <media-icon name="restart" class="media-icon media-icon--restart"></media-icon>
                      <media-icon name="play" class="media-icon media-icon--play"></media-icon>
                      <media-icon name="pause" class="media-icon media-icon--pause"></media-icon>
                    </media-play-button>
                    <media-tooltip id="play-tooltip" side="top" class="media-surface media-tooltip">
                      <media-tooltip-label></media-tooltip-label>
                      <media-tooltip-shortcut class="media-tooltip__kbd"></media-tooltip-shortcut>
                    </media-tooltip>
                    <media-mute-button commandfor="video-volume-popover" class="media-button media-button--subtle media-button--icon media-button--mute">
                      <media-icon name="volume-off" class="media-icon media-icon--volume-off"></media-icon>
                      <media-icon name="volume-low" class="media-icon media-icon--volume-low"></media-icon>
                      <media-icon name="volume-high" class="media-icon media-icon--volume-high"></media-icon>
                    </media-mute-button>
                    <media-popover id="video-volume-popover" open-on-hover delay="200" close-delay="100" side="top" class="media-surface media-popover media-popover--volume">
                      <media-volume-slider class="media-slider" orientation="vertical" thumb-alignment="edge">
                        <media-slider-track class="media-slider__track">
                          <media-slider-fill class="media-slider__fill"></media-slider-fill>
                        </media-slider-track>
                        <media-slider-thumb class="media-slider__thumb media-slider__thumb--persistent"></media-slider-thumb>
                      </media-volume-slider>
                    </media-popover>
                  </div>
                  <div class="media-time-controls">
                    <media-time type="current" class="media-time"></media-time>
                    <media-time-slider class="media-slider">
                      <media-time-slider-chapters class="media-slider__chapters">
                        <template>
                          <div class="media-slider__chapter">
                            <media-slider-track class="media-slider__track media-slider__chapter-track">
                              <media-slider-buffer class="media-slider__buffer"></media-slider-buffer>
                              <media-slider-fill class="media-slider__fill"></media-slider-fill>
                            </media-slider-track>
                          </div>
                        </template>
                      </media-time-slider-chapters>
                      <media-slider-thumb class="media-slider__thumb"></media-slider-thumb>
                      <media-slider-preview overflow="visible" class="media-slider__preview">
                        <div class="media-surface media-thumbnail media-slider__thumbnail">
                          <media-slider-thumbnail class="media-thumbnail__image"></media-slider-thumbnail>
                          <media-icon name="spinner" class="media-thumbnail__spinner media-icon"></media-icon>
                        </div>
                        <div class="media-slider__value">
                          <media-time-slider-chapter-title class="media-slider__chapter-title"></media-time-slider-chapter-title>
                          <media-slider-value type="pointer" class="media-time"></media-slider-value>
                        </div>
                      </media-slider-preview>
                    </media-time-slider>
                    <media-time toggle type="remaining" class="media-time"></media-time>
                  </div>
                  <div class="media-button-group">
                    <media-captions-button commandfor="captions-tooltip" class="media-button media-button--subtle media-button--icon media-button--captions">
                      <media-icon name="captions-off" class="media-icon media-icon--captions-off"></media-icon>
                      <media-icon name="captions-on" class="media-icon media-icon--captions-on"></media-icon>
                    </media-captions-button>
                    <media-tooltip id="captions-tooltip" side="top" class="media-surface media-tooltip">
                      <media-tooltip-label></media-tooltip-label>
                      <media-tooltip-shortcut class="media-tooltip__kbd"></media-tooltip-shortcut>
                    </media-tooltip>
                    <button id="settings-trigger" commandfor="settings-menu" aria-labelledby="settings-label" class="media-button media-button--subtle media-button--icon media-button--settings">
                      <media-icon name="gear" class="media-icon media-icon--settings"></media-icon>
                      <media-text token="menu.settings" id="settings-label" class="media-sr-only">Settings</media-text>
                    </button>
                    <media-menu id="settings-menu" side="top" align="center" class="media-surface media-popover media-menu media-menu--settings">
                      <media-menu-content class="media-menu__content">
                        <media-menu-item commandfor="settings-quality-menu" class="media-menu__item media-menu__item--submenu">
                          <media-icon name="switches" class="media-icon"></media-icon>
                          <media-text token="menu.quality">Quality</media-text>
                          <span class="media-menu__hint">
                            <bdi data-part="hint" dir="auto" class="media-menu__hint-label"></bdi>
                            <media-icon name="chevron" class="media-icon media-menu__chevron"></media-icon>
                          </span>
                        </media-menu-item>
                        <media-menu-item commandfor="settings-audio-menu" class="media-menu__item media-menu__item--submenu">
                          <media-icon name="speech" class="media-icon"></media-icon>
                          <media-text token="menu.audio">Audio</media-text>
                          <span class="media-menu__hint">
                            <bdi data-part="hint" dir="auto" class="media-menu__hint-label"></bdi>
                            <media-icon name="chevron" class="media-icon media-menu__chevron"></media-icon>
                          </span>
                        </media-menu-item>
                        <media-menu-item commandfor="settings-speed-menu" class="media-menu__item media-menu__item--submenu">
                          <media-icon name="speed" class="media-icon"></media-icon>
                          <media-text token="menu.speed">Speed</media-text>
                          <span class="media-menu__hint">
                            <bdi data-part="hint" dir="auto" class="media-menu__hint-label"></bdi>
                            <media-icon name="chevron" class="media-icon media-menu__chevron"></media-icon>
                          </span>
                        </media-menu-item>
                        <media-menu-item commandfor="settings-captions-menu" class="media-menu__item media-menu__item--submenu">
                          <media-icon name="captions-off" class="media-icon"></media-icon>
                          <media-text token="menu.captions">Captions</media-text>
                          <span class="media-menu__hint">
                            <bdi data-part="hint" dir="auto" class="media-menu__hint-label"></bdi>
                            <media-icon name="chevron" class="media-icon media-menu__chevron"></media-icon>
                          </span>
                        </media-menu-item>
                      </media-menu-content>
                      <media-menu-content id="settings-quality-menu" class="media-menu__panel">
                        <media-menu-item class="media-menu__back">
                          <media-icon name="chevron" class="media-icon media-menu__chevron media-icon--flipped"></media-icon>
                          <media-text token="menu.quality">Quality</media-text>
                        </media-menu-item>
                        <div class="media-menu__separator"></div>
                        <media-quality-radio-group class="media-menu__group">
                          <template>
                            <media-menu-radio-item class="media-menu__item">
                              <span>
                                <bdi data-part="label" dir="auto"></bdi>
                                <sup data-part="tier" class="media-menu__tier"></sup>
                              </span>
                              <span data-part="badge" class="media-badge"></span>
                              <media-menu-item-indicator force-mount class="media-menu__indicator">
                                <media-icon name="check" class="media-icon"></media-icon>
                              </media-menu-item-indicator>
                            </media-menu-radio-item>
                          </template>
                        </media-quality-radio-group>
                      </media-menu-content>
                      <media-menu-content id="settings-audio-menu" class="media-menu__panel">
                        <media-menu-item class="media-menu__back">
                          <media-icon name="chevron" class="media-icon media-menu__chevron media-icon--flipped"></media-icon>
                          <media-text token="menu.audio">Audio</media-text>
                        </media-menu-item>
                        <div class="media-menu__separator"></div>
                        <media-audio-track-radio-group class="media-menu__group">
                          <template>
                            <media-menu-radio-item class="media-menu__item">
                              <bdi data-part="label" dir="auto"></bdi>
                              <media-menu-item-indicator force-mount class="media-menu__indicator">
                                <media-icon name="check" class="media-icon"></media-icon>
                              </media-menu-item-indicator>
                            </media-menu-radio-item>
                          </template>
                        </media-audio-track-radio-group>
                      </media-menu-content>
                      <media-menu-content id="settings-speed-menu" class="media-menu__panel">
                        <media-menu-item class="media-menu__back">
                          <media-icon name="chevron" class="media-icon media-menu__chevron media-icon--flipped"></media-icon>
                          <media-text token="menu.speed">Speed</media-text>
                        </media-menu-item>
                        <div class="media-menu__separator"></div>
                        <media-playback-rate-radio-group class="media-menu__group">
                          <template>
                            <media-menu-radio-item class="media-menu__item">
                              <bdi data-part="label" dir="auto"></bdi>
                              <media-menu-item-indicator force-mount class="media-menu__indicator">
                                <media-icon name="check" class="media-icon"></media-icon>
                              </media-menu-item-indicator>
                            </media-menu-radio-item>
                          </template>
                        </media-playback-rate-radio-group>
                      </media-menu-content>
                      <media-menu-content id="settings-captions-menu" class="media-menu__panel">
                        <media-menu-item class="media-menu__back">
                          <media-icon name="chevron" class="media-icon media-menu__chevron media-icon--flipped"></media-icon>
                          <media-text token="menu.captions">Captions</media-text>
                        </media-menu-item>
                        <div class="media-menu__separator"></div>
                        <media-captions-radio-group class="media-menu__group">
                          <template>
                            <media-menu-radio-item class="media-menu__item">
                              <bdi data-part="label" dir="auto"></bdi>
                              <media-menu-item-indicator force-mount class="media-menu__indicator">
                                <media-icon name="check" class="media-icon"></media-icon>
                              </media-menu-item-indicator>
                            </media-menu-radio-item>
                          </template>
                        </media-captions-radio-group>
                      </media-menu-content>
                    </media-menu>
                    <media-tooltip id="settings-tooltip" trigger="settings-trigger" side="top" class="media-surface media-tooltip">
                      <media-text token="menu.settings">Settings</media-text>
                    </media-tooltip>
                  </div>
                </media-controls-group>
                <media-controls-group class="media-surface media-controls media-controls--secondary">
                  <div class="media-button-group">
                    <media-cast-button commandfor="cast-tooltip" class="media-button media-button--subtle media-button--icon media-button--cast">
                      <media-icon name="cast-enter" class="media-icon media-icon--cast-enter"></media-icon>
                      <media-icon name="cast-exit" class="media-icon media-icon--cast-exit"></media-icon>
                    </media-cast-button>
                    <media-tooltip id="cast-tooltip" side="top" class="media-surface media-tooltip">
                      <media-tooltip-label></media-tooltip-label>
                      <media-tooltip-shortcut class="media-tooltip__kbd"></media-tooltip-shortcut>
                    </media-tooltip>
                    <media-airplay-button commandfor="airplay-tooltip" class="media-button media-button--subtle media-button--icon media-button--airplay">
                      <media-icon name="airplay-enter" class="media-icon media-icon--airplay-enter"></media-icon>
                      <media-icon name="airplay-exit" class="media-icon media-icon--airplay-exit"></media-icon>
                    </media-airplay-button>
                    <media-tooltip id="airplay-tooltip" side="top" class="media-surface media-tooltip">
                      <media-tooltip-label></media-tooltip-label>
                      <media-tooltip-shortcut class="media-tooltip__kbd"></media-tooltip-shortcut>
                    </media-tooltip>
                    <media-pip-button commandfor="pip-tooltip" class="media-button media-button--subtle media-button--icon media-button--pip">
                      <media-icon name="pip-enter" class="media-icon media-icon--pip-enter"></media-icon>
                      <media-icon name="pip-exit" class="media-icon media-icon--pip-exit"></media-icon>
                    </media-pip-button>
                    <media-tooltip id="pip-tooltip" side="top" class="media-surface media-tooltip">
                      <media-tooltip-label></media-tooltip-label>
                      <media-tooltip-shortcut class="media-tooltip__kbd"></media-tooltip-shortcut>
                    </media-tooltip>
                    <media-fullscreen-button commandfor="fullscreen-tooltip" class="media-button media-button--subtle media-button--icon media-button--fullscreen">
                      <media-icon name="fullscreen-enter" class="media-icon media-icon--fullscreen-enter"></media-icon>
                      <media-icon name="fullscreen-exit" class="media-icon media-icon--fullscreen-exit"></media-icon>
                    </media-fullscreen-button>
                    <media-tooltip id="fullscreen-tooltip" side="top" class="media-surface media-tooltip">
                      <media-tooltip-label></media-tooltip-label>
                      <media-tooltip-shortcut class="media-tooltip__kbd"></media-tooltip-shortcut>
                    </media-tooltip>
                  </div>
                </media-controls-group>
              </media-tooltip-group>
            </media-controls-content>
          </media-controls>
          <!-- Hotkeys -->
          <media-hotkey keys="Space" action="togglePaused"></media-hotkey>
          <media-hotkey keys="k" action="togglePaused"></media-hotkey>
          <media-hotkey keys="m" action="toggleMuted"></media-hotkey>
          <media-hotkey keys="f" action="toggleFullscreen"></media-hotkey>
          <media-hotkey keys="c" action="toggleSubtitles"></media-hotkey>
          <media-hotkey keys="i" action="togglePictureInPicture"></media-hotkey>
          <media-hotkey keys="ArrowRight" action="seekStep" value="5"></media-hotkey>
          <media-hotkey keys="ArrowLeft" action="seekStep" value="-5"></media-hotkey>
          <media-hotkey keys="l" action="seekStep" value="10"></media-hotkey>
          <media-hotkey keys="j" action="seekStep" value="-10"></media-hotkey>
          <media-hotkey keys="ArrowUp" action="volumeStep" value="0.05"></media-hotkey>
          <media-hotkey keys="ArrowDown" action="volumeStep" value="-0.05"></media-hotkey>
          <media-hotkey keys="0-9" action="seekToPercent"></media-hotkey>
          <media-hotkey keys="Home" action="seekToPercent" value="0"></media-hotkey>
          <media-hotkey keys="End" action="seekToPercent" value="100"></media-hotkey>
          <media-hotkey keys=">" action="speedUp"></media-hotkey>
          <media-hotkey keys="<" action="speedDown"></media-hotkey>
          <!-- Gestures -->
          <media-gesture type="tap" action="togglePaused" pointer="mouse" region="center"></media-gesture>
          <media-gesture type="tap" action="toggleControls" pointer="touch"></media-gesture>
          <media-gesture type="doubletap" action="seekStep" value="-10" region="left"></media-gesture>
          <media-gesture type="doubletap" action="toggleFullscreen" region="center"></media-gesture>
          <media-gesture type="doubletap" action="seekStep" value="10" region="right"></media-gesture>
          <!-- Input Indicators -->
          <media-status-announcer class="media-sr-only"></media-status-announcer>
          <div class="media-input-indicator">
            <media-volume-indicator hidden class="media-surface media-volume-indicator">
              <media-volume-indicator-fill class="media-volume-indicator__content">
                <media-icon name="volume-high" class="media-icon media-icon--volume-high"></media-icon>
                <media-icon name="volume-low" class="media-icon media-icon--volume-low"></media-icon>
                <media-icon name="volume-off" class="media-icon media-icon--volume-off"></media-icon>
                <media-volume-indicator-value class="media-volume-indicator__value"></media-volume-indicator-value>
              </media-volume-indicator-fill>
            </media-volume-indicator>
            <media-status-indicator
              hidden
              actions="toggleSubtitles toggleFullscreen togglePictureInPicture"
              class="media-surface media-status-indicator media-status-indicator--state"
            >
              <div class="media-status-indicator__content">
                <media-icon name="captions-on" class="media-icon media-icon--captions-on"></media-icon>
                <media-icon name="captions-off" class="media-icon media-icon--captions-off"></media-icon>
                <media-icon name="fullscreen-enter" class="media-icon media-icon--fullscreen-enter"></media-icon>
                <media-icon name="fullscreen-exit" class="media-icon media-icon--fullscreen-exit"></media-icon>
                <media-icon name="pip-enter" class="media-icon media-icon--pip-enter"></media-icon>
                <media-icon name="pip-exit" class="media-icon media-icon--pip-exit"></media-icon>
                <media-status-indicator-value class="media-status-indicator__value"></media-status-indicator-value>
              </div>
            </media-status-indicator>
            <media-seek-indicator hidden class="media-seek-indicator">
              <media-icon name="chevron" class="media-icon media-icon--seek"></media-icon>
              <media-seek-indicator-value class="media-seek-indicator__value"></media-seek-indicator-value>
            </media-seek-indicator>
            <media-status-indicator hidden actions="togglePaused" class="media-status-indicator media-status-indicator--playback">
              <media-icon name="play" class="media-icon media-icon--play"></media-icon>
              <media-icon name="pause" class="media-icon media-icon--pause"></media-icon>
            </media-status-indicator>
          </div>
        </media-container>
      </video-player>
    </div>
  </div>
</body>
</html>`;

    const bodyClass = isEmbed ? 'embed-mode' : '';

    let html = htmlTemplate
      .replace(/__VIDEO_URL__/g, videoUrl.replace(/"/g, '&quot;'))
      .replace(/__TITLE__/g, title.replace(/"/g, '&quot;'))
      .replace(/__THUMBNAIL__/g, thumbnail)
      .replace(/__PAGE_URL__/g, pageUrl)
      .replace(/__ENCODED_PAGE_URL__/g, encodeURIComponent(oembedPageUrl))
      .replace(/__BASE_URL__/g, baseUrl);

    return new Response(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
};
