package com.mejwani.config;

import com.corundumstudio.socketio.SocketIOServer;
import org.springframework.context.SmartLifecycle;

public class SocketIOServerRunner implements SmartLifecycle {

    private final SocketIOServer server;
    private volatile boolean running = false;

    public SocketIOServerRunner(SocketIOServer server) {
        this.server = server;
    }

    @Override
    public void start() {
        if (running) {
            return;
        }
        try {
            server.start();
            running = true;
            System.out.println("[SOCKET.IO] Server started on port "
                    + server.getConfiguration().getPort()
                    + server.getConfiguration().getContext());
        } catch (Exception e) {
            running = false;
            System.err.println("[SOCKET.IO] Failed to start server: " + e.getMessage());
        }
    }

    @Override
    public void stop() {
        if (!running) {
            return;
        }
        try {
            server.stop();
            System.out.println("[SOCKET.IO] Server stopped.");
        } catch (Exception e) {
            System.err.println("[SOCKET.IO] Failed to stop server: " + e.getMessage());
        } finally {
            running = false;
        }
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