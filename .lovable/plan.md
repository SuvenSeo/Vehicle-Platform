
# AutoLens LK — Full App Scaffold with Mock Data

## Design System Setup
- Dark theme: bg `#0A0A0A`, surfaces `#141414`, cards `#1A1A1A`, borders `#2A2A2A`
- Accent colors: `#E63946` (red/deals), `#FFB703` (amber/warnings), `#06D6A0` (green/good deals)
- Google Fonts: Bebas Neue (headings), DM Sans (body)
- Custom Tailwind config with all color tokens

## Mock Data Layer
- Realistic Sri Lankan car listings (~50 entries) with Toyota, Honda, Suzuki, Nissan, etc.
- Conditions: brand_new, reconditioned, used with proper pricing
- Districts, deal scores, mileage, all fields populated
- API service module with mock data, easily swappable to real API via `VITE_API_URL`

## Pages & Features

### 1. Dashboard (Home `/`)
- **Top stats bar**: Total listings, avg price, good deals, weekly new, MoM % change
- **Left sidebar filters** (collapsible): Make → Model cascading dropdowns, year range slider, condition segmented control, body type pills, mileage slider, price range slider, transmission/fuel pills, district dropdown, sort dropdown, apply/clear buttons
- **Listings grid**: Responsive card layout with thumbnail, deal score badge, condition badge, price, specs pills, district, source icon, compare checkbox on hover, hover glow effect
- **Map toggle**: Full SVG choropleth of Sri Lanka's 25 districts colored by avg price
- **URL-synced filters**: All filter state reflected in query params for shareable links

### 2. Listing Detail (`/listing/:id`)
- Image gallery (placeholder images)
- Full specs table
- Deal score semicircular gauge (-100 to +100, color-coded)
- Price history line chart
- Market context box ("X% below/above median")
- Similar listings horizontal scroll

### 3. Market Trends (`/trends`)
- Make/Model cascading selector + condition filter
- Monthly median price line chart (Recharts)
- Depreciation curve (year vs price)
- Multi-model comparison (2-3 series)

### 4. Valuation Tool (`/estimate`)
- Form: Make/Model/Year/Condition/Mileage/Transmission/Fuel/District
- Result card: low–median–high price range bar, confidence badge, comparable count
- Comparable listings grid

### 5. AI Chat Widget
- Floating action button (red, bottom-right)
- Slide-up chat panel with pre-loaded suggestion chips
- Message bubbles with markdown rendering
- Mock responses initially

## Key Components
- `DealScoreGauge` — semicircular SVG gauge
- `ConditionBadge` — color-coded pill
- `PriceDropBadge` — amber price drop indicator
- `DistrictHeatmap` — Sri Lanka SVG choropleth
- `ComparisonModal` — side-by-side comparison of up to 3 vehicles
- Skeleton loaders for all data sections

## Responsive
- Mobile: sidebar becomes bottom sheet, 1-column grid
- Tablet: 2 columns
- Desktop: 3-4 columns
