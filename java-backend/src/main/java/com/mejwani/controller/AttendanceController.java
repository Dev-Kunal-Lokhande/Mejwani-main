package com.mejwani.controller;

import com.mejwani.entity.*;
import com.mejwani.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/attendance")
@RequiredArgsConstructor
public class AttendanceController {

    private final AttendanceRepository attendanceRepository;
    private final StaffRepository staffRepository;
    private final HotelRepository hotelRepository;

    private Map<String, Object> serializeAttendance(Attendance a) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", a.getId());
        m.put("attendance_date", a.getAttendanceDate());
        m.put("date", a.getAttendanceDate() != null ? a.getAttendanceDate().toString() : null);
        m.put("status", a.getStatus());
        m.put("check_in", a.getCheckIn());
        m.put("check_out", a.getCheckOut());
        m.put("created_at", a.getCreatedAt());
        m.put("hotel_id", a.getHotel() != null ? a.getHotel().getId() : null);
        if (a.getStaff() != null) {
            Map<String, Object> staffMap = new HashMap<>();
            staffMap.put("id", a.getStaff().getId());
            staffMap.put("name", a.getStaff().getName());
            staffMap.put("role", a.getStaff().getRole());
            m.put("staff", staffMap);
            m.put("staff_id", a.getStaff().getId());
            m.put("staffId", a.getStaff().getId());
        }
        return m;
    }

    @Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<?> getAttendance(@RequestParam(required = false) Long hotelId,
                                           @RequestParam(required = false) String date) {
        if (hotelId == null) {
            return ResponseEntity.ok(List.of());
        }
        List<Attendance> list = (date != null && !date.isBlank())
                ? attendanceRepository.findByHotelIdAndAttendanceDate(hotelId, LocalDate.parse(date))
                : attendanceRepository.findByHotelId(hotelId);
        return ResponseEntity.ok(list.stream().map(this::serializeAttendance).toList());
    }

    @Transactional
    @PostMapping({"", "/mark"})
    public ResponseEntity<?> markAttendance(@RequestParam(required = false) Long hotelId,
                                            @RequestBody Map<String, Object> body) {
        Object rawStaffId = body.get("staffId") != null ? body.get("staffId")
                : (body.get("staff_id") != null ? body.get("staff_id") : body.get("id"));
        if (rawStaffId == null || rawStaffId.toString().isBlank()) {
            return ResponseEntity.badRequest().body(Map.of("success", false, "message", "staffId is required"));
        }

        Long staffId = Long.valueOf(rawStaffId.toString());
        Staff staff = staffRepository.findById(staffId)
                .orElseThrow(() -> new RuntimeException("Staff not found"));

        Long resolvedHotelId = hotelId;
        if (resolvedHotelId == null && body.get("hotelId") != null && !body.get("hotelId").toString().isBlank()) {
            resolvedHotelId = Long.valueOf(body.get("hotelId").toString());
        }
        Hotel hotel = resolvedHotelId != null
                ? hotelRepository.findById(resolvedHotelId).orElse(staff.getHotel())
                : staff.getHotel();

        String status = body.get("status") != null ? body.get("status").toString().toUpperCase() : "PRESENT";
        Object rawDate = body.get("date") != null ? body.get("date") : body.get("attendance_date");
        LocalDate date = (rawDate != null && !rawDate.toString().isBlank())
                ? LocalDate.parse(rawDate.toString())
                : LocalDate.now();

        var existing = attendanceRepository.findByStaffIdAndAttendanceDate(staffId, date);
        Attendance saved;
        if (existing.isPresent()) {
            Attendance att = existing.get();
            att.setStatus(status);
            saved = attendanceRepository.save(att);
        } else {
            Attendance att = Attendance.builder()
                    .staff(staff)
                    .hotel(hotel)
                    .attendanceDate(date)
                    .status(status)
                    .build();
            saved = attendanceRepository.save(att);
        }

        return ResponseEntity.ok(Map.of(
                "success", true,
                "status", "success",
                "message", "Attendance marked as " + status,
                "data", serializeAttendance(saved)
        ));
    }

    @Transactional
    @PutMapping("/{id}")
    public ResponseEntity<?> updateAttendance(@PathVariable Long id, @RequestBody Map<String, Object> body) {
        return attendanceRepository.findById(id).map(att -> {
            if (body.containsKey("status")) att.setStatus(body.get("status").toString());
            return ResponseEntity.ok(serializeAttendance(attendanceRepository.save(att)));
        }).orElse(ResponseEntity.notFound().build());
    }
}