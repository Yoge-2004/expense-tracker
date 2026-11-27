package com.example.expensetracker.domain.user.service;

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
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;

import com.example.expensetracker.domain.user.model.User;
import com.example.expensetracker.infrastructure.exception.FileStorageException;



/**
 * Production implementation of {@link UserAvatarService} handling avatar
 * disk I/O, resizing, bilinear filtering, and JPEG/PNG compression.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserAvatarServiceImpl implements UserAvatarService {

    private static final long MAX_UPLOAD_BYTES = 5L * 1024 * 1024;
    private static final long MAX_IMAGE_PIXELS = 16_777_216L;
    private static final int MAX_IMAGE_DIMENSION = 8_192;
    private static final int AVATAR_DIMENSION = 256;
    private static final List<String> AVATAR_EXTENSIONS = List.of(".jpg", ".png", ".webp", ".gif", ".img");

    private final UserProfileService userService;

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
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException("Avatar file size must not exceed 5MB");
        }

        try {
            byte[] rawBytes = file.getBytes();
            EncodedAvatar encodedAvatar = encodeAvatar(rawBytes);
            Path avatarDir = getAvatarDir();
            Files.createDirectories(avatarDir);
            Path targetFile = avatarDir.resolve("user_" + userId + encodedAvatar.extension());
            Path temporaryFile = Files.createTempFile(avatarDir, "avatar-", ".tmp");
            Path metaFile = avatarDir.resolve("user_" + userId + ".meta");
            try {
                Files.write(temporaryFile, encodedAvatar.bytes());
                try {
                    Files.move(temporaryFile, targetFile, StandardCopyOption.ATOMIC_MOVE,
                            StandardCopyOption.REPLACE_EXISTING);
                } catch (AtomicMoveNotSupportedException _) {
                    Files.move(temporaryFile, targetFile, StandardCopyOption.REPLACE_EXISTING);
                }
                Files.writeString(metaFile, encodedAvatar.contentType());
                for (String oldExt : AVATAR_EXTENSIONS) {
                    if (!oldExt.equals(encodedAvatar.extension())) {
                        Files.deleteIfExists(avatarDir.resolve("user_" + userId + oldExt));
                    }
                }
                String avatarUrl = "/api/users/" + userId + "/avatar?v=" + java.time.Instant.now().toEpochMilli();
                userService.updateProfilePicture(userId, avatarUrl);
                return avatarUrl;
            } finally {
                Files.deleteIfExists(temporaryFile);
            }
        } catch (IOException e) {
            log.error("Failed to store avatar file for userId={}: {}", userId, e.getMessage(), e);
            throw new com.example.expensetracker.infrastructure.exception.FileStorageException("Could not store avatar image", e);
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
                    String contentType = contentTypeForExtension(ext);
                    if (Files.exists(metaFile)) {
                        String savedType = Files.readString(metaFile).trim().toLowerCase(Locale.ROOT);
                        if (savedType.equals("image/jpeg") || savedType.equals("image/png")) {
                            contentType = savedType;
                        }
                    }
                    if (!contentType.equals(contentTypeForExtension(ext))) continue;
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
                log.debug("Notice while purging avatar file extension {} during deletion for userId={}: {}", ext, userId, ex.getMessage());
            }
        }
        userService.updateProfilePicture(userId, null);
    }

    private EncodedAvatar encodeAvatar(byte[] rawBytes) throws IOException {
        if (rawBytes.length == 0) throw new IllegalArgumentException("Avatar file must not be empty");
        try (ImageInputStream input = ImageIO.createImageInputStream(new ByteArrayInputStream(rawBytes))) {
            if (input == null) throw new IllegalArgumentException("Avatar must be a valid JPEG, PNG, or GIF image");
            Iterator<ImageReader> readers = ImageIO.getImageReaders(input);
            if (!readers.hasNext()) throw new IllegalArgumentException("Avatar must be a valid JPEG, PNG, or GIF image");
            ImageReader reader = readers.next();
            try {
                reader.setInput(input, true, true);
                String format = reader.getFormatName().toLowerCase(Locale.ROOT);
                if (!List.of("jpeg", "jpg", "png", "gif").contains(format)) {
                    throw new IllegalArgumentException("Only JPEG, PNG, and GIF avatars are supported");
                }
                int width = reader.getWidth(0);
                int height = reader.getHeight(0);
                if (width <= 0 || height <= 0 || width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION
                        || (long) width * height > MAX_IMAGE_PIXELS) {
                    throw new IllegalArgumentException("Avatar dimensions exceed the supported limit");
                }
                BufferedImage original = reader.read(0);
                if (original == null) throw new IllegalArgumentException("Avatar image could not be decoded");
                boolean keepAlpha = format.equals("png") && original.getColorModel().hasAlpha();
                int targetWidth = Math.min(width, AVATAR_DIMENSION);
                int targetHeight = Math.min(height, AVATAR_DIMENSION);
                if (width > height) targetHeight = Math.max(1, (int) Math.round((double) height * targetWidth / width));
                else targetWidth = Math.max(1, (int) Math.round((double) width * targetHeight / height));

                int imageType = keepAlpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB;
                BufferedImage resized = new BufferedImage(targetWidth, targetHeight, imageType);
                Graphics2D graphics = resized.createGraphics();
                try {
                    graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,
                            RenderingHints.VALUE_INTERPOLATION_BILINEAR);
                    graphics.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
                    graphics.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
                    if (!keepAlpha) {
                        graphics.setColor(Color.WHITE);
                        graphics.fillRect(0, 0, targetWidth, targetHeight);
                    }
                    graphics.drawImage(original, 0, 0, targetWidth, targetHeight, null);
                } finally {
                    graphics.dispose();
                }
                String outputFormat = keepAlpha ? "png" : "jpg";
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                if (keepAlpha) {
                    ImageIO.write(resized, outputFormat, output);
                } else {
                    Iterator<ImageWriter> writers = ImageIO.getImageWritersByFormatName(outputFormat);
                    if (!writers.hasNext()) throw new IOException("No JPEG encoder is available");
                    ImageWriter writer = writers.next();
                    try (ImageOutputStream imageOutput = ImageIO.createImageOutputStream(output)) {
                        writer.setOutput(imageOutput);
                        ImageWriteParam parameters = writer.getDefaultWriteParam();
                        if (parameters.canWriteCompressed()) {
                            parameters.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
                            parameters.setCompressionQuality(0.82f);
                        }
                        writer.write(null, new IIOImage(resized, null, null), parameters);
                    } finally {
                        writer.dispose();
                    }
                }
                String contentType = keepAlpha ? "image/png" : "image/jpeg";
                String extension = keepAlpha ? ".png" : ".jpg";
                log.debug("Normalized avatar from {}x{} {} to {}x{} {}", width, height, format,
                        targetWidth, targetHeight, contentType);
                return new EncodedAvatar(output.toByteArray(), contentType, extension);
            } finally {
                reader.dispose();
            }
        }
    }

    private String contentTypeForExtension(String extension) {
        return switch (extension) {
            case ".png" -> "image/png";
            case ".webp" -> "image/webp";
            case ".gif" -> "image/gif";
            case ".img" -> "application/octet-stream";
            default -> "image/jpeg";
        };
    }

    private record EncodedAvatar(byte[] bytes, String contentType, String extension) {
    }
}
