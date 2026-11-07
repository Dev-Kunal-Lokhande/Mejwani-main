package com.mejwani.repository;

import com.mejwani.entity.MenuItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MenuItemRepository extends JpaRepository<MenuItem, Long> {
    List<MenuItem> findByHotelId(Long hotelId);
    List<MenuItem> findByHotelIdAndIsAvailableTrue(Long hotelId);
    List<MenuItem> findByCategoryId(Long categoryId);
    List<MenuItem> findByHotelIdOrderByDisplayOrderAsc(Long hotelId);
    List<MenuItem> findByCategoryIdAndHotelId(Long categoryId, Long hotelId);
}
