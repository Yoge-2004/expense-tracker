package com.example.expensetracker.model;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Persists user personalization, dynamic theming palette, typography,
 * and wallpaper preferences for seamless cross-device cloud synchronization.
 */
@Entity
@Table(name = "user_appearance",
        uniqueConstraints = @UniqueConstraint(name = "uk_user_appearance_user", columnNames = "user_id"))
@Getter
@Setter
@NoArgsConstructor
public class UserAppearance extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "font_choice", length = 50)
    private String fontChoice;

    @Column(name = "custom_font_family", length = 100)
    private String customFontFamily;

    @Lob
    @Column(name = "custom_font_data", columnDefinition = "TEXT")
    private String customFontData;

    @Column(name = "preset_id", length = 50)
    private String presetId;

    @Column(name = "primary_color", length = 30)
    private String primaryColor;

    @Column(name = "primary_gradient_end", length = 30)
    private String primaryGradientEnd;

    @Column(name = "accent_color", length = 30)
    private String accentColor;

    @Column(name = "highlight_color", length = 30)
    private String highlightColor;

    @Column(name = "card_surface", length = 50)
    private String cardSurface;

    @Column(name = "surface", length = 30)
    private String surface;

    @Column(name = "border_accent", length = 50)
    private String borderAccent;

    @Column(name = "wallpaper_type", length = 30)
    private String wallpaperType;

    @Lob
    @Column(name = "wallpaper_uri", columnDefinition = "TEXT")
    private String wallpaperUri;

    @Column(name = "overlay_opacity")
    private Double overlayOpacity;

    @Column(name = "blur_intensity")
    private Integer blurIntensity;
}
