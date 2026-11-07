package com.mejwani.repository;

import com.mejwani.entity.RestaurantTable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RestaurantTableRepository extends JpaRepository<RestaurantTable, Long> {
    List<RestaurantTable> findByHotelId(Long hotelId);
    List<RestaurantTable> findBySectionId(Long sectionId);
    List<RestaurantTable> findByHotelIdAndSectionId(Long hotelId, Long sectionId);
    Optional<RestaurantTable> findByQrCode(String qrCode);
    Optional<RestaurantTable> findByTableNumberAndHotelId(String tableNumber, Long hotelId);
}
