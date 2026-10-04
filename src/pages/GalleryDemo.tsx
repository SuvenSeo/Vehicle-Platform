import type { CarListing } from "@/types/car";
import { ListingCard } from "@/components/ListingCard";
import { ListingImageCarousel } from "@/components/ListingImageCarousel";

/**
 * Internal gallery demo for the ui-review/19-listing-gallery branch.
 * Shows the multi-photo carousel exactly as it will render once scrapers
 * populate `images` (today only ikman rows carry galleries, and only after
 * a re-scrape). Demo data uses real source CDN photos. NOT a product
 * surface — gated behind `?galleryDemo=1` (see App.tsx) and removed before
 * the main merge.
 */

const DEMO_GALLERY = [
  "https://i.ikman-st.com/subaru-sambar-tt1-2002-for-sale-colombo/6c8aa52d-cd6a-4a50-8673-5244a9b10b3c/1080/810/cropped.jpg",
  "https://i.ikman-st.com/toyota-dyna-adi-105-power-gate-2018-for-sale-gampaha/f52cbd5a-c178-4de5-b232-ea3c25c7edef/1080/810/cropped.jpg",
  "https://i.ikman-st.com/suzuki-carry-auto-power-shutter-2023-for-sale-colombo/2fa1c44a-a5ab-4ade-b25b-8876550eaa5b/1080/810/cropped.jpg",
  "https://i.ikman-st.com/mahindra-bolero-2011-for-sale-nuwara-eliya-9/02c839e8-1a8d-4211-bcd7-547ba2c6d353/1080/810/cropped.jpg",
  "https://i.ikman-st.com/dfsk-v27-unimo-lokka-2012-for-sale-ratnapura/8c5b793c-54c9-4f27-afdb-df7d9abe9a69/1080/810/cropped.jpg",
];

function demoListing(id: number, title: string, images: string[]): CarListing {
  const [make, model] = title.split(" ").slice(0, 2);
  return {
    id,
    source: "ikman",
    source_id: `demo-${id}`,
    url: "https://ikman.lk",
    title,
    make: make || "Toyota",
    model: model || "Prius",
    year: 2019,
    price_lkr: 8_950_000,
    mileage_km: 45000,
    fuel_type: "Petrol",
    transmission: "Automatic",
    condition: "Used",
    district: "Colombo",
    city: "Colombo",
    thumbnail_url: images[0],
    images,
    first_seen_at: new Date().toISOString(),
    scraped_at: new Date().toISOString(),
    deal_score: 7.5,
    market_median_lkr: 9_200_000,
    is_active: true,
  } as unknown as CarListing;
}

export default GalleryDemo;

export function GalleryDemo() {
  const multi = demoListing(1, "Subaru Sambar 2002", DEMO_GALLERY);
  const single = demoListing(2, "Honda Vezel 2018", [
    // Snapshots serve the upgraded full-size variant (220x165 thumb -> 1024x768).
    "https://riyasewana.com/uploads/honda-vezel-sensing-42058444711.jpg",
  ]);

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 sm:px-6">
      <p className="mb-2 inline-block rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[11px] font-semibold text-amber-300">
        UI REVIEW ONLY — demo data, not a product page
      </p>
      <h1 className="font-display text-2xl font-semibold">Listing photo galleries</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Cards show arrows on hover, dots, and a photo counter when a listing has more than
        one photo. The detail view adds a thumbnail strip, swipe, keyboard arrows, and a
        fullscreen viewer. Single-photo listings render exactly as before.
      </p>

      <h2 className="mt-10 text-sm font-semibold text-muted-foreground">Inventory cards</h2>
      <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <ListingCard listing={multi} priority />
        <ListingCard listing={single} />
      </div>

      <h2 className="mt-10 text-sm font-semibold text-muted-foreground">
        Detail-page gallery (5 photos)
      </h2>
      <div className="mt-3 overflow-hidden rounded-[2rem] border border-border bg-card shadow-soft">
        <ListingImageCarousel
          images={DEMO_GALLERY}
          alt="Subaru Sambar 2002"
          variant="detail"
          className="aspect-[16/10] w-full"
        />
      </div>
    </div>
  );
}
