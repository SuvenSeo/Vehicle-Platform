/**
 * Canonical Motormila visual assets (repo-root `assets/*.webp`).
 * Import here so Vite hashes URLs and pages share one placement map.
 */
import darkGarageSilhouette from "../../assets/dark_garage_silhouette.webp";
import lostCarFork404 from "../../assets/lost_car_fork_404.webp";
import emptyState from "../../assets/empty_state.webp";
import priceIntelligenceBg from "../../assets/price_intelligence_bg.webp";
import pageAdminBg from "../../assets/page_admin_bg.webp";
import trustVerification from "../../assets/trust_verification.webp";
import alt2HeroOrangeSunset from "../../assets/alt2_hero_orange_sunset.webp";
import altCategorySuvWhite from "../../assets/alt_category_suv_white.webp";
import pageProPremium from "../../assets/page_pro_premium.webp";
import alt2PagePricingBg from "../../assets/alt2_page_pricing_bg.webp";
import alt2BlogTeaPlantation from "../../assets/alt2_blog_tea_plantation.webp";
import pageBlogHeader from "../../assets/page_blog_header.webp";
import categoriesLineup from "../../assets/categories_lineup.webp";
import alt2HeroUltrawidePanorama from "../../assets/alt2_hero_ultrawide_panorama.webp";
import pageSearchHero from "../../assets/page_search_hero.webp";
import alt2PageInsuranceFinance from "../../assets/alt2_page_insurance_finance.webp";
import pageCompareHero from "../../assets/page_compare_hero.webp";
import pageFooterTexture from "../../assets/page_footer_texture.webp";
import pageFaqIllustration from "../../assets/page_faq_illustration.webp";
import pageListingDetail from "../../assets/page_listing_detail.webp";

export const visuals = {
  darkGarageSilhouette,
  lostCarFork404,
  emptyState,
  priceIntelligenceBg,
  pageAdminBg,
  trustVerification,
  alt2HeroOrangeSunset,
  altCategorySuvWhite,
  pageProPremium,
  alt2PagePricingBg,
  alt2BlogTeaPlantation,
  pageBlogHeader,
  categoriesLineup,
  alt2HeroUltrawidePanorama,
  pageSearchHero,
  alt2PageInsuranceFinance,
  pageCompareHero,
  pageFooterTexture,
  pageFaqIllustration,
  pageListingDetail,
} as const;

export type VisualKey = keyof typeof visuals;
