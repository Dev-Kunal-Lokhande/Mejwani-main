package com.mejwani.repository;

import com.mejwani.entity.Order;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OrderRepository extends JpaRepository<Order, Long> {
    List<Order> findByHotelId(Long hotelId);
    List<Order> findByHotelIdAndStatus(Long hotelId, String status);
    List<Order> findByTableId(Long tableId);
    List<Order> findByHotelIdOrderByCreatedAtDesc(Long hotelId);

    @Query("SELECT o FROM Order o WHERE o.hotel.id = :hotelId AND o.createdAt BETWEEN :start AND :end ORDER BY o.createdAt DESC")
    List<Order> findByHotelIdAndDateRange(@Param("hotelId") Long hotelId,
                                          @Param("start") LocalDateTime start,
                                          @Param("end") LocalDateTime end);

    @Query("SELECT o FROM Order o WHERE o.hotel.id = :hotelId AND o.status NOT IN ('COMPLETED','CANCELLED') ORDER BY o.createdAt ASC")
    List<Order> findActiveOrders(@Param("hotelId") Long hotelId);
}
