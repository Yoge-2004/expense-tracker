package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "User appearance, dynamic theming palette, and studio preferences")
public record UserAppearanceDto(
        @Schema(description = "Selected font choice ('grotesk', 'fraunces', 'mono', 'system', 'custom')", example = "grotesk")
        String fontChoice,

        @Schema(description = "Custom font family name if outsourced font is uploaded", example = "CustomFont")
        String customFontFamily,

        @Schema(description = "Base64 data or URI for outsourced font file")
        String customFontData,

        @Schema(description = "Preset theme ID", example = "default")
        String presetId,

        @Schema(description = "Primary brand color hex", example = "#C79A3E")
        String primaryColor,

        @Schema(description = "Primary gradient end color hex", example = "#A97F2E")
        String primaryGradientEnd,

        @Schema(description = "Accent color hex", example = "#A23E32")
        String accentColor,

        @Schema(description = "Highlight color hex", example = "#4C7A78")
        String highlightColor,

        @Schema(description = "Card surface background color", example = "rgba(23, 26, 20, 0.88)")
        String cardSurface,

        @Schema(description = "Surface background hex", example = "#171A14")
        String surface,

        @Schema(description = "Border accent color", example = "rgba(199, 154, 62, 0.35)")
        String borderAccent,

        @Schema(description = "Wallpaper type ('preset', 'custom', 'none')", example = "preset")
        String wallpaperType,

        @Schema(description = "Wallpaper image URI or URL")
        String wallpaperUri,

        @Schema(description = "Overlay opacity between 0.0 and 0.9", example = "0.35")
        Double overlayOpacity,

        @Schema(description = "Background blur intensity between 0 and 20", example = "0")
        Integer blurIntensity
) {
}
