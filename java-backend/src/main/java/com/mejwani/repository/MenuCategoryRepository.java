package com.mejwani.repository;

import com.mejwani.entity.MenuCategory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface MenuCategoryRepository extends JpaRepository<MenuCategory, Long> {
    List<MenuCategory> findByHotelIdOrderByDisplayOrderAsc(Long hotelId);
    List<MenuCategory> findByHotelId(Long hotelId);
    java.util.Optional<MenuCategory> findByNameAndHotelId(String name, Long hotelId);
}
