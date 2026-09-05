# Motormila v1: minifyEnabled=false, so these rules are dormant until v2.
# Kept so enabling R8 later is a one-line change in app/build.gradle.kts.

# --- kotlinx.serialization ---
-keepattributes *Annotation*, InnerClasses
-dontnote kotlinx.serialization.**
-keepclassmembers class kotlinx.serialization.json.** { *; }
-keepclasseswithmembernames class * {
    kotlinx.serialization.KSerializer serializer(...);
}
# Keep all @Serializable DTOs (data/domain builder owns them under lk.motormila.app.*)
-keep @kotlinx.serialization.Serializable class lk.motormila.app.** { *; }
-keepclassmembers @kotlinx.serialization.Serializable class lk.motormila.app.** { *; }

# --- Retrofit / OkHttp ---
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature, InnerClasses, EnclosingMethod
-keepattributes RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations
-keepclassmembers,allowshrinking,allowobfuscation interface * {
    @retrofit2.http.* <methods>;
}
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep class okio.** { *; }

# --- Room ---
-keep class * extends androidx.room.RoomDatabase
-keep @androidx.room.Entity class *
-dontwarn androidx.room.paging.**

# --- Hilt / Dagger ---
-keep class dagger.hilt.** { *; }
-keep class * extends dagger.hilt.internal.GeneratedComponent { *; }
-keepclasseswithmembernames class * {
    @dagger.hilt.android.lifecycle.HiltViewModel <init>(...);
}

# --- Navigation Compose (type-safe routes use @Serializable, covered above) ---
-keep class lk.motormila.app.ui.navigation.** { *; }

# --- ML Kit ---
-keep class com.google.mlkit.** { *; }
-dontwarn com.google.mlkit.**
-keep class com.google.android.gms.internal.mlkit.** { *; }

# --- Coil 3 ---
-keep class coil3.** { *; }
-dontwarn coil3.**
