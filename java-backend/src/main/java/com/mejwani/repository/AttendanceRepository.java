package com.mejwani.repository;

import com.mejwani.entity.Attendance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceRepository extends JpaRepository<Attendance, Long> {
    List<Attendance> findByHotelId(Long hotelId);
    List<Attendance> findByHotelIdAndAttendanceDate(Long hotelId, LocalDate date);
    List<Attendance> findByStaffIdAndAttendanceDateBetween(Long staffId, LocalDate start, LocalDate end);
    Optional<Attendance> findByStaffIdAndAttendanceDate(Long staffId, LocalDate date);
}
