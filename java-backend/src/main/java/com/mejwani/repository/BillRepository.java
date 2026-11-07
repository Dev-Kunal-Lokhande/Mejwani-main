package com.mejwani.repository;

import com.mejwani.entity.Bill;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface BillRepository extends JpaRepository<Bill, Long> {
    List<Bill> findByHotelId(Long hotelId);
    Optional<Bill> findByOrderId(Long orderId);
    List<Bill> findByHotelIdOrderByCreatedAtDesc(Long hotelId);
    List<Bill> findByHotelIdAndCreatedAtBetween(Long hotelId, LocalDateTime start, LocalDateTime end);
}
