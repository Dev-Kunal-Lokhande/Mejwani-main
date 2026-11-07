package com.mejwani;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class MejwaniApplication {
    public static void main(String[] args) {
        SpringApplication.run(MejwaniApplication.class, args);
        System.out.println("===========================================");
        System.out.println("  Mejwani Backend Server Started!");
        System.out.println("  http://localhost:8080/api");
        System.out.println("===========================================");
    }
}
