package com.mejwani.config;

import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.context.SmartLifecycle;

public class SocketIOServerRunner implements SmartLifecycle {

    private final SocketIOServer server;
    private boolean running = false;

    public SocketIOServerRunner(SocketIOServer server) {
        this.server = server;
    }

    @Override
    public void start() {
        server.start();
        running = true;
        System.out.println("[SOCKET.IO] Server started on port 8080/socket.io");
    }

    @Override
    public void stop() {
        server.stop();
        running = false;
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE;
    }
}
