import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST() {
  try {
    // Update the trigger function to use correct column names
    await sql`
      CREATE OR REPLACE FUNCTION update_stock_after_movement()
      RETURNS TRIGGER AS $$
      DECLARE
          v_quantity_change INTEGER;
      BEGIN
          -- Calculate the quantity change based on movement type
          v_quantity_change := CASE 
              WHEN NEW.movement_type IN ('IN', 'RETURN') THEN NEW.quantity
              WHEN NEW.movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN -NEW.quantity
              ELSE 0  -- ADJUSTMENT handled separately
          END;
          
          -- Upsert into stock_levels using correct column names
          INSERT INTO stock_levels (item_id, warehouse_id, quantity_on_hand, last_updated)
          VALUES (NEW.item_id, NEW.warehouse_id, GREATEST(0, v_quantity_change), CURRENT_TIMESTAMP)
          ON CONFLICT (item_id, warehouse_id)
          DO UPDATE SET 
              quantity_on_hand = GREATEST(0, stock_levels.quantity_on_hand + v_quantity_change),
              last_updated = CURRENT_TIMESTAMP;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    // Also update the validation trigger to use correct column names
    await sql`
      CREATE OR REPLACE FUNCTION validate_stock_before_movement()
      RETURNS TRIGGER AS $$
      DECLARE
          v_current_stock INTEGER;
      BEGIN
          -- Only validate for OUT movements
          IF NEW.movement_type IN ('OUT', 'ORDER', 'TRANSFER') THEN
              SELECT COALESCE(quantity_on_hand, 0) INTO v_current_stock
              FROM stock_levels
              WHERE item_id = NEW.item_id AND warehouse_id = NEW.warehouse_id;
              
              IF v_current_stock IS NULL THEN
                  RAISE EXCEPTION 'No stock record found for item % in warehouse %', NEW.item_id, NEW.warehouse_id;
              END IF;
              
              IF v_current_stock < ABS(NEW.quantity) THEN
                  RAISE EXCEPTION 'Insufficient stock. Available: %, Requested: %', v_current_stock, ABS(NEW.quantity);
              END IF;
          END IF;
          
          RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `;

    return NextResponse.json({ 
      success: true, 
      message: 'Triggers updated to use correct column names (quantity_on_hand, last_updated)'
    });
  } catch (error) {
    console.error('Error updating triggers:', error);
    return NextResponse.json({ success: false, error: 'Failed to update triggers: ' + String(error) }, { status: 500 });
  }
}
