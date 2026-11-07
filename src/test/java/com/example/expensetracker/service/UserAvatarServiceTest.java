package com.example.expensetracker.service;

import com.example.expensetracker.model.User;
import com.example.expensetracker.service.impl.UserAvatarServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.nio.file.Path;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserAvatarServiceTest {

    @Mock
    private UserService userService;

    private UserAvatarServiceImpl userAvatarService;

    @BeforeEach
    void setUp() {
        userAvatarService = new UserAvatarServiceImpl(userService);
    }

    @Test
    void storeAvatarRejectsEmptyFile() {
        MockMultipartFile emptyFile = new MockMultipartFile("file", "empty.png", "image/png", new byte[0]);
        assertThatThrownBy(() -> userAvatarService.storeAvatar(1L, emptyFile))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Avatar file must not be empty");
    }

    @Test
    void storeAvatarRejectsOversizedFile() {
        byte[] largeBytes = new byte[6 * 1024 * 1024]; // 6MB
        MockMultipartFile file = new MockMultipartFile("file", "large.png", "image/png", largeBytes);
        assertThatThrownBy(() -> userAvatarService.storeAvatar(1L, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Avatar file size must not exceed 5MB");
    }

    @Test
    void storeAvatarRejectsNonImageFile() {
        MockMultipartFile file = new MockMultipartFile("file", "test.pdf", "application/pdf", new byte[]{1, 2, 3});
        assertThatThrownBy(() -> userAvatarService.storeAvatar(1L, file))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Only image files");
    }

    @Test
    void storeAvatarCompressesImageAndUpdatesUserService() throws Exception {
        BufferedImage img = new BufferedImage(300, 300, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = img.createGraphics();
        g.setColor(Color.RED);
        g.fillRect(0, 0, 300, 300);
        g.dispose();

        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(img, "jpg", baos);
        byte[] bytes = baos.toByteArray();

        MockMultipartFile file = new MockMultipartFile("file", "avatar.jpg", "image/jpeg", bytes);

        String resultUrl = userAvatarService.storeAvatar(999L, file);

        assertThat(resultUrl).startsWith("/api/users/999/avatar?v=");
        verify(userService).updateProfilePicture(eq(999L), eq(resultUrl));

        // Verify retrieval works
        Optional<UserAvatarService.AvatarContent> content = userAvatarService.getAvatar(999L);
        assertThat(content).isPresent();
        assertThat(content.get().data()).isNotNull();

        // Clean up
        userAvatarService.deleteAvatar(999L);
        verify(userService).updateProfilePicture(999L, null);
    }

    @Test
    void getAvatarResolvesSafeExternalOAuthUrl() {
        User user = new User();
        user.setId(888L);
        user.setProfilePictureUrl("https://lh3.googleusercontent.com/a/test-pic");
        when(userService.findById(888L)).thenReturn(Optional.of(user));

        Optional<UserAvatarService.AvatarContent> content = userAvatarService.getAvatar(888L);
        assertThat(content).isPresent();
        assertThat(content.get().isRedirect()).isTrue();
        assertThat(content.get().redirectUrl()).isEqualTo("https://lh3.googleusercontent.com/a/test-pic");
    }

    @Test
    void getAvatarBlocksUntrustedExternalUrl() {
        User user = new User();
        user.setId(777L);
        user.setProfilePictureUrl("https://malicious-site.com/exploit.jpg");
        when(userService.findById(777L)).thenReturn(Optional.of(user));

        Optional<UserAvatarService.AvatarContent> content = userAvatarService.getAvatar(777L);
        assertThat(content).isEmpty();
    }
}
