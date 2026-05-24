# CRM + Sales Performance Platform Implementation Plan

## Design System
- **Colors**: Deep Green (#0B6E4F) for Primary, Gold (#F4B400) for Accent.
- **Typography**: Inter (System Font fallback).
- **Style**: Rounded cards (12px), smooth shadows, 'Extreme Simplicity'.
- **Responsive**: Mobile-first sidebar, desktop collapsible menu.

## Tech Stack
- React 19 + Vite + TypeScript.
- Tailwind CSS (v4 style, inline @theme).
- Framer Motion for success animations.
- Lucide React for icons.
- Sonner for notifications.
- Shadcn UI for core components (Button, Dialog, Card, Progress, etc.).

## Components to Build
1. **Layout Shell**: Sidebar (navigation) and Topbar (user profile, search).
2. **Dashboard Views**:
   - **Sales Agent**: Minimalist, personal progress (progress bars), today's sales, Top-5 leaderboard.
   - **Admin/Manager**: Same as agent + team-wide statistics and management tools.
3. **Quick Add Sale**: Minimalist modal with one-click data entry (Amount, Product dropdown).
4. **Leaderboard**: Visual list of top-5 agents with success badges.
5. **Real-time Updates**: Mock implementation (simulating Supabase).
6. **Animations**: Success confetti/animation after a sale is added.

## File Structure
- `src/App.tsx`: Routing (simulated via state for role switching) and layout.
- `src/lib/types.ts`: TypeScript interfaces.
- `src/components/Dashboard.tsx`: Main dashboard container.
- `src/components/QuickAddSale.tsx`: Minimalist modal.
- `src/components/Leaderboard.tsx`: Top-5 visual list.
- `src/components/StatsGrid.tsx`: Progress bars and KPI cards.
- `src/components/RoleSwitcher.tsx`: Utility to toggle roles (for demo).

## Implementation Steps
1. Update `src/index.css` with the Gebeya color theme.
2. Define types in `src/lib/types.ts`.
3. Build the core components.
4. Assemble in `src/App.tsx`.
5. Add interactivity and success animations.
