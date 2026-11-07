package com.mejwani.repository;

import com.mejwani.entity.ParcelOrder;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ParcelOrderRepository extends JpaRepository<ParcelOrder, Long> {
    List<ParcelOrder> findByHotelId(Long hotelId);
    List<ParcelOrder> findByHotelIdAndStatus(Long hotelId, String status);
    List<ParcelOrder> findByHotelIdOrderByCreatedAtDesc(Long hotelId);
}
