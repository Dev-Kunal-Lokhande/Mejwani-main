package com.mejwani.repository;

import com.mejwani.entity.Hotel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface HotelRepository extends JpaRepository<Hotel, Long> {
    Optional<Hotel> findBySlug(String slug);
    Optional<Hotel> findByEmail(String email);
}
