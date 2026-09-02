package com.example.demo;

/** Deliberately layered so `trace` shows a non-trivial call tree and per-call costs. */
public class OrderService {

    private final PricingEngine pricingEngine = new PricingEngine();
    private final InventoryClient inventoryClient = new InventoryClient();

    public String placeOrder(String sku, int quantity) {
        if (quantity <= 0) {
            throw new IllegalArgumentException("quantity must be positive, got " + quantity);
        }
        boolean available = inventoryClient.checkStock(sku, quantity);
        if (!available) {
            return "OUT_OF_STOCK:" + sku;
        }
        double total = pricingEngine.computeTotal(sku, quantity);
        return String.format("OK sku=%s qty=%d total=%.2f", sku, quantity, total);
    }
}
