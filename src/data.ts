export type Category = 'coffee' | 'food' | 'snacks'

export interface Product {
  id: string
  name: string
  category: Category
  price: number
  // Products the business marked for bonus points.
  bonusPoints?: number
}

// Placeholder data. Replace with the real menu and prices.
export const products: Product[] = [
  { id: 'esp', name: 'Espresso', category: 'coffee', price: 35, bonusPoints: 5 },
  { id: 'cap', name: 'Cappuccino', category: 'coffee', price: 55, bonusPoints: 10 },
  { id: 'latte', name: 'Latte', category: 'coffee', price: 60, bonusPoints: 10 },
  { id: 'cin', name: 'Cinnamon Roll', category: 'food', price: 45, bonusPoints: 8 },
  { id: 'sand', name: 'Chicken Sandwich', category: 'food', price: 85 },
  { id: 'chips', name: 'Chips', category: 'snacks', price: 20 },
]
