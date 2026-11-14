package com.example.expensetracker.domain.user.service;

import java.util.List;
import java.util.Optional;

import com.example.expensetracker.domain.user.model.User;



/**
 * Segregated service contract dedicated to reading and updating personal profile attributes.
 *
 * <p>Fulfills the Interface Segregation Principle (ISP) by separating user profile queries,
 * name updates, currency preferences, and username recommendations from administrative or authentication operations.</p>
 *
 * @author Yogeshwaran
 */
public interface UserProfileService {

    /**
     * Looks up a user account by database primary key.
     *
     * @param id numeric user ID
     * @return Optional containing the user if found
     */
    Optional<User> findById(Long id);

    /**
     * Looks up a user account by email address.
     *
     * @param email email address to find
     * @return Optional containing the user if found
     */
    Optional<User> findByEmail(String email);

    /**
     * Looks up a user account by email address or username handle.
     *
     * @param identifier email or username
     * @return Optional containing the user if found
     */
    Optional<User> findByIdentifier(String identifier);

    /**
     * Updates the full display name for the given user account.
     *
     * @param userId user identifier
     * @param name   new display name
     */
    void updateName(Long userId, String name);

    /**
     * Updates the ISO 4217 display currency for the given user account.
     *
     * @param userId   user identifier
     * @param currency 3-letter currency code
     */
    void updateCurrency(Long userId, String currency);

    /**
     * Updates the profile avatar image URL for the given user account.
     *
     * @param userId            user identifier
     * @param profilePictureUrl URL of the avatar image
     */
    void updateProfilePicture(Long userId, String profilePictureUrl);

    /**
     * Generates creative unique username suggestions based on a seed name.
     *
     * @param base seed word or raw name
     * @return list of 3 available username handles
     */
    List<String> suggestUsernames(String base);
}
