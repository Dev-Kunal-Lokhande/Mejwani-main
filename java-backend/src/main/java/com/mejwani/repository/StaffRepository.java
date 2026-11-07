package com.mejwani.repository;

import com.mejwani.entity.Staff;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface StaffRepository extends JpaRepository<Staff, Long> {
    List<Staff> findByHotelId(Long hotelId);
    List<Staff> findByHotelIdAndIsActiveTrue(Long hotelId);
}
