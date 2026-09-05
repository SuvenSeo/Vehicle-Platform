package lk.motormila.app.ui.theme

import androidx.compose.ui.graphics.Color

// Dark-first tokens — Motormila "What if Apple built a Sri Lankan automotive platform"
// Canonical brand colors matching web platform (tailwind.config.ts & index.css)
val MotormilaBg = Color(0xFF09090B)           // #09090b charcoal canvas
val MotormilaSurface = Color(0xFF0F0F12)      // #0f0f12 elevated card surface
val MotormilaSurfaceLow = Color(0xFF0D0D10)   // #0d0d10 surface low
val MotormilaSurfaceHigh = Color(0xFF16161A)  // #16161a higher elevation
val MotormilaSurfaceHighest = Color(0xFF1F1F24) // #1f1f24 highest elevation
val MotormilaOnSurface = Color(0xFFF5F5F7)    // #f5f5f7 pure white text
val MotormilaSecondaryText = Color(0xFF8E8E93) // #8e8e93 Apple secondary label
val MotormilaOutline = Color(0x1FFFFFFF)      // Hairline rgba(255, 255, 255, 0.12)
val MotormilaGlassBorder = Color(0x14FFFFFF) // 1px subtle glass edge rgba(255, 255, 255, 0.08)

// Brand accent: Motormila Electric Blue (#0A7AFF / #3D94FF)
val MotormilaPrimary = Color(0xFF0A7AFF)      // Motormila system electric blue
val MotormilaPrimaryBright = Color(0xFF3D94FF)
val MotormilaPrimaryGlow = Color(0x330A7AFF)
val MotormilaOnPrimary = Color(0xFFFFFFFF)

// Legacy alias kept for backwards compatibility with any remaining call site
val MotormilaGold = Color(0xFF0A7AFF)         // Re-mapped to Motormila Primary Electric Blue
val MotormilaOnGold = Color(0xFFFFFFFF)

// Semantic deal & signal tokens
val MotormilaTeal = Color(0xFF38BDF8)         // Cyan/Sky accent
val MotormilaSky = Color(0xFF3D94FF)          // Sky blue
val MotormilaGood = Color(0xFF10B981)         // Emerald 500 (Great deal)
val MotormilaGoodContainer = Color(0x2E10B981)
val MotormilaGoodText = Color(0xFF6EE7B7)
val MotormilaWarn = Color(0xFFF59E0B)         // Amber (Fair deal / warning)
val MotormilaWarnContainer = Color(0x2EF59E0B)
val MotormilaBad = Color(0xFFEF4444)          // Rose red (Overpriced / error)
val MotormilaBadContainer = Color(0x2EEF4444)

// Light scheme tokens
val MotormilaLightBg = Color(0xFFFBFBFD)      // Apple off-white
val MotormilaLightSurface = Color(0xFFFFFFFF)
val MotormilaLightContainer = Color(0xFFF5F5F7)
val MotormilaLightHigh = Color(0xFFEBEBF0)
val MotormilaLightOnSurface = Color(0xFF1A1A1C)
val MotormilaLightVariant = Color(0xFF6E6E73)
val MotormilaLightPrimary = Color(0xFF0A7AFF)
val MotormilaLightOnPrimary = Color(0xFFFFFFFF)
val MotormilaLightGoldContainer = Color(0x1A0A7AFF)
val MotormilaLightGood = Color(0xFF059669)
val MotormilaLightWarn = Color(0xFFD97706)
val MotormilaLightBad = Color(0xFFDC2626)
val MotormilaLightOutline = Color(0x1A000000)
