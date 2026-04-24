---
name: Main St. Co-op Admin Terminal
description: A high-density, modern operational dashboard for property management, characterized by "bento-style" layouts, rounded forms, and a professional teal aesthetic.
tokens:
  color:
    primary:
      background: "#f7f9fb" # --color-surface-muted
      accent: "#0D9488" # --color-teal-accent
      text: "#0f172a" # slate-900
    neutrals:
      slate-50: "#f8fafc"
      slate-100: "#f1f5f9"
      slate-200: "#e2e8f0"
      slate-400: "#94a3b8"
      slate-500: "#64748b"
      slate-600: "#475569"
    status:
      emergency: "#f43f5e" # rose-500
      emergency-bg: "#fff1f2" # rose-50
      success: "#10b981" # emerald-500
      success-bg: "#ecfdf5" # emerald-50
      warning: "#f59e0b" # amber-500
      warning-bg: "#fffbeb" # amber-50
  typography:
    family:
      sans: "'DM Sans', sans-serif"
    size:
      display: "30px" # text-3xl
      header: "18px" # text-lg
      body: "14px" # text-sm
      caption: "12px" # text-xs
      micro: "10px" # text-[10px]
    weight:
      black: "900"
      bold: "700"
      medium: "500"
      regular: "400"
  spacing:
    section: "32px" # p-8
    card-padding: "24px" # p-6
    element-gap: "24px" # gap-6
    inline-gap: "16px" # gap-4
  radii:
    bento: "20px"
    xl: "12px"
    full: "9999px"
  elevation:
    shadow-sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
    shadow-md: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
    shadow-lg: "0 10px 15px -3px rgb(0 0 0 / 0.1)"
    shadow-accent: "0 10px 15px -3px rgba(13, 148, 136, 0.2)"
  motion:
    standard-entry: "opacity: 0, y: 10 -> opacity: 1, y: 0"
    duration: "200ms"
---

# Design System: Main St. Co-op Admin Terminal

## Vision
The Main St. Co-op Admin Terminal is designed to distill complex property management data into an interface that feels both **hyper-efficient** and **luxuriously clean**. It moves away from the sterile, spreadsheet-like nature of traditional enterprise software towards a tactile, accessible "Bento Box" aesthetic.

## Aesthetic Pillars

### 1. The Bento Grid
Information is partitioned into distinct, high-contrast modules (cards). Each card acts as an independent focal point, preventing cognitive overload. The use of a generous `20px` border radius (`--radius-bento`) softens the structural grid, making the dashboard feel like an approachable physical console rather than an intimidating data wall.

### 2. Operational Teal
The primary accent color, **Teal Accent (`#0D9488`)**, serves as the system's "active" signal. It is used sparingly for primary actions, navigation states, and success indicators. By pairing this with a muted, cool-toned background (`#f7f9fb`), the interface maintains a sense of calm reliability.

### 3. High-Contrast Typography
The system leverages **DM Sans** to create a clear hierarchy.
- **Extreme Contrast:** Using `font-black` (900 weight) for numbers and key headings creates a striking visual rhythm.
- **Utility Captions:** Micro-typography (`10px` uppercase with wide tracking) is used for labels and metadata, providing density without clutter.

### 4. Meaningful Motion
Transitions are functional, not decorative. Page entries use a subtle `y-offset` motion to lead the user's eye from top to bottom, while modals utilize scale and backdrop blurs to establish clear focal priority.

## Core Components

- **The Modern Sidebar:** A white monolith with rounded-full interactive states, providing persistent, low-friction navigation.
- **The Global Header:** A thin translucent layer that anchors the user with search and status indicators without consuming vertical space.
- **Status Pills:** Color-coded micro-elements (`rose`, `amber`, `emerald`) provide at-a-glance health checks for maintenance and occupancy.

## Implementation Notes
- **Spacing:** The system strictly adheres to an 8px grid, with `24px` (3rem) being the standard architectural gap.
- **Interactivity:** Every clickable element should utilize an `active:scale-95` transform to provide tactile "press" feedback, reinforcing the console-like feel.
