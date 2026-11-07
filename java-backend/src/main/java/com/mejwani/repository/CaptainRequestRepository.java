package com.mejwani.repository;

import com.mejwani.entity.CaptainRequest;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface CaptainRequestRepository extends JpaRepository<CaptainRequest, Long> {
    List<CaptainRequest> findByHotelId(Long hotelId);
    List<CaptainRequest> findByHotelIdAndStatus(Long hotelId, String status);
    List<CaptainRequest> findByHotelIdOrderByCreatedAtDesc(Long hotelId);
}
