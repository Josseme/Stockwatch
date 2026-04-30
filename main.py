import sys
import os

try:
    from dotenv import load_dotenv
except ImportError:
    pass

from database import initialize_database, add_item, update_quantity, get_all_items, get_item_by_id, delete_item
from tracker import check_low_stock

def print_menu():
    print("\n" + "="*50)
    print("           STOCKWATCH INVENTORY SYSTEM           ")
    print("="*50)
    print("1. View All Inventory")
    print("2. Add New Item (Manual)")
    print("3. Update Item Quantity (Manual)")
    print("4. Check Low Stock Alerts")
    print("5. Delete Item")
    print("6. Exit")
    print("="*50)

def main():
    # Load environment variables if dotenv is installed and .env exists
    if 'load_dotenv' in globals():
        load_dotenv()
        
    initialize_database()
    
    while True:
        print_menu()
        choice = input("Select an option (1-6): ")
        
        if choice == '1':
            items = get_all_items()
            if not items:
                print("\nInventory is currently empty.")
            else:
                print("\nID | Name            | Quantity | Threshold | Price    | Cost     ")
                print("-" * 70)
                for item in items:
                    print(f"{item[0]:2} | {item[1]:<15} | {item[2]:<8} | {item[3]:<9} | Ksh {item[4]:<7.2f} | Ksh {item[6]:<7.2f}")
        
        elif choice == '2':
            print("\n--- Add New Item ---")
            name = input("Item Name: ")
            try:
                qty = int(input("Initial Quantity: "))
                threshold = int(input("Low Stock Threshold: "))
                price = float(input("Selling Price (Ksh): "))
                cost_price = float(input("Cost Price (Ksh): ") or 0)
                success, msg = add_item(name, qty, threshold, price, cost_price=cost_price)
                print(f"\n{msg}")
                # Check immediately if the new item is already under threshold
                if success and qty < threshold:
                    check_low_stock() 
            except ValueError:
                print("\nInvalid input! Quantity/Threshold must be integers, Price must be a number.")
                
        elif choice == '3':
            print("\n--- Update Quantity ---")
            try:
                item_id = int(input("Enter Item ID: "))
                item = get_item_by_id(item_id)
                if not item:
                    print("\nItem not found!")
                    continue
                new_qty = int(input(f"Enter new quantity for '{item[1]}' (Current: {item[2]}): "))
                update_quantity(item_id, new_qty)
                print(f"\nQuantity updated successfully to {new_qty}.")
                # Check for low stock after updating
                if new_qty < item[3]:
                    check_low_stock()
            except ValueError:
                 print("\nInvalid input! ID and Quantity must be integers.")
                 
        elif choice == '4':
            print("\n--- Running Low Stock Checks ---")
            check_low_stock()
            print("Check complete.")
            
        elif choice == '5':
            print("\n--- Delete Item ---")
            try:
                item_id = int(input("Enter Item ID to delete: "))
                item = get_item_by_id(item_id)
                if not item:
                     print("\nItem not found!")
                     continue
                confirm = input(f"Are you sure you want to delete '{item[1]}'? (y/n): ")
                if confirm.lower() == 'y':
                    delete_item(item_id)
                    print("\nItem deleted.")
                else:
                    print("\nDeletion cancelled.")
            except ValueError:
                 print("\nInvalid input! ID must be an integer.")
                 
        elif choice == '6':
            print("\nExiting Stockwatch. Goodbye!")
            sys.exit(0)
        else:
            print("\nInvalid choice. Please select 1-6.")

if __name__ == "__main__":
    main()
