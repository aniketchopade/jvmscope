package com.example.demo;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executors;

/**
 * A dependency-free test target for Arthas Studio: a plain JDK HttpServer with a few
 * layered method calls that are interesting to `watch` and `trace`, plus a background
 * thread that keeps calling them so streaming output appears without manual HTTP requests.
 */
public class DemoServer {

    public static void main(String[] args) throws IOException {
        int port = args.length > 0 ? Integer.parseInt(args[0]) : 8000;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        OrderService orderService = new OrderService();

        server.createContext("/order", (HttpExchange exchange) -> {
            String query = exchange.getRequestURI().getQuery();
            int quantity = parseQuantity(query);
            String result;
            try {
                result = orderService.placeOrder("widget", quantity);
            } catch (RuntimeException e) {
                result = "ERROR: " + e.getMessage();
            }
            respond(exchange, result);
        });

        server.createContext("/health", exchange -> respond(exchange, "OK"));

        server.setExecutor(Executors.newFixedThreadPool(4));
        server.start();
        System.out.println("DemoServer listening on http://127.0.0.1:" + port);

        // Background traffic so watch/trace show live output without a human driving requests.
        Thread ticker = new Thread(() -> {
            int i = 0;
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    orderService.placeOrder("background", (i++ % 7));
                } catch (RuntimeException ignored) {
                    // quantity 0 throws on purpose, so `watch -e` has something to catch
                }
                try {
                    Thread.sleep(1000);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }, "order-ticker");
        ticker.setDaemon(true);
        ticker.start();
    }

    private static int parseQuantity(String query) {
        if (query == null) return 1;
        for (String part : query.split("&")) {
            String[] kv = part.split("=", 2);
            if (kv.length == 2 && kv[0].equals("qty")) {
                try {
                    return Integer.parseInt(kv[1]);
                } catch (NumberFormatException e) {
                    return 1;
                }
            }
        }
        return 1;
    }

    private static void respond(HttpExchange exchange, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }
}
