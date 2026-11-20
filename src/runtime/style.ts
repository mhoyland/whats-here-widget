import { css } from 'jimu-core'

export const widgetStyle = css`
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-size: 0.8125rem;
  background: var(--sys-color-surface-paper);
  color: var(--sys-color-surface-paper-text);

  .wh-mono {
    font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
    font-variant-numeric: tabular-nums;
  }

  /* ---- toolbar ---- */
  /* ---- compact bar: where buttons + summary of the options ---- */
  .wh-bar {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-2) var(--sys-spacing-3);
    border-bottom: 1px solid var(--sys-color-divider-secondary);
    background: color-mix(in srgb, var(--sys-color-action-hover) 40%, var(--sys-color-surface-paper));
  }
  .wh-bar-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
  }
  .wh-bar-row .wh-select-button {
    flex: 0 0 auto;
  }
  .wh-where.is-compact {
    flex: 0 0 auto;
    display: flex;
  }
  .wh-where.is-compact .wh-where-button {
    width: 40px;
  }
  .wh-summary {
    flex: 1 1 auto;
    min-width: 0;
    min-height: 40px;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: 0 var(--sys-spacing-2);
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-surface-paper);
    color: inherit;
    font: inherit;
    font-size: 0.8125rem;
    text-align: start;
    cursor: pointer;
  }
  .wh-summary.is-static {
    border-color: transparent;
    background: transparent;
    cursor: default;
  }
  .wh-summary-text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    line-height: 1.25;
  }
  .wh-summary-title,
  .wh-summary-detail {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wh-summary-title {
    font-weight: 600;
  }
  .wh-summary-detail {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-summary-chevron {
    flex: 0 0 auto;
    color: var(--sys-color-surface-paper-hint);
    transition: transform 120ms ease;
  }
  .wh-summary-chevron.is-open {
    transform: rotate(180deg);
  }
  .wh-summary:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }
  .wh-prompt {
    flex: 1 1 auto;
    min-width: 0;
    font-size: 0.8125rem;
    line-height: 1.3;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-prompt-cancel {
    font-weight: 600;
  }
  .wh-layer-select {
    width: 100%;
  }
  /* The profile in use: a light outlined pill, so it reads as something to click. */
  .wh-details-toggle {
    align-self: flex-start;
    max-width: 100%;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-block: 2px;
    padding: 4px 10px;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: 14px;
    background: var(--sys-color-surface-paper);
    color: var(--sys-color-surface-paper-text);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .wh-details-toggle:hover {
    border-color: var(--sys-color-primary-main);
  }
  .wh-details-toggle.is-static {
    border-color: transparent;
    background: transparent;
    padding-inline: 0;
    cursor: default;
  }
  .wh-details-label {
    flex: 0 0 auto;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-details-text {
    font-weight: 600;
  }
  .wh-details-text {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wh-details-toggle:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: 2px;
  }
  .wh-options-panel {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-3);
    padding: var(--sys-spacing-3);
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-surface-paper);
  }

  /* ---- results header: summary + expand / collapse all ---- */
  .wh-results-head {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-2) var(--sys-spacing-3);
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
  }
  .wh-link {
    flex: 0 0 auto;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--sys-color-primary-main);
    font: inherit;
    font-size: 0.8125rem;
    cursor: pointer;
  }
  .wh-link:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: 2px;
  }
  .wh-area-details-actions {
    display: flex;
    justify-content: flex-end;
    padding: var(--sys-spacing-1) var(--sys-spacing-2) 0;
  }

  .wh-toolbar {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-3);
    border-bottom: 1px solid var(--sys-color-divider-secondary);
  }
  .wh-toolbar-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
  }
  .wh-select-button {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sys-spacing-2);
  }
  .wh-hint {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-hint.is-picking {
    color: var(--sys-color-primary-main);
  }

  /* ---- location + summary ---- */
  .wh-location {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-2) var(--sys-spacing-3);
    background: var(--sys-color-action-hover);
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
  }
  .wh-location-icon {
    flex: 0 0 auto;
    color: var(--sys-color-primary-main);
  }
  .wh-location-text {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .wh-location-coord {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    user-select: text;
  }
  /* Up to two lines, then cut off; the full text is in the tooltip. */
  .wh-location-meta {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* ---- where / buffer / report on ---- */
  .wh-step {
    display: flex;
    flex-direction: column;
    gap: var(--sys-spacing-1);
  }
  .wh-step-label {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-where {
    display: grid;
    grid-auto-columns: minmax(0, 1fr);
    grid-auto-flow: column;
    padding: 2px;
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-action-hover);
  }
  .wh-where-button,
  .wh-tool-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--sys-spacing-1);
    min-width: 0;
    border: 0;
    border-radius: var(--sys-shape-shape1);
    background: transparent;
    color: var(--sys-color-surface-paper-hint);
    font: inherit;
    white-space: nowrap;
    cursor: pointer;
  }
  .wh-where-button {
    height: 32px;
  }
  .wh-where-button.is-active {
    background: var(--sys-color-surface-paper);
    color: var(--sys-color-surface-paper-text);
    font-weight: 600;
    box-shadow: 0 0 0 1px var(--sys-color-divider-secondary);
  }
  /* Waiting for the map: the chosen button fills with the theme colour. */
  .wh-where-button.is-picking {
    background: var(--sys-color-primary-main);
    color: var(--sys-color-primary-text);
    box-shadow: none;
  }
  .wh-where-button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .wh-toolbar-row.is-actions-only {
    justify-content: flex-end;
    margin-top: calc(-1 * var(--sys-spacing-1));
  }
  .wh-hint-cancel {
    margin-left: auto;
  }
  .wh-tools {
    display: flex;
    gap: var(--sys-spacing-1);
  }
  .wh-tool-button {
    flex: 1 1 0;
    height: 28px;
    border: 1px solid var(--sys-color-divider-secondary);
    font-size: 0.75rem;
  }
  .wh-tool-button.is-active {
    border-color: var(--sys-color-primary-main);
    background: color-mix(in srgb, var(--sys-color-primary-main) 8%, var(--sys-color-surface-paper));
    color: var(--sys-color-primary-main);
    font-weight: 600;
  }
  .wh-step-head {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: var(--sys-spacing-2);
  }
  .wh-customise-link {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 0;
    border: 0;
    background: transparent;
    color: var(--sys-color-primary-main);
    font: inherit;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
  }
  .wh-customise-link:disabled {
    opacity: 0.45;
    cursor: default;
  }
  .wh-customise-link:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: 2px;
  }
  .wh-step-value {
    font-weight: 600;
  }
  .wh-step-note {
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-buffer {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 32px;
  }
  .wh-buffer-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    margin: 0;
    cursor: pointer;
  }
  .wh-buffer-value {
    display: inline-flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    margin-left: auto;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-where-button:focus-visible,
  .wh-tool-button:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }

  /* ---- profile picker + point / area switch ---- */
  .wh-options {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
  }
  .wh-profile {
    flex: 1 1 auto;
    min-width: 0;
  }
  .wh-mode {
    flex: 1 1 auto;
    display: flex;
    padding: 2px;
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-action-hover);
  }
  .wh-mode-button {
    flex: 1 1 0;
    min-height: 26px;
    padding: 2px var(--sys-spacing-2);
    border: 0;
    border-radius: var(--sys-shape-shape1);
    background: transparent;
    color: var(--sys-color-surface-paper-hint);
    font: inherit;
    cursor: pointer;
  }
  .wh-options.has-profile .wh-mode {
    flex: 0 0 auto;
  }
  .wh-options.has-profile .wh-mode-button {
    padding: 2px var(--sys-spacing-3);
  }
  .wh-mode-button.is-active {
    background: var(--sys-color-surface-paper);
    color: var(--sys-color-surface-paper-text);
    font-weight: 600;
    box-shadow: 0 0 0 1px var(--sys-color-divider-secondary);
  }
  .wh-mode-button:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }

  /* ---- area card ---- */
  .wh-location.is-area {
    align-items: flex-start;
    background: color-mix(in srgb, var(--sys-color-primary-main) 8%, var(--sys-color-surface-paper));
  }
  .wh-area-icon {
    flex: 0 0 auto;
    width: 14px;
    height: 14px;
    margin: 2px 1px 0;
    border: 1.5px dashed var(--sys-color-primary-main);
    border-radius: 2px;
  }
  .wh-area-name {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wh-area-toggle {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    max-width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: start;
    cursor: pointer;
  }
  .wh-area-toggle:hover .wh-area-name {
    text-decoration: underline;
  }
  .wh-area-toggle:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: 2px;
  }
  .wh-area-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
  }
  .wh-area-details {
    flex: 0 1 auto;
    max-height: 40%;
    overflow-y: auto;
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
    background: color-mix(in srgb, var(--sys-color-primary-main) 4%, var(--sys-color-surface-paper));
  }
  .wh-area-details > .wh-attributes,
  .wh-area-details > .wh-attributes-empty {
    padding: var(--sys-spacing-2) var(--sys-spacing-3) var(--sys-spacing-2) 36px;
  }
  .wh-area-details > .wh-features {
    margin: var(--sys-spacing-1) 0;
  }
  .wh-location.is-area.is-expanded {
    border-bottom-color: transparent;
  }

  .wh-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 4px;
  }
  .wh-chip {
    padding: 0 7px;
    border: 1px solid var(--sys-color-divider-secondary);
    border-radius: 10px;
    background: var(--sys-color-surface-paper);
    font-size: 0.6875rem;
    line-height: 18px;
  }
  .wh-chip.is-negative {
    border-color: var(--sys-color-primary-main);
    color: var(--sys-color-primary-main);
  }

  .wh-status {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 36px;
    padding: var(--sys-spacing-1) var(--sys-spacing-3);
    border-bottom: 1px solid var(--sys-color-divider-tertiary);
  }
  .wh-status-text {
    flex: 1 1 auto;
    min-width: 0;
  }
  .wh-status-text strong {
    font-weight: 600;
  }
  .wh-status-sub {
    display: block;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-loading {
    position: relative;
    width: 20px;
    height: 20px;
    flex: 0 0 auto;
  }

  /* ---- results ---- */
  .wh-results {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    margin: 0;
    padding: var(--sys-spacing-2) 0;
    list-style: none;
  }
  .wh-layer + .wh-layer {
    border-top: 1px solid var(--sys-color-divider-tertiary);
  }
  .wh-layer-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
    padding-right: var(--sys-spacing-3);
  }
  .wh-layer-row:hover {
    background: var(--sys-color-action-hover);
  }
  /* Layer actions appear on hover or keyboard focus, and always on touch screens. */
  .wh-layer-actions {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    opacity: 0;
  }
  .wh-layer-row:hover .wh-layer-actions,
  .wh-layer-row:focus-within .wh-layer-actions {
    opacity: 1;
  }
  @media (hover: none) {
    .wh-layer-actions {
      opacity: 1;
    }
  }
  .wh-layer-header {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-2) var(--sys-spacing-3);
    border: 0;
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .wh-layer-titles {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .wh-layer-title {
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wh-layer-parent {
    font-size: 0.6875rem;
    color: var(--sys-color-surface-paper-hint);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wh-count {
    flex: 0 0 auto;
    min-width: 22px;
    padding: 0 6px;
    border-radius: 10px;
    background: var(--sys-color-primary-main);
    color: var(--sys-color-primary-text);
    font-size: 0.6875rem;
    font-weight: 600;
    line-height: 18px;
    text-align: center;
  }
  .wh-count.is-empty {
    background: var(--sys-color-action-disabled);
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-layer-note {
    padding: 0 var(--sys-spacing-3) var(--sys-spacing-2) 36px;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-layer-note.is-error {
    color: var(--sys-color-error-main);
  }
  .wh-error-detail {
    display: block;
    color: var(--sys-color-surface-paper-hint);
    overflow-wrap: anywhere;
  }

  .wh-features {
    margin: 0 0 var(--sys-spacing-2);
    padding: 0;
    list-style: none;
  }
  .wh-feature {
    margin: 0 var(--sys-spacing-2) 0 28px;
    border-radius: var(--sys-shape-shape1);
  }
  /* A light tint of the theme colour, not action-selected, which some themes set to the full primary colour. */
  .wh-feature.is-selected {
    background: color-mix(in srgb, var(--sys-color-primary-main) 10%, var(--sys-color-surface-paper));
    box-shadow: inset 3px 0 0 var(--sys-color-primary-main);
  }
  .wh-feature.is-selected .wh-feature-name {
    font-weight: 600;
  }
  .wh-feature.is-selected .wh-feature-button:hover {
    background: transparent;
  }
  .wh-feature-row {
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-1);
  }
  .wh-feature-button {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: var(--sys-spacing-2);
    min-height: 30px;
    padding: 4px var(--sys-spacing-2);
    border: 0;
    border-radius: var(--sys-shape-shape1);
    background: transparent;
    color: inherit;
    text-align: start;
    cursor: pointer;
  }
  .wh-feature-button:hover {
    background: var(--sys-color-action-hover);
  }
  .wh-feature-name {
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .wh-chevron {
    flex: 0 0 auto;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-attributes {
    display: grid;
    grid-template-columns: minmax(80px, 40%) 1fr;
    gap: 2px var(--sys-spacing-3);
    margin: 0;
    padding: var(--sys-spacing-1) var(--sys-spacing-2) var(--sys-spacing-2) 30px;
    font-size: 0.75rem;
  }
  .wh-attributes dt {
    font-weight: 400;
    color: var(--sys-color-surface-paper-hint);
    overflow-wrap: anywhere;
  }
  .wh-attributes dd {
    margin: 0;
    overflow-wrap: anywhere;
    user-select: text;
  }
  .wh-attributes-empty {
    padding: var(--sys-spacing-1) var(--sys-spacing-2) var(--sys-spacing-2) 30px;
    font-size: 0.75rem;
    color: var(--sys-color-surface-paper-hint);
  }

  .wh-layer-header:focus-visible,
  .wh-feature-button:focus-visible {
    outline: 2px solid var(--sys-color-primary-main);
    outline-offset: -2px;
  }

  /* ---- empty / notices ---- */
  .wh-empty {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--sys-spacing-2);
    padding: var(--sys-spacing-5) var(--sys-spacing-4);
    text-align: center;
    color: var(--sys-color-surface-paper-hint);
  }
  .wh-empty strong {
    color: var(--sys-color-surface-paper-text);
  }
  .wh-notice {
    margin: var(--sys-spacing-3);
    padding: var(--sys-spacing-2) var(--sys-spacing-3);
    border-radius: var(--sys-shape-shape1);
    background: var(--sys-color-warning-light);
    color: var(--sys-color-warning-dark);
    font-size: 0.75rem;
  }
`
