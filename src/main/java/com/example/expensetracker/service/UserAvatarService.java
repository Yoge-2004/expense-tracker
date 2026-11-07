package com.example.expensetracker.service;

import org.springframework.web.multipart.MultipartFile;

import java.util.Optional;

/**
 * Service for user profile picture storage, compression, and delivery.
 * Decouples filesystem and image manipulation from REST controllers.
 */
public interface UserAvatarService {

    /**
     * Compresses and persists an uploaded avatar image for the user.
     *
     * @param userId ID of the user
     * @param file   uploaded multipart image
     * @return relative URL for fetching the updated avatar
     */
    String storeAvatar(Long userId, MultipartFile file);

    /**
     * Resolves the user's avatar binary content or redirect URL.
     *
     * @param userId ID of the user
     * @return optional containing the avatar binary payload or CDN redirect URL
     */
    Optional<AvatarContent> getAvatar(Long userId);

    /**
     * Removes the user's stored avatar files from disk.
     *
     * @param userId ID of the user
     */
    void deleteAvatar(Long userId);

    /**
     * Representation of resolved avatar content.
     */
    record AvatarContent(byte[] data, String contentType, String redirectUrl) {
        public boolean isRedirect() {
            return redirectUrl != null && !redirectUrl.isBlank();
        }
    }
}
