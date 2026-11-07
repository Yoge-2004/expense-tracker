package com.example.expensetracker.service.impl;

import com.example.expensetracker.model.User;
import com.example.expensetracker.service.UserAvatarService;
import com.example.expensetracker.service.UserService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Production implementation of {@link UserAvatarService} handling avatar
 * disk I/O, resizing, bilinear filtering, and JPEG/PNG compression.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserAvatarServiceImpl implements UserAvatarService {

    private final UserService userService;

    private Path getAvatarDir() {
        String dataDir = System.getenv("DATA_DIR");
        if (dataDir != null && !dataDir.isBlank()) {
            return Path.of(dataDir, "avatars");
        }
        return Path.of(System.getProperty("user.home"), ".expensetracker", "avatars");
    }

    @Override
    public String storeAvatar(Long userId, MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Avatar file must not be empty");
        }
        if (file.getSize() > 5 * 1024 * 1024) {
            throw new IllegalArgumentException("Avatar file size must not exceed 5MB");
        }
        String contentType = file.getContentType();
        if (contentType == null || !contentType.toLowerCase(Locale.ROOT).startsWith("image/")) {
            throw new IllegalArgumentException("Only image files (JPEG, PNG, WebP, GIF) are supported");
        }

        try {
            Path avatarDir = getAvatarDir();
            Files.createDirectories(avatarDir);

            String ext = ".jpg";
            String lower = contentType.toLowerCase(Locale.ROOT);
            if (lower.contains("png")) ext = ".png";
            else if (lower.contains("webp")) ext = ".webp";
            else if (lower.contains("gif")) ext = ".gif";

            // Remove existing avatar files for this user
            for (String oldExt : List.of(".jpg", ".png", ".webp", ".gif", ".img")) {
                try {
                    Files.deleteIfExists(avatarDir.resolve("user_" + userId + oldExt));
                } catch (Exception ex) {
                    log.debug("Notice while removing old avatar extension {} for userId={}: {}", oldExt, userId, ex.getMessage());
                }
            }

            byte[] rawBytes = file.getBytes();
            byte[] compressedBytes = compressAvatarImage(rawBytes, contentType);
            boolean isCompressed = compressedBytes != null && compressedBytes.length < rawBytes.length;
            String savedContentType = isCompressed && !contentType.toLowerCase(Locale.ROOT).contains("png")
                    ? "image/jpeg"
                    : contentType;
            if (isCompressed && "image/jpeg".equals(savedContentType)) {
                ext = ".jpg";
            }

            Path targetFile = avatarDir.resolve("user_" + userId + ext);
            Files.write(targetFile, isCompressed ? compressedBytes : rawBytes);

            Path metaFile = avatarDir.resolve("user_" + userId + ".meta");
            Files.writeString(metaFile, savedContentType);

            String avatarUrl = "/api/users/" + userId + "/avatar?v=" + System.currentTimeMillis();
            userService.updateProfilePicture(userId, avatarUrl);

            return avatarUrl;
        } catch (IOException e) {
            log.error("Failed to store avatar file for userId={}: {}", userId, e.getMessage(), e);
            throw new RuntimeException("Could not store avatar image", e);
        }
    }

    @Override
    public Optional<AvatarContent> getAvatar(Long userId) {
        Path avatarDir = getAvatarDir();

        for (String ext : List.of(".jpg", ".png", ".webp", ".gif", ".img")) {
            Path file = avatarDir.resolve("user_" + userId + ext);
            if (Files.exists(file)) {
                try {
                    byte[] data = Files.readAllBytes(file);
                    Path metaFile = avatarDir.resolve("user_" + userId + ".meta");
                    String contentType = "image/jpeg";
                    if (Files.exists(metaFile)) {
                        contentType = Files.readString(metaFile).trim();
                    } else if (ext.equals(".png")) {
                        contentType = "image/png";
                    } else if (ext.equals(".webp")) {
                        contentType = "image/webp";
                    } else if (ext.equals(".gif")) {
                        contentType = "image/gif";
                    }
                    return Optional.of(new AvatarContent(data, contentType, null));
                } catch (IOException ex) {
                    log.warn("Could not read avatar file {} for userId={}: {}", file, userId, ex.getMessage());
                }
            }
        }

        User user = userService.findById(userId).orElse(null);
        if (user != null && user.getProfilePictureUrl() != null && !user.getProfilePictureUrl().isBlank()
                && !user.getProfilePictureUrl().contains("/avatar")) {
            String profileUrl = user.getProfilePictureUrl().trim();
            boolean isSafeExternal = profileUrl.startsWith("https://lh3.googleusercontent.com/")
                    || profileUrl.startsWith("https://avatars.githubusercontent.com/")
                    || profileUrl.startsWith("https://secure.gravatar.com/")
                    || profileUrl.startsWith("https://www.gravatar.com/");
            if (isSafeExternal) {
                return Optional.of(new AvatarContent(null, null, profileUrl));
            }
            log.warn("Blocked untrusted external avatar redirect for userId={}: {}", userId, profileUrl);
        }

        return Optional.empty();
    }

    @Override
    public void deleteAvatar(Long userId) {
        Path avatarDir = getAvatarDir();
        for (String ext : List.of(".jpg", ".png", ".webp", ".gif", ".img", ".meta")) {
            try {
                Files.deleteIfExists(avatarDir.resolve("user_" + userId + ext));
            } catch (Exception ex) {
                log.debug("Notice while removing old avatar extension {} for userId={}: {}", ext, userId, ex.getMessage());
            }
        }
        userService.updateProfilePicture(userId, null);
    }

    private byte[] compressAvatarImage(byte[] rawBytes, String contentType) {
        if (rawBytes == null || rawBytes.length == 0) return rawBytes;
        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(rawBytes);
            BufferedImage original = ImageIO.read(bais);
            if (original == null) {
                return rawBytes;
            }

            int origWidth = original.getWidth();
            int origHeight = original.getHeight();
            int maxDim = 256;
            int targetWidth = origWidth;
            int targetHeight = origHeight;

            if (origWidth > maxDim || origHeight > maxDim) {
                if (origWidth > origHeight) {
                    targetWidth = maxDim;
                    targetHeight = Math.max(1, (int) Math.round((double) origHeight * maxDim / origWidth));
                } else {
                    targetHeight = maxDim;
                    targetWidth = Math.max(1, (int) Math.round((double) origWidth * maxDim / origHeight));
                }
            }

            boolean isPng = contentType != null && contentType.toLowerCase(Locale.ROOT).contains("png");
            boolean hasAlpha = original.getColorModel().hasAlpha();

            int imageType = (hasAlpha && isPng)
                    ? BufferedImage.TYPE_INT_ARGB
                    : BufferedImage.TYPE_INT_RGB;
            BufferedImage resized = new BufferedImage(targetWidth, targetHeight, imageType);

            Graphics2D g2d = resized.createGraphics();
            try {
                g2d.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                if (imageType == BufferedImage.TYPE_INT_RGB) {
                    g2d.setColor(Color.WHITE);
                    g2d.fillRect(0, 0, targetWidth, targetHeight);
                }
                g2d.drawImage(original, 0, 0, targetWidth, targetHeight, null);
            } finally {
                g2d.dispose();
            }

            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            if (hasAlpha && isPng) {
                ImageIO.write(resized, "png", baos);
            } else {
                Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpg");
                if (writers.hasNext()) {
                    ImageWriter writer = writers.next();
                    try (ImageOutputStream ios = ImageIO.createImageOutputStream(baos)) {
                        writer.setOutput(ios);
                        ImageWriteParam param = writer.getDefaultWriteParam();
                        if (param.canWriteCompressed()) {
                            param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                            param.setCompressionQuality(0.82f);
                        }
                        writer.write(null, new IIOImage(resized, null, null), param);
                    } finally {
                        writer.dispose();
                    }
                } else {
                    ImageIO.write(resized, "jpg", baos);
                }
            }

            byte[] compressed = baos.toByteArray();
            if (compressed.length > 0 && compressed.length < rawBytes.length) {
                log.info("Compressed avatar image for storage: {} bytes -> {} bytes ({}% reduction)",
                        rawBytes.length, compressed.length,
                        Math.round((1.0 - (double) compressed.length / rawBytes.length) * 100));
                return compressed;
            }
            return rawBytes;
        } catch (Exception e) {
            log.warn("Avatar image compression failed, preserving original: {}", e.getMessage());
            return rawBytes;
        }
    }
}
