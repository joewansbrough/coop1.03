# Automated Guided Spotlight Demo Design

## Goal

Build a guided interactive demo mode for prospective customers. The demo should move a synthetic cursor through the site, spotlight important UI areas, explain the business value of each feature, and wait for the viewer to continue at key moments.

## Product Story

The demo positions coopHUB BC as a co-op-specific operations and governance platform, not a generic property portal. The story begins with board-level situational awareness, moves through maintenance and resident self-service, shows governance records and meeting minutes, and ends with the Policy Assistant as the payoff for organized records.

## Demo Stops

1. Dashboard mission control: maintenance pulse, quick actions, scheduled maintenance, building map, document watch, and configurable tiles.
2. Maintenance operations: active queue, priority/status controls, AI triage indicators, and resident-submitted request context.
3. Unit intelligence: unit record, resident history, linked maintenance, and co-op asset context.
4. Governance archive: document categories, storage/version labels, metadata review, upload and Drive-linking entry points, and AI readiness.
5. Meeting minutes workflow: calendar event, minutes tab, structured minutes record, motions, action items, PDF export/archive.
6. Policy Assistant: ask co-op policy questions against the organized archive.
7. Resident view: switch role and show member dashboard, personal requests, useful documents, calendar, committees, and request entry.

## UX

The automated demo is a guided spotlight, not a fully timed video. Each stop navigates to the right route, waits for the target area, moves a synthetic cursor to that area, draws a spotlight ring, and shows a compact narration card with Back, Next, Pause, and Exit controls. The viewer stays in control and can click around between stops.

The existing manual demo guide stays intact. The new experience appears as an additional "Automated Demo" launch path in demo mode.

## Architecture

Add a focused auto-demo module:

- `utils/autoDemo.ts`: typed stop definitions and pure helper functions for progress, routing, target lookup metadata, and controls.
- `components/AutoDemoTour.tsx`: overlay, cursor, spotlight positioning, navigation orchestration, and controls.
- Existing pages receive stable `data-demo-target` attributes on high-value UI elements.
- `components/DemoTrackPicker.tsx` and `components/Layout.tsx` mount and launch the auto-demo in demo mode.

## Testing

Add focused tests for the pure auto-demo module: stop ordering, route lookup, next/back progress, and required target metadata. Verify the full app with TypeScript and build after UI wiring.

