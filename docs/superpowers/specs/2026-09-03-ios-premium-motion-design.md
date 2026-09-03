# Clarity iOS Premium Motion and Task Composer Design

**Date:** 2026-09-03  
**Status:** Approved for implementation planning

## Objective

Improve Clarity's iOS interaction quality without changing its task, habit,
note, authentication, or synchronization models. The finished app should feel
expressive and premium while remaining responsive, safe-area aware, and usable
with iOS Reduce Motion enabled.

This work also adds the year to the Home date and replaces the iPhone task
page's inline quick-add flow with a modal composer animated from the floating
add button.

## Scope

### Home date

The Home greeting displays a localized full date that includes weekday, day,
month, and four-digit year. For example, an English locale may display
`THURSDAY 3 SEPTEMBER 2026`. The existing typography and locale-sensitive date
formatting remain in place.

### iPhone task composer

- The inline `Add a task` composer is removed from iPhone task views.
- The existing desktop inline composer remains available at the current
  responsive breakpoint.
- The floating add button moves slightly lower, but remains above the docked
  search bar and the home-indicator safe area.
- Tapping the floating button opens a modal task composer containing the same
  title, description, due date, priority, category, tags, and reminder fields
  supported by the current quick-add form.
- The modal originates visually from the floating button at the lower-right.
  Its panel scales, translates, and fades into place while the backdrop fades
  in independently.
- The modal respects the status bar, Dynamic Island, landscape notch, rounded
  screen corners, on-screen keyboard, and home indicator.
- The task-name field receives focus after the opening transition begins.
- Submission creates the task in the same view-specific list/date/favorite
  context as the existing quick-add flow, closes the modal, and restores focus
  to the floating button.
- Cancel, backdrop tap, and Escape close the modal. Closing is animated; the
  dialog remains mounted and inert until its exit completes so it cannot flash
  or disappear abruptly.
- Rapid repeated taps cannot create stacked composers or leave an invisible
  overlay intercepting input.

## Motion System

### Direction

Motion is deliberately expressive: larger scaling, stronger accent glows, and
longer transitions than the current restrained micro-animations. It remains
functional rather than decorative—motion communicates origin, destination,
selection, completion, or hierarchy.

### Shared tokens

The CSS layer will define shared motion variables instead of scattering timing
values through components. The system includes:

- responsive touch feedback around 120-180 ms;
- standard entrances and state changes around 260-340 ms;
- prominent modal, drawer, and page transitions around 360-460 ms;
- spring-like entrance easing with a controlled overshoot;
- faster ease-in exits so dismissal never feels delayed;
- shared glow strength and transform distances.

Only opacity and transforms are used for frequent or large motion where
possible. Layout-dependent transitions remain limited to existing disclosure
controls, with overflow containment to prevent scroll jumps.

### Interaction coverage

The motion audit covers existing interactive surfaces rather than adding new
product behavior:

- buttons, icon buttons, toggles, radios, filters, checkboxes, and habit cells;
- task completion, task insertion/removal, empty states, and undo toasts;
- dropdowns, contextual menus, search results, and disclosure sections;
- task, habit, note-template, summary, settings, and day-detail overlays;
- main navigation changes and the interactive mobile sidebar gesture;
- state indicators such as chevrons, progress bars, and selected colors.

Controls gain clear touch-down scale and release feedback. Primary actions can
use a stronger accent glow; neutral and destructive controls keep colors that
match their meaning. Persistent ambient animations must not compete with
content or harm scrolling performance.

### Exit lifecycle

Overlays that currently render only while a Boolean is true will use a small,
shared presence lifecycle: opening, open, closing, then unmounted. This permits
real exit animations and centralizes animation-end/fallback-timer handling.
Presentation errors or interrupted animation events must fall back to the final
state; motion must never prevent the underlying action.

### Haptics

Capacitor Haptics supplies iOS-only feedback:

- light feedback for opening menus, dialogs, and making selections;
- success feedback for completing a task or habit;
- warning feedback when initiating destructive actions.

Haptic calls are best-effort and do not participate in data mutations. Failure
or unsupported environments are ignored safely.

### Reduce Motion

When `prefers-reduced-motion: reduce` is active, the app removes large travel,
overshoot, pulsing, and scale effects. Short opacity changes may remain so state
changes are still understandable. Functional focus, modal lifecycle, and
dismissal behavior remain identical.

## iOS Safe Areas and Landscape

The iOS application shell uses all four safe-area insets. Portrait layout keeps
its existing vertical treatment. In landscape, left and right insets reduce the
usable content width so neither orientation places controls or content beneath
the notch or rounded display edge.

Safe-area boundaries also apply consistently to:

- the main scrolling page and docked search bar;
- the floating add button;
- mobile navigation and Settings drawers;
- modal backdrops and panels;
- dropdowns, toasts, and other fixed overlays.

Insets are applied once at the correct owning layer to avoid double padding.
Browser and non-native layouts retain their current behavior.

## Components and Responsibilities

- `Home` owns localized Home date presentation.
- `AppShell` owns quick-add state, view-specific defaults, floating-button
  placement, and opening/closing the composer.
- `TaskInput` retains form state, validation, and task-draft construction. Its
  form content is reused by the desktop inline presentation and mobile modal
  presentation rather than duplicating task-entry logic.
- A focused modal/presence primitive owns backdrop behavior, focus restoration,
  closing state, and animation completion.
- The native utility layer owns best-effort haptic functions.
- The global CSS motion layer owns motion tokens and reusable interaction,
  entrance, exit, and reduced-motion classes.

Existing domain stores and Supabase synchronization interfaces are unchanged.

## Accessibility and Input Behavior

- Modal content uses `role="dialog"`, `aria-modal="true"`, and an accessible
  name.
- Background content is inert while the composer is open.
- Initial and restored focus are deterministic.
- Touch targets remain at least their current size; visual scaling does not
  alter layout or hit regions.
- Keyboard opening must not push the primary task action under the home
  indicator. The modal scrolls internally if vertical space is constrained.
- Disabled and future controls remain non-interactive regardless of animation.

## Testing and Acceptance Criteria

### Automated verification

- Add a focused test for the Home date formatter proving that a four-digit year
  is present while locale-sensitive formatting remains supported.
- Add tests for extracted composer/presence state behavior where it can be
  expressed without testing CSS implementation details.
- Run the complete Vitest suite, lint, TypeScript compilation, Vite production
  build, and Capacitor iOS synchronization.

### Simulator verification

Test representative compact and large iPhones in portrait and both landscape
orientations. Cover light and dark themes, Reduce Motion, keyboard-visible
composer layout, fast repeated open/close taps, submission, cancellation,
backdrop dismissal, scrolling, menus, disclosures, drawers, search, and task
completion.

### Physical iPhone verification

Verify:

- the composer clearly originates from the floating add button;
- the button sits below its old position without covering the search bar;
- touch feedback and haptics match the action;
- gestures and scrolling remain smooth during and after animations;
- no content or close control enters the notch, status-bar, rounded-corner, or
  home-indicator areas in portrait or landscape;
- overlays cannot become stuck or continue intercepting touches after closing.

## Explicit Exclusions

- The Habits history grid remains unchanged. Rendering a full future month in
  the yearly view is postponed.
- No macOS work is included.
- No task, habit, note, authentication, or Supabase schema changes are included.
- The motion pass does not redesign page content, add navigation destinations,
  or introduce decorative animation without an interaction purpose.

