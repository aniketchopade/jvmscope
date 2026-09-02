package com.example.demo;

public class PricingEngine {

    private static final double UNIT_PRICE = 19.99;

    public double computeTotal(String sku, int quantity) {
        double base = UNIT_PRICE * quantity;
        double discount = discountFor(quantity);
        slowDown(3);
        return base * (1.0 - discount);
    }

    private double discountFor(int quantity) {
        if (quantity >= 5) return 0.10;
        if (quantity >= 3) return 0.05;
        return 0.0;
    }

    /** Adds measurable cost so `trace` output has meaningful timings. */
    private void slowDown(int millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
