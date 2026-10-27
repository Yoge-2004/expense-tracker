package com.example.expensetracker.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "User appearance, dynamic theming palette, and studio preferences")
public record UserAppearanceDto(
        @Schema(description = "Selected font choice ('grotesk', 'fraunces', 'mono', 'system', 'custom')", example = "grotesk")
        @Size(max = 50, message = "Font choice is too long")
        String fontChoice,

        @Schema(description = "Custom font family name if outsourced font is uploaded", example = "CustomFont")
        @Size(max = 100, message = "Font family name is too long")
        String customFontFamily,

        @Schema(description = "Base64 data or URI for outsourced font file")
        @Size(max = 10_000_000, message = "Custom font data is too large")
        String customFontData,

        @Schema(description = "Preset theme ID", example = "default")
        @Size(max = 50, message = "Preset id is too long")
        String presetId,

        @Schema(description = "Primary brand color hex", example = "#C79A3E")
        @Size(max = 30, message = "Colour value is too long")
        String primaryColor,

        @Schema(description = "Primary gradient end color hex", example = "#A97F2E")
        @Size(max = 30, message = "Colour value is too long")
        String primaryGradientEnd,

        @Schema(description = "Accent color hex", example = "#A23E32")
        @Size(max = 30, message = "Colour value is too long")
        String accentColor,

        @Schema(description = "Highlight color hex", example = "#4C7A78")
        @Size(max = 30, message = "Colour value is too long")
        String highlightColor,

        @Schema(description = "Card surface background color", example = "rgba(23, 26, 20, 0.88)")
        @Size(max = 50, message = "Colour value is too long")
        String cardSurface,

        @Schema(description = "Surface background hex", example = "#171A14")
        @Size(max = 30, message = "Colour value is too long")
        String surface,

        @Schema(description = "Border accent color", example = "rgba(199, 154, 62, 0.35)")
        @Size(max = 50, message = "Colour value is too long")
        String borderAccent,

        @Schema(description = "Wallpaper type ('preset', 'custom', 'none')", example = "preset")
        @Pattern(regexp = "preset|custom|none", message = "Wallpaper type must be preset, custom or none")
        String wallpaperType,

        @Schema(description = "Wallpaper image URI or URL")
        @Size(max = 10_000_000, message = "Wallpaper data is too large")
        String wallpaperUri,

        @Schema(description = "Overlay opacity between 0.0 and 0.9", example = "0.35")
        @DecimalMin(value = "0.0", message = "Overlay opacity must be between 0 and 1")
        @DecimalMax(value = "1.0", message = "Overlay opacity must be between 0 and 1")
        Double overlayOpacity,

        @Schema(description = "Background blur intensity between 0 and 20", example = "0")
        @Min(value = 0, message = "Blur intensity must be between 0 and 50")
        @Max(value = 50, message = "Blur intensity must be between 0 and 50")
        Integer blurIntensity
) {
}
