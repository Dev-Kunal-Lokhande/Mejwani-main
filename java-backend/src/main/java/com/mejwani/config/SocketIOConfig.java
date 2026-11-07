package com.mejwani.config;

import com.corundumstudio.socketio.Configuration;
import com.corundumstudio.socketio.SocketIOServer;
import com.corundumstudio.socketio.listener.ConnectListener;
import com.corundumstudio.socketio.listener.DisconnectListener;
import org.springframework.context.annotation.Bean;
import org.springframework.beans.factory.annotation.Value;

@org.springframework.context.annotation.Configuration
public class SocketIOConfig {

    @Value("${frontend.url:http://localhost:5173}")
    private String frontendUrl;

    @Bean
    public SocketIOServer socketIOServer() {
        Configuration config = new Configuration();
        config.setHostname("0.0.0.0");
        config.setPort(9001);
        config.setContext("/socket.io");
        config.setOrigin("*");

        SocketIOServer server = new SocketIOServer(config);

        server.addConnectListener((ConnectListener) client -> {
            System.out.println("[SOCKET.IO] Client connected: " + client.getSessionId());
        });

        server.addDisconnectListener((DisconnectListener) client -> {
            System.out.println("[SOCKET.IO] Client disconnected: " + client.getSessionId());
        });

        // Join hotel room
        server.addEventListener("join-hotel-room", String.class, (client, data, ackSender) -> {
            client.joinRoom("hotel-" + data);
            System.out.println("[SOCKET.IO] Client joined room: hotel-" + data);
        });

        return server;
    }

    @Bean
    public SocketIOServerRunner socketIOServerRunner(SocketIOServer server) {
        return new SocketIOServerRunner(server);
    }
}
