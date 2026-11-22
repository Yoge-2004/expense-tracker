package com.example.expensetracker.domain.ai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;
import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.awt.image.DataBufferByte;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

/**
 * Image enhancement preprocessor for optical character recognition (OCR).
 * Adheres to SRP by isolating computer vision transformations (grayscale, bilinear scaling,
 * contrast normalization) from orchestration and textual semantic parsing.
 *
 * @author Yogeshwaran
 */
@Slf4j
@Component
public class ReceiptImagePreprocessor {

    public void preprocessAndSaveImage(MultipartFile file, Path outputPath) throws IOException {
        BufferedImage original = null;
        try (InputStream is = file.getInputStream()) {
            original = ImageIO.read(is);
        } catch (Exception e) {
            log.debug("ImageIO direct decode skipped: {}", e.getMessage());
        }

        if (original == null) {
            try (InputStream is = file.getInputStream()) {
                Files.copy(is, outputPath, StandardCopyOption.REPLACE_EXISTING);
            }
            return;
        }

        int width = original.getWidth();
        int height = original.getHeight();

        double scale = 1.0;
        if (width < 1200 && width > 0) {
            scale = Math.min(2.5, 1200.0 / width);
        }
        int targetWidth = (int) Math.round(width * scale);
        int targetHeight = (int) Math.round(height * scale);

        BufferedImage gray = new BufferedImage(targetWidth, targetHeight, BufferedImage.TYPE_BYTE_GRAY);
        Graphics2D g = gray.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(original, 0, 0, targetWidth, targetHeight, null);
        g.dispose();

        // Contrast enhancement via min-max linear stretch to eliminate lighting gradients
        try {
            byte[] pixels = ((DataBufferByte) gray.getRaster().getDataBuffer()).getData();
            int min = 255;
            int max = 0;
            for (byte b : pixels) {
                int val = b & 0xFF;
                if (val < min) min = val;
                if (val > max) max = val;
            }
            if (max > min && (max - min < 220)) {
                double factor = 255.0 / (max - min);
                for (int i = 0; i < pixels.length; i++) {
                    int val = pixels[i] & 0xFF;
                    int newVal = (int) ((val - min) * factor);
                    pixels[i] = (byte) Math.clamp(newVal, 0, 255);
                }
            }
        } catch (Exception e) {
            log.debug("Raster buffer contrast enhancement fallback: {}", e.getMessage());
        }

        ImageIO.write(gray, "png", outputPath.toFile());
    }
}
