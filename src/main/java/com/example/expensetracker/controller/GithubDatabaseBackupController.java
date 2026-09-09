package com.example.expensetracker.controller;

import com.example.expensetracker.service.GithubDatabaseFailoverService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
@RequestMapping("/api/sync/github-db")
public class GithubDatabaseBackupController {
    private final GithubDatabaseFailoverService service;
    @Value("${app.sync.secret-key:}") private String syncSecret;

    public GithubDatabaseBackupController(GithubDatabaseFailoverService service) { this.service = service; }

    @PostMapping
    public ResponseEntity<Map<String,Object>> backup(
            @RequestHeader(value = "X-Sync-Token", required = false) String token,
            HttpServletRequest request) {
        if (syncSecret == null || syncSecret.isBlank() || token == null ||
                !MessageDigest.isEqual(syncSecret.getBytes(StandardCharsets.UTF_8), token.getBytes(StandardCharsets.UTF_8))) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("status","error","message","Invalid sync token"));
        }
        return ResponseEntity.ok(service.backupCurrentDatabase());
    }
}
