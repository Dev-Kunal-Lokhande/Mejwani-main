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
        }
        return m;
    }

    @Transactional(readOnly = true)
    @GetMapping
    public ResponseEntity<?> getAttendance(@RequestParam Long hotelId,
                                           @RequestParam(required = false) String date) {
        List<Attendance> list = date != null
                ? attendanceRepository.findByHotelIdAndAttendanceDate(hotelId, LocalDate.parse(date))
                : attendanceRepository.findByHotelId(hotelId);
        return ResponseEntity.ok(list.stream().map(this::serializeAttendance).toList());
    }

    @Transactional
    @PostMapping
    public ResponseEntity<?> markAttendance(@RequestBody Map<String, Object> body) {
        Long hotelId = Long.valueOf(body.get("hotelId").toString());
        Long staffId = Long.valueOf(body.get("staffId").toString());
        String status = body.getOrDefault("status", "PRESENT").toString();
        LocalDate date = body.containsKey("date") ?
                LocalDate.parse(body.get("date").toString()) : LocalDate.now();

        Hotel hotel = hotelRepository.findById(hotelId).orElseThrow(() -> new RuntimeException("Hotel not found"));
        Staff staff = staffRepository.findById(staffId).orElseThrow(() -> new RuntimeException("Staff not found"));

        var existing = attendanceRepository.findByStaffIdAndAttendanceDate(staffId, date);
        if (existing.isPresent()) {
            Attendance att = existing.get();
            att.setStatus(status);
            return ResponseEntity.ok(serializeAttendance(attendanceRepository.save(att)));
        }

        Attendance att = Attendance.builder()
                .staff(staff)
                .hotel(hotel)
                .attendanceDate(date)
                .status(status)
                .build();

        return ResponseEntity.ok(serializeAttendance(attendanceRepository.save(att)));
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
