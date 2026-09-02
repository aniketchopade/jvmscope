package com.example.demo;

public class InventoryClient {

    public boolean checkStock(String sku, int quantity) {
        simulateNetworkCall();
        // "background" orders of 6+ are treated as out of stock so watch/trace see both branches
        return !(sku.equals("background") && quantity >= 6);
    }

    private void simulateNetworkCall() {
        try {
            Thread.sleep(5);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
