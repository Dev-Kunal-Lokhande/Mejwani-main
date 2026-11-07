package com.mejwani.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

@Entity
@Table(name = "parcel_order_items")
@Data
@ToString(exclude = {"parcelOrder", "menuItem"})
@EqualsAndHashCode(exclude = {"parcelOrder", "menuItem"})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ParcelOrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parcel_order_id", nullable = false)
    private ParcelOrder parcelOrder;

    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "menu_item_id")
    private MenuItem menuItem;

    @Column(nullable = false)
    private Integer quantity;

    @Column(name = "unit_price", precision = 10, scale = 2)
    private BigDecimal unitPrice;

    @Column(name = "item_name")
    private String itemName;
}
