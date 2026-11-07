package com.mejwani.repository;

import com.mejwani.entity.Section;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface SectionRepository extends JpaRepository<Section, Long> {
    List<Section> findByHotelId(Long hotelId);
    List<Section> findByHotelIdOrderByIdAsc(Long hotelId);
}
