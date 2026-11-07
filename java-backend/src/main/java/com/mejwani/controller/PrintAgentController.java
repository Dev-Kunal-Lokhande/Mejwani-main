package com.mejwani.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.*;

/**
 * Stub controller for /api/print-agent/* endpoints.
 * The actual printing is handled by a local print agent on port 9111.
 * These endpoints prevent 404 errors when the print agent is offline.
 */
@RestController
@RequestMapping("/api/print-agent")
public class PrintAgentController {

    @GetMapping("/status")
    public ResponseEntity<?> status() {
        return ResponseEntity.ok(Map.of("success", true, "online", false, "message", "Print agent not connected"));
    }

    @GetMapping("/config")
    public ResponseEntity<?> getConfig() {
        return ResponseEntity.ok(Map.of("success", true, "data", Map.of()));
    }

    @PostMapping("/config")
    public ResponseEntity<?> saveConfig(@RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", true, "message", "Config saved"));
    }

    @GetMapping("/download-custom")
    public ResponseEntity<?> downloadCustom() {
        return ResponseEntity.ok(Map.of("success", false, "message", "Print agent not available"));
    }

    @PostMapping("/test-print")
    public ResponseEntity<?> testPrint(@RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", false, "message", "Print agent not connected"));
    }

    @PostMapping("/clear-pending")
    public ResponseEntity<?> clearPending() {
        return ResponseEntity.ok(Map.of("success", true, "message", "Cleared"));
    }

    @GetMapping("/failed-jobs")
    public ResponseEntity<?> getFailedJobs() {
        return ResponseEntity.ok(Map.of("success", true, "data", List.of()));
    }

    @PostMapping("/retry-job")
    public ResponseEntity<?> retryJob(@RequestBody(required = false) Map<String, Object> body) {
        return ResponseEntity.ok(Map.of("success", false, "message", "Print agent not connected"));
    }
}
